'use strict';
const {digest}=require('./labor-guard');
const Index=require('./payment-membership-index');
const {createPaymentSnapshot}=require('./payment-snapshot');
const Sales=require('./commercial-models/sales-read-model');
const {validate:validateJSON}=require('./labor-write-gateway');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const money=value=>Math.round((parseFloat(value)||0)*100)/100;
const validPayment=p=>!!p&&!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado';
const validSale=s=>!!s&&s.anulada!==true&&!['anulada','cancelada','cancelado'].includes(String(s.estado||s.estadoPago||'').toLowerCase());
function embedded(sale){return (Array.isArray(sale.pagos)?sale.pagos:[]).filter(validPayment);}
function paid(sale,related){
 // Deliberately preserve the registration contract from the published client.
 // Annul uses a different legacy/embedded policy below. An index optimization
 // must not silently rewrite historical accounting decisions.
 const selected=related.filter(validPayment);
 return selected.length?selected.reduce((n,p)=>n+(parseFloat(p.monto)||0),0):parseFloat(sale.totalPagado||sale.pagado||sale.montoPagado)||0;
}
function summary(sale,related){const total=Sales.saleTotal(sale),selected=related.length?related.filter(validPayment):embedded(sale),raw=selected.reduce((n,p)=>n+(parseFloat(p.monto)||0),0),amount=money(raw);return {total,pagado:Math.min(total>0?total:raw,amount),estadoPago:total>0&&raw>=total-.01?'pago_total':raw>0?'seniado':'pendiente_pago'};}
function publicFields(record,fields){
 const out={};for(const field of fields){const value=record?.[field];if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))out[field]=value;}return out;
}
function collectionResult(payment,sale,saleKey,collectionOperation){
 // Collection permission never grants the caller the commercial document.
 const venta=publicFields(sale,['id','idOriginal','numeroOriginal','ventaIdOriginal','numero','ventaId','idVenta','nro','codigo','ventaFbKey','ventaKey','cliente','clienteFbKey','clienteKey','clienteId','idCliente','direccion','dir','direccionInstalacion','totalPagado','pagado','montoPagado','estadoPago','comisionHabilitada']);
 venta.fbKey=saleKey;venta.total=Sales.saleTotal(sale);if(collectionOperation)venta.cobroOperacionId=collectionOperation;
 const pago=publicFields(payment,['fbKey','id','venta','ventaId','ventaFbKey','ventaKey','cliente','clienteFbKey','clienteKey','clienteId','fecha','monto','totalVenta','saldoAnterior','saldoRestante','medio','referencia','ref','obs','usuario','ts','origen','grupoPago','pagoGrupoTotal','imputacionOrden','imputacionesTotal','moneda','montoOriginal','montoUSD','tipoCambio','cotizacionTipo','cotizacionReferencia','cotizacionEditada','cotizacionFuenteFecha','comprobanteRef','anulado','estado','anuladoFecha','anuladoPor','anuladoMotivo']);
 if(record(payment?.comprobanteAdjunto))pago.comprobanteAdjunto=publicFields(payment.comprobanteAdjunto,['nombre','tipo','ts','refKey']);
 return {pago,venta};
}
function createPaymentCommands({authorize,db,guard,store,enabled=false,now=Date.now}={}){
 if(typeof authorize!=='function'||!guard?.run||!store?.readAsUser)throw TypeError('Falta el circuito de cobros');
 const load=createPaymentSnapshot({store,financialSales:true});
 async function access(scope,actor,action){
  const identity=await scope.get('sv_chat_roles/'+actor.uid);
  if(identity?.activo!==true||!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(identity.rol))throw fail(403,'Usuario sin acceso');
  const config=await scope.get('sv_permisos/'+identity.rol)||{},blocked=Object.values(config.bloqueados||{});
  if(blocked.includes('cobranzas')||(Object.keys(config).length&&(config.indiceVersion!==2||config.indiceModulos?.cobranzas!==true)))throw fail(403,'Sin permiso para registrar cobros');
  const granted=config.acciones?.cobranzas?.[action];
  const defaults=action==='anular'?['admin']:['admin','administrativo'];
  if(typeof granted==='boolean'?!granted:!defaults.includes(identity.rol))throw fail(403,action==='anular'?'Sin permiso para anular cobros':'Sin permiso para registrar cobros');
  return {name:identity.nombre||actor.claims.name||actor.uid,role:identity.rol,permissionRevision:config.indiceRevision??null,permissionDigest:digest(config)};
 }
 function validate(body){
  if(!record(body)||Object.keys(body).some(k=>!['id','kind','opciones','pagoKey','ventaKey','motivo','fecha'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!['registrar','anular'].includes(body.kind))throw fail(400,'Solicitud de cobro inválida');
  validateJSON(body);
  if(Buffer.byteLength(JSON.stringify(body))>4*1024*1024)throw fail(413,'El comprobante supera el tamaño permitido');
  if(body.kind!=='registrar'){Index.recordKey(body.pagoKey);Index.recordKey(body.ventaKey);return;}
  const o=body.opciones;
  if(!record(o)||!Array.isArray(o.solicitudes)||!o.solicitudes.length||o.solicitudes.length>100)throw fail(400,'No hay ventas válidas para imputar el cobro');
  Index.recordKey(o.grupoPago);if(o.adjuntoKey)Index.recordKey(o.adjuntoKey);
  const sales=new Set(),keys=new Set();
  for(const s of o.solicitudes){
   if(!record(s)||!record(s.pago||{})||!Number.isFinite(Number(s.monto??s.pago?.monto))||!(Number(s.monto??s.pago?.monto)>0))throw fail(400,'Importe del cobro inválido');
   Index.recordKey(s.ventaFbKey);Index.recordKey(s.pagoKey||s.pago?.fbKey);
   if(s.pago?.anulado||String(s.pago?.estado||'').toLowerCase()==='anulado'||['ventaGeneradaFbKey','ventaOrigenFbKey'].some(k=>s.pago?.[k]&&String(s.pago[k]).trim()!==s.ventaFbKey))throw fail(400,'El nuevo cobro tiene una relación o estado inválido');
   if(sales.has(s.ventaFbKey)||keys.has(s.pagoKey||s.pago?.fbKey))throw fail(400,'Hay ventas o imputaciones repetidas en el cobro');
   sales.add(s.ventaFbKey);keys.add(s.pagoKey||s.pago?.fbKey);
  }
  if(o.comprobante!=null&&(!record(o.comprobante)||typeof o.comprobante.data!=='string'||!/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=\r\n]+$/.test(o.comprobante.data)))throw fail(400,'Comprobante inválido');
 }
 async function hydrate(actor,result,captured,action,operationId){
  // Receipt recovery returns a current, internally consistent view. Payment
  // sequence brackets the exact reads; a sale-only edit is checked separately.
  // No financial operation is replayed and no hydration receipt is written.
  for(let attempt=0;attempt<3;attempt++){
   const before=Index.validateCoverage(await store.read(Index.COVERAGE_PATH)),out=[],saleDigests=[];
   for(const link of result.links||[]){
    const payment=await store.readAsUser('sisventas/pagos/'+link.pagoKey,actor),sale=await store.read('sisventas/ventas/'+link.ventaKey);
    if(!payment||!sale)throw fail(409,'El cobro está confirmado, pero su venta o registro ya no está disponible');
    saleDigests.push(digest(sale));out.push(collectionResult({...payment,fbKey:link.pagoKey},sale,link.ventaKey,action==='registrar'?operationId:undefined));
   }
   let changed=false;
   for(let i=0;i<(result.links||[]).length;i++){
    const link=result.links[i],sale=await store.read('sisventas/ventas/'+link.ventaKey);
    if(digest(sale)!==saleDigests[i]){changed=true;break;}
   }
   const after=Index.validateCoverage(await store.read(Index.COVERAGE_PATH));
   if(!changed&&digest(before)===digest(after)){
    const current=await access({get:path=>store.read(path)},actor,action);
    if(current.role!==captured.role||current.permissionDigest!==captured.permissionDigest||current.permissionRevision!==captured.permissionRevision)throw fail(403,'Los permisos del cobro cambiaron');
    return {...result,resultados:out,replayed:true,currentView:true};
   }
  }
  throw fail(409,'El cobro está confirmado y su vista cambió. Volvé a consultar la operación.');
 }
 async function execute(actor,body){
  if(!enabled)throw fail(503,'El nuevo circuito de cobros todavía no está habilitado','SV_PAYMENTS_NOT_ENABLED');
  if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
  validate(body);
  // Also recheck before receipt recovery, whose callback is intentionally not
  // executed a second time. Current read permission alone is not an action grant.
  const captured=await access({get:async path=>(await db.ref(path).get()).val()},actor,body.kind);
  let confirmedRows;
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'user',role:captured.role,permissionRevision:captured.permissionRevision,permissionDigest:captured.permissionDigest,financialAction:'cobranzas.'+body.kind,opId:body.id,transportDigest:digest(body),operation:'payment-'+body.kind,input:body},async scope=>{
   const person=await access(scope,actor,body.kind),kind=body.kind;
   if(person.role!==captured.role||person.permissionRevision!==captured.permissionRevision||person.permissionDigest!==captured.permissionDigest)throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
   if(kind==='registrar'){
    const o=body.opciones,group='sisventas/cobros_grupos/'+o.grupoPago;
    if(await scope.get(group))throw fail(409,'La referencia del cobro ya existe. Revisá la operación antes de volver a guardar.','SV_PAYMENT_GROUP_EXISTS');
    const snapshot=await load(scope,actor,o.solicitudes.map(s=>s.ventaFbKey)),patch=Object.create(null),links=[],paymentKeys=Object.create(null),rows=[];
    const totalRequested=money(o.solicitudes.reduce((n,s)=>n+money(s.monto??s.pago?.monto),0));
    if(o.montoTotal!=null&&Math.abs(money(o.montoTotal)-totalRequested)>.009)throw fail(400,'Las imputaciones no coinciden con el total recibido');
    const attachmentKey=o.comprobante?String(o.adjuntoKey||o.grupoPago):'',meta=o.comprobante?{nombre:String(o.comprobante.nombre||'Comprobante'),tipo:String(o.comprobante.tipo||''),ts:Number(o.comprobante.ts)||now(),refKey:attachmentKey}:null;
    for(let i=0;i<o.solicitudes.length;i++){
     const s=o.solicitudes[i],key=s.ventaFbKey,sale=snapshot.sales[key],paymentKey=s.pagoKey||s.pago.fbKey;
     if(!validSale(sale))throw fail(409,'La venta '+(sale.id||s.ventaId||'')+' ya no está disponible para cobrar');
     const total=Sales.saleTotal(sale),prior=paid(sale,snapshot.bySale[key]),available=Math.max(0,money(total-prior)),amount=money(s.monto??s.pago?.monto);
     if(!(amount>0)||amount>available+.009)throw fail(409,'El saldo de '+(sale.id||s.ventaId||'')+' cambió. Revisá la imputación antes de reintentar.','SV_PAYMENT_BALANCE_CHANGED');
     if(await scope.get('sisventas/pagos/'+paymentKey))throw fail(409,'La clave del cobro ya existe sin una operación confirmada','SV_PAYMENT_KEY_EXISTS');
     const nextPaid=money(prior+amount),payment={...(s.pago||{}),fbKey:paymentKey,venta:String(sale.id||s.ventaId||key),ventaId:String(sale.id||s.ventaId||key),ventaFbKey:key,ventaKey:key,monto:amount,totalVenta:total,saldoAnterior:available,saldoRestante:Math.max(0,money(total-nextPaid)),origen:String(o.origen||'cobranzas'),grupoPago:o.grupoPago,pagoGrupoTotal:totalRequested,imputacionOrden:i+1,imputacionesTotal:o.solicitudes.length};
     if(meta){payment.comprobanteAdjunto=meta;payment.comprobanteRef=attachmentKey;}
     patch['sisventas/pagos/'+paymentKey]=payment;
     patch['sisventas/ventas/'+key+'/totalPagado']=nextPaid;patch['sisventas/ventas/'+key+'/estadoPago']=nextPaid>=total-.01?'pago_total':'seniado';
     paymentKeys[paymentKey]=true;links.push({pagoKey:paymentKey,ventaKey:key});
     rows.push(collectionResult(payment,{...sale,totalPagado:nextPaid,estadoPago:patch['sisventas/ventas/'+key+'/estadoPago']},key,body.id));
    }
    patch[group]={...(o.cabecera||{}),grupoPago:o.grupoPago,origen:String(o.origen||'cobranzas'),monto:totalRequested,pagoKeys:paymentKeys,adjuntoKey:attachmentKey,cantidadImputaciones:links.length,usuario:o.usuario||person.name,ts:Number(o.ts)||now(),commandId:body.id,commandDigest:digest(body)};
    if(o.comprobante){const attachment='sisventas/cobros_adjuntos/'+attachmentKey;if(await scope.get(attachment))throw fail(409,'La referencia del comprobante ya está ocupada');patch[attachment]=o.comprobante;}
    await scope.update(patch);confirmedRows=rows;return {ok:true,committed:true,grupoPago:o.grupoPago,links};
   }
   const snapshot=await load(scope,actor,[body.ventaKey]),sale=snapshot.sales[body.ventaKey],payment=snapshot.payments[body.pagoKey];
   if(!payment||!Index.belongsToSale(payment,sale))throw fail(409,'No se pudo identificar la venta de este cobro');
   const next={...payment,anulado:true,estado:'anulado',anuladoFecha:String(body.fecha||new Date(now()).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})),anuladoPor:person.name,anuladoMotivo:String(body.motivo||'').slice(0,2000)};
   const related=snapshot.bySale[body.ventaKey].map(p=>p.fbKey===body.pagoKey?next:p);
   const totals=summary(sale,related),patch={['sisventas/pagos/'+body.pagoKey]:next,['sisventas/ventas/'+body.ventaKey+'/totalPagado']:totals.pagado,['sisventas/ventas/'+body.ventaKey+'/estadoPago']:totals.estadoPago};
   await scope.update(patch);confirmedRows=[collectionResult(next,{...sale,totalPagado:totals.pagado,estadoPago:totals.estadoPago},body.ventaKey)];return {ok:true,committed:true,links:[{pagoKey:body.pagoKey,ventaKey:body.ventaKey}]};
  });
  if(confirmedRows)return {...result,resultados:confirmedRows,replayed:false};
  try{return await hydrate(actor,result,captured,body.kind,body.id);}
  catch(_){throw fail(503,'El cobro se guardó, pero no se pudo recuperar su resultado. Consultá la operación antes de repetirlo.','SV_LABOR_COMMIT_UNCONFIRMED');}
 }
 return {authorize,execute,capability:()=>enabled};
}
module.exports={createPaymentCommands,collectionResult,paid,summary,validPayment,validSale};
