'use strict';
const crypto=require('node:crypto');
const {runCommissionTransaction:transaction}=require('./commission-generation');
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fault=(statusCode,message)=>Object.assign(Error(message),{statusCode});

// Candidate only. A signed delivery identifies an event; amounts and eligibility
// always come from the existing canonical server calculation, never its payload.
function createCommissionEvent({db,commissions,verifyToken,audience,caller,instance,probeRef='',enabled=false,now=Date.now,logger=()=>{},coordinate=async(_event,work)=>work()}){
 async function authorize(req){
  if(!enabled||!audience||!caller||!instance)throw fault(503,'Receptor de eventos no habilitado');
  if(req.method!=='POST')throw fault(405,'Método no permitido');
  const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/i);
  if(!bearer)throw fault(401,'Entrega autenticada requerida');
  let identity;try{identity=await verifyToken(bearer[1],audience);}catch(_){throw fault(401,'Entrega inválida');}
  if(!identity||identity.email!==caller||identity.email_verified!==true||!['accounts.google.com','https://accounts.google.com'].includes(identity.iss)||identity.aud!==audience)throw fault(403,'Origen no autorizado');
  const h=req.headers;
  if(h['ce-specversion']!=='1.0'||h['ce-type']!=='google.firebase.database.ref.v1.written'||h['ce-instance']!==instance)throw fault(400,'Evento no admitido');
  const id=String(h['ce-id']||''),source=String(h['ce-source']||'');
  if(!id||id.length>512||!source.startsWith('//firebasedatabase.googleapis.com/')||!source.endsWith('/instances/'+instance)||source.length>1024)throw fault(400,'Referencia de evento inválida');
  return {h,id,source};
 }
 async function probe(req){
  if(!probeRef||!/^sv_commission_probe\/[A-Za-z0-9_-]{16,80}$/.test(probeRef))throw fault(404,'Operación no disponible');
  const {h}=await authorize(req);
  if(String(h['ce-ref']||'').replace(/^\//,'')!==probeRef)throw fault(400,'Prueba no admitida');
  logger({event:'commission_event_probe_received',instance,specversion:h['ce-specversion'],type:h['ce-type'],authenticated:true});
  return {status:'probe_received'};
 }
 async function handle(req){
  const {h,id,source}=await authorize(req);
  const match=String(h['ce-ref']||'').match(/^\/?sisventas\/(ventas|pagos)\/([A-Za-z0-9_-]{1,128})(?:\/(estadoPago|comisionHabilitada|monto))?$/);
  if(!match)throw fault(400,'Ruta de evento no admitida');
  if(match[3]&&(match[1]==='pagos'?match[3]!=='monto':!['estadoPago','comisionHabilitada'].includes(match[3])))throw fault(400,'Campo de evento no admitido');
  const digest=crypto.createHash('sha256').update(JSON.stringify([source,id,match[1],match[2]])).digest('hex');
  const event={id,source,domain:match[1],key:match[2]},ref=db.ref('sv_commission_events/'+digest),leaseMs=120000,token=crypto.randomUUID();let reason;
  // Reserve the attempt durably before starting business work. Counting only
  // after rollback would let concurrent instances exceed the five-attempt cap.
  let reservationResult;try{reservationResult=await coordinate({...event,phase:'reserve'},async()=>{
  const stamp=now();
  const reservation=await transaction(ref,current=>{
   reason=null;
   if(current?.state==='completed'||current?.state==='review'){reason=current.state;return;}
   if(Number(current?.leaseUntil)>stamp){reason='busy';return;}
   if(Number(current?.attempts||0)>=5){reason='exhausted';return;}
   return {...current,state:'processing',attempts:Number(current?.attempts||0)+1,leaseUntil:stamp+leaseMs,token,createdAt:current?.createdAt||stamp};
  });
  if(!reservation.committed){
   if(reason==='busy')throw fault(503,'Evento en curso');
   if(reason==='exhausted'){await transaction(ref,current=>current?.state!=='completed'&&Number(current?.attempts)>=5?{...current,state:'review',leaseUntil:0}:undefined);logger({event:'commission_event_review',eventHash:digest,reason:'attempts'});}
   return {status:'ignored',reason};
  }
  return {reserved:true};
  });}catch(_){throw fault(503,'No se pudo reservar el evento');}
  if(!reservationResult.reserved)return reservationResult;
  try{return await coordinate({...event,phase:'generation'},async()=>{
  const current=(await ref.get()).val();
  if(current?.token!==token||current.state!=='processing')throw fault(503,'La reserva del evento cambió');
  async function finish(fields){const result=await transaction(ref,current=>current?.token===token?{...current,...fields,leaseUntil:0}:undefined);if(!result.committed)throw fault(503,'La reserva del evento cambió');}
  try{
   let saleKey=match[2];
   if(match[1]==='pagos'){
    const payment=(await db.ref('sisventas/pagos/'+match[2]).get()).val();
    if(!payment){await finish({state:'completed',reason:'payment_removed'});return {status:'ignored'};}
    // Old aliases require a separate reconciliation, never a broad sales scan.
    if(!key(payment.ventaFbKey)){await finish({state:'review',reason:'payment_identity'});logger({event:'commission_event_review',eventHash:digest,reason:'payment_identity'});return {status:'review'};}
    saleKey=payment.ventaFbKey;
   }
   const sale=(await db.ref('sisventas/ventas/'+saleKey).get()).val();
   const job=sale?.comisionesGeneradas===true?(await db.ref('sv_commission_generation/'+saleKey).get()).val():null;
   if(!sale||sale.comisionHabilitada!==true||(sale.comisionesGeneradas===true&&!['procesando','error'].includes(job?.estado))||sale.anulada===true||sale.anulado===true||['anulado','anulada','sin_cargo'].includes(String(sale.estado||'').toLowerCase())){
    await finish({state:'completed',reason:'not_applicable'});return {status:'ignored'};
   }
   const result=await commissions.systemGenerate(saleKey);
   await finish({state:result.status==='revision'?'review':'completed',completedAt:now(),result:result.status});
   return {status:'completed',result:result.status};
  }catch(error){
   throw fault(503,'No se pudo completar el evento');
  }
  });}catch(error){
   try{
    // The failed financial scope must finish aborting before this ledger starts.
    // Committing its error state inside that scope would either lose the attempt
    // on rollback or publish a partially staged commission. This final scope
    // writes only this authenticated event's bookkeeping, never business data.
    await coordinate({...event,phase:'failure-ledger'},async()=>{
     const saved=await transaction(ref,current=>{
      if(current?.token!==token||current.state==='completed'||current.state==='review')return;
      return {...current,state:'error',leaseUntil:0,lastError:'generation_interrupted'};
     });
     return {recorded:saved.committed};
    });
   }catch(_){logger({event:'commission_event_error_ledger_failed',eventHash:digest});}
   throw error;
  }
 }
 return {handle,probe};
}
module.exports={createCommissionEvent};
