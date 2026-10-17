'use strict';
const crypto=require('node:crypto'),M=require('./commission-generation-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const validKey=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const leaseMs=120000;
async function tx(ref,update){
 let listener;try{await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});return await ref.transaction(update,undefined,false);}finally{if(listener)ref.off('value',listener);}
}
function createCommissionGeneration({db,commercial,enabled=false,from=0,now=Date.now,logger=()=>{}}){
 const read=async path=>(await db.ref(path).get()).val();
 const jobId=id=>'srv_'+M.hash(id).slice(0,40);
 async function authorize(req){if(!enabled)throw fail(503,'Generación de comisiones pendiente de habilitación');return commercial.authorize(req,'ventas');}
 async function load(id,ownJob){
  if(!validKey(id))throw fail(400,'Venta inválida');
  const stored=await read('sisventas/ventas/'+id);if(!stored)throw fail(404,'Venta no disponible');const sale={...stored,fbKey:id};
  const [employees,comisiones,comisionesEmpleados,maxComisionPct,cargos]=await Promise.all(['empleados','config/comisiones','config/comisionesEmpleados','config/maxComisionPct','config/cargos'].map(p=>read('sisventas/'+p)));
  const config={comisiones,comisionesEmpleados,maxComisionPct:maxComisionPct??10,cargos};
  const queries=async(node,field,value)=>(await db.ref('sisventas/'+node).orderByChild(field).equalTo(value).get()).val()||{};
  const aliases=[...new Set([sale.id,String(sale.id||'').replace(/^#/,''),'#'+String(sale.id||'').replace(/^#/,'')].filter(Boolean))];
  const pay=Object.assign({},await queries('pagos','ventaFbKey',id));
  const expenses=Object.assign({},await queries('gastos','ventaFbKey',id));
  for(const alias of aliases){Object.assign(pay,await queries('pagos','ventaId',alias),await queries('pagos','venta',alias));Object.assign(expenses,await queries('gastos','ventaId',alias),await queries('gastos','venta',alias));}
  const payments=Object.entries(pay).map(([fbKey,p])=>({...p,fbKey})).filter(p=>M.linked(p,sale));
  const existing=Object.entries(expenses).filter(([,g])=>M.linked(g,sale)&&['tipoPagable','origen','tipo'].some(k=>/comisi/i.test(g[k]||''))&&(!ownJob||g.generacionServidorId!==ownJob)).map(([key,g])=>({key,empleadoFbKey:g.empleadoFbKey||g.empleadoId||String(g.legacyKey||'').split('/')[1]||'sin-identidad'}));
  for(const emp of M.employeesFor(sale,employees)||[]){const moves=await read('sisventas/ctaemp/'+emp.fbKey)||{};for(const [key,m]of Object.entries(moves))if(m.tipo==='comision'&&M.linked(m,sale)&&(!ownJob||m.generacionServidorId!==ownJob))existing.push({key,empleadoFbKey:emp.fbKey});for(const saleKey of new Set([id,...aliases])){const control=await read('sisventas/comisiones_generacion/'+M.key('comision',[saleKey,emp.fbKey]));if(control&&(!ownJob||control.generacionServidorId!==ownJob))existing.push({key:'control',empleadoFbKey:emp.fbKey});}}
  const data={sale,payments,employees:employees||{},config:config||{},existing};return {data,preview:M.preview(data)};
 }
 async function inspect(actor,id){await commercial.assertRecord(actor,'ventas',id);const job=await read('sv_commission_generation/'+id);const p=(await load(id,job?.estado!=='completada'?job?.generacionServidorId:undefined)).preview;return job&&job.estado!=='completada'?{...p,status:'revision',motivo:job.estado==='revision'?'La generación incompleta requiere conciliación':'La generación está en curso o pendiente de reintento'}:p;}
 async function generate(actor,body,{system=false}={}){
  if(!enabled)throw fail(503,'Generación automática no habilitada');
  if(!body||Object.keys(body).some(k=>!['ventaFbKey','digest'].includes(k))||!validKey(body.ventaFbKey))throw fail(400,'Enviá únicamente la referencia de la venta');
  const id=body.ventaFbKey;if(!system)await commercial.assertRecord(actor,'ventas',id);
  const ref=db.ref('sv_commission_generation/'+id),known=(await ref.get()).val();
  if(known?.estado==='completada')return {status:'generada',participantes:known.plan.participantes,reutilizada:true};
  const own=known?.generacionServidorId;
  const initial=await load(id,own),p=initial.preview;
  // El observador nunca hace un backfill de comisiones históricas al activarse.
  if(system&&!known?.plan&&!initial.data.payments.some(v=>Number(v.ts)>=from))return {status:'historica',motivo:'Fuera del corte automático'};
  if(p.status!=='lista')return p;
  if(body.digest&&body.digest!==p.digest)throw fail(409,'La venta o su configuración cambiaron. Revisá el cálculo otra vez');
  const token=crypto.randomUUID(),stamp=now();let conflict;
  const locked=await tx(ref,current=>{
   conflict=null;
   if(current?.estado==='completada')return;
   if(current?.leaseUntil>stamp)return;
   if(current?.plan&&current.plan.digest!==p.digest){conflict=fail(409,'La base cambió durante una generación incompleta. Requiere revisión');return;}
   return {...current,estado:'procesando',generacionServidorId:jobId(id),plan:current?.plan||p,actor:current?.actor||{uid:actor.uid,nombre:actor.name||'Servidor'},creadoEn:current?.creadoEn||stamp,token,leaseUntil:stamp+leaseMs,intentos:Number(current?.intentos||0)+1};
  });
  if(!locked.committed){if(conflict)throw conflict;const current=(await ref.get()).val();if(current?.estado==='completada')return {status:'generada',reutilizada:true,participantes:current.plan.participantes};throw fail(409,'La comisión se está generando en otra sesión. Reintentá');}
  const job=locked.snapshot.val(),plan=job.plan;
  const finish=async fields=>tx(ref,current=>current?.token===token?{...current,...fields,leaseUntil:0}:undefined);
  // Cada destino es create-only. Una caída entre destinos se retoma desde el plan;
  // jamás se reemplaza un gasto o movimiento existente ni la raíz comercial.
  async function ensure(path,record){let collision=false;const target=db.ref(path);const result=await tx(target,current=>{collision=false;if(current){if(current.generacionServidorId!==job.generacionServidorId||Number(current.monto)!==record.monto||Number(current.pct)!==record.pct)collision=true;return;}return record;});if(!result.committed&&collision)throw fail(409,'Ya existe un registro en el destino. No se sobrescribió');}
  try{
   const fresh=await load(id,job.generacionServidorId);if(fresh.preview.status!=='lista'||fresh.preview.digest!==plan.digest)throw fail(409,'La base de la comisión cambió. No se continuará automáticamente');
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(job.creadoEn));
   // Reservar también el control compatible con la carga manual ANTES de crear
   // importes. Así un alta manual concurrente no puede pisar los mismos destinos.
   for(const emp of plan.participantes)await ensure('sisventas/comisiones_generacion/'+M.key('comision',[id,emp.empleadoFbKey]),{generacionServidorId:job.generacionServidorId,estado:'procesando',ts:job.creadoEn,ventaId:plan.ventaId,ventaFbKey:id,empleadoFbKey:emp.empleadoFbKey,monto:emp.monto,pct:emp.pct});
   for(const emp of plan.participantes){
    const movKey=M.key('comision',[id,emp.empleadoFbKey]),gastoKey=M.key('gasto_comision',[id,emp.empleadoFbKey]),legacy='ctaemp/'+emp.empleadoFbKey+'/'+movKey;
    const fields={generacionServidorId:job.generacionServidorId,ventaId:plan.ventaId,ventaFbKey:id,empleadoFbKey:emp.empleadoFbKey,empleadoNombre:emp.nombre,cliente:initial.data.sale.cliente||'',monto:emp.monto,pct:emp.pct,pctOriginal:emp.pctOriginal,gananciaBase:plan.base.ganancia,ajustadoAlTope:emp.pct<emp.pctOriginal,descripcion:'Comisión venta '+plan.ventaId+' · '+emp.pct+'% sobre ganancia original · generación automática',fecha:date,ts:job.creadoEn,legacyKey:legacy,origenCarga:'automatica_servidor',usuarioCarga:job.actor.nombre,actorUid:job.actor.uid};
    await ensure('sisventas/ctaemp/'+emp.empleadoFbKey+'/'+movKey,{...fields,fbKey:movKey,tipo:'comision',estado:'pendiente',gastoFbKey:gastoKey});
    await ensure('sisventas/gastos/'+gastoKey,{...fields,tipo:'Comisión',tipoPagable:'comision',origen:'comision',categoria:'Personal',medio:'Transferencia',empleadoId:emp.empleadoFbKey,estado:'pendiente_aprobacion',requiereAprobacion:true,mes:date.slice(0,7),fechaImputacion:date});
    let controlChanged=false;
    await tx(db.ref('sisventas/comisiones_generacion/'+movKey),current=>{controlChanged=false;if(current?.generacionServidorId!==job.generacionServidorId||current.monto!==emp.monto||current.pct!==emp.pct){controlChanged=true;return;}return {...current,estado:'completada'};});
    if(controlChanged)throw fail(409,'El control cambió. No se reemplazó ningún registro');
   }
   const saleRef=db.ref('sisventas/ventas/'+id);let changed=false;
   await tx(saleRef,current=>{changed=false;if(!current||M.hash(M.financialSource(current))!==M.hash(M.financialSource(initial.data.sale))){changed=true;return;}const audit=Object.values(current.audit||{});if(!audit.some(e=>e.generacionServidorId===job.generacionServidorId))audit.push({tipo:'comision_generada',generacionServidorId:job.generacionServidorId,fecha:new Date(job.creadoEn).toISOString(),usuario:job.actor.nombre,actorUid:job.actor.uid,accion:'Comisión automática generada · '+plan.participantes.length+' participante(s) · pendiente de aprobación'});return {...current,comisionesGeneradas:true,audit};});
   if(changed)throw fail(409,'La venta cambió. Las comisiones creadas se conservaron para revisión');
   await finish({estado:'completada',completadaEn:now()});return {status:'generada',participantes:plan.participantes,reutilizada:false};
  }catch(e){await finish({estado:e.statusCode===409?'revision':'error',ultimoError:e.statusCode===409?'Requiere conciliación':'Interrupción de guardado',reintentarEn:now()+60000}).catch(()=>{});throw e;}
 }
 async function systemGenerate(id){if(!enabled||!Number.isFinite(from)||from<=0)throw fail(503,'Falta configurar el corte de generación');return generate({uid:'servidor',name:'Servidor'},{ventaFbKey:id},{system:true});}
 async function retryPending(){const jobs=await read('sv_commission_generation')||{};for(const [id,job]of Object.entries(jobs))if(['error','procesando'].includes(job.estado)&&job.leaseUntil<now()&&Number(job.intentos)<5&&Number(job.reintentarEn||0)<=now())try{await systemGenerate(id);}catch(e){await tx(db.ref('sv_commission_generation/'+id),current=>current&&current.estado!=='completada'&&current.leaseUntil<=now()?{...current,estado:e.statusCode===409?'revision':current.estado,intentos:Math.max(Number(current.intentos),Number(job.intentos)+1),reintentarEn:now()+60000}:undefined).catch(()=>{});}}
 function start(){
  if(!enabled)return ()=>{};if(!Number.isFinite(from)||from<=0)throw Error('COMMISSION_GENERATION_FROM debe ser un instante ISO válido');
  const query=db.ref('sisventas/ventas').orderByChild('estadoPago').equalTo('pago_total'),connection=db.ref('.info/connected'),pending=new Set(),failed=new Map();
  // Solo salud y contadores: nunca referencias de ventas, nombres ni importes.
  const health={connected:false,subscriptionReady:false,completed:0,errors:0};
  const report=()=>logger({event:'commission_observer_status',at:new Date(now()).toISOString(),from:new Date(from).toISOString(),...health,pending:pending.size,retries:failed.size});
  const denied=()=>{health.subscriptionReady=false;health.errors++;report();};
  const connected=snap=>{health.connected=snap.val()===true;report();};
  const ready=()=>{if(!health.subscriptionReady){health.subscriptionReady=true;report();}};
  const handle=snap=>{
   // La consulta ya entrega la venta. Sin habilitación explícita el mismo
   // modelo siempre responde no_aplica; no volver a leer sus dependencias.
   // child_changed procesa una habilitación posterior y los reintentos sin
   // snapshot conservan la validación completa del servidor.
   const sale=typeof snap.val==='function'?snap.val():null;
   if(sale&&sale.comisionHabilitada!==true)return;
   if(pending.has(snap.key))return;pending.add(snap.key);systemGenerate(snap.key).then(result=>{failed.delete(snap.key);if(result.status==='generada'&&!result.reutilizada)health.completed++;}).catch(e=>{health.errors++;if(e.statusCode!==409)failed.set(snap.key,Number(failed.get(snap.key)||0)+1);}).finally(()=>pending.delete(snap.key));
  };
  connection.on('value',connected,denied);query.on('child_added',handle,denied);query.on('child_changed',handle,denied);query.on('value',ready,denied);
  const timer=setInterval(()=>{report();retryPending().catch(()=>{health.errors++;});for(const [key,count]of failed)if(count<5)handle({key});},60000);timer.unref?.();retryPending().catch(()=>{health.errors++;});
  return ()=>{clearInterval(timer);connection.off('value',connected);query.off('value',ready);query.off('child_added',handle);query.off('child_changed',handle);};
 }
 return {authorize,inspect,generate,start,systemGenerate,retryPending};
}
module.exports={createCommissionGeneration};
