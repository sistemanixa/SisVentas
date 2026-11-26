'use strict';
const {createPaymentSnapshot,pool}=require('./payment-snapshot');
const Index=require('./payment-membership-index'),Matcher=require('./payment-membership-matcher');
const {digest}=require('./labor-guard'),Money=require('./commercial-models/commercial-money');
const fail=(message,statusCode=409)=>Object.assign(Error(message),{statusCode,code:'SV_COMMERCIAL_PAYMENT_HISTORY_CHANGED'});
const binding=a=>digest({uid:a?.uid,realUid:a?.realUid,role:a?.role,domain:a?.domain,viewing:a?.viewing,claims:a?.claims,permissionRevision:a?.permissionRevision,permissionDigest:a?.permissionDigest});
function assertActor(actor){if(!actor?.uid||actor.claims?.uid!==actor.uid||actor.viewing||actor.realUid!==actor.uid||actor.domain!=='ventas')throw fail('Esta consulta requiere la cuenta propia autorizada.',403);}
const active=p=>!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado';
function amount(value){const n=Number(value);if(!['number','string'].includes(typeof value)||typeof value==='string'&&!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())||!Number.isFinite(n)||n<0)throw fail('El importe del cobro requiere revisión.',503);return n;}
function dto(payment){
 const out={};for(const key of ['fbKey','id','monto','fecha','medio','nota','anulado','estado']){const v=payment[key];if(v===null||['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v))out[key]=v;}
 if(out.nota===undefined){const note=payment.obs??payment.referencia??payment.ref;if(typeof note==='string')out.nota=note;}
 out.monto=amount(payment.monto);
 out.hasReceipt=!!(payment.comprobanteRef||payment.comprobanteAdjunto||payment.comprobante||(payment.comprobanteCuenta&&(payment.grupoPago||payment.pagoCuentaGrupo)));return out;
}
function create({ownership,store,observe}){
 if(!ownership?.authorize||!ownership.consumeAuthorizedRecordRead||!ownership.readAuthorizedRecordsByIds||!store?.read||!store.readAsUser)throw TypeError('Faltan puertos autorizados de historial de cobros.');
 const snapshot=createPaymentSnapshot({store,maxCandidates:1000});
 return {async load({req,actor,saleKey,record}){
  const started=performance.now(),timings=Object.create(null);
  const measure=async(name,work)=>{const began=performance.now();try{return await work();}finally{timings[name]=(timings[name]||0)+performance.now()-began;}};
  const timedStore={...store,read:path=>measure('serviceReadMs',()=>store.read(path)),readAsUser:(path,user)=>measure('userReadMs',()=>store.readAsUser(path,user))};
  try {
  assertActor(actor);Index.recordKey(saleKey);if(!record||typeof record!=='object'||Array.isArray(record))throw fail('La venta ya no está disponible.',404);
  const originalRead=ownership.consumeAuthorizedRecordRead(actor,'ventas',saleKey,record);
  const observed=new Map(),authorized=new Map([[originalRead.path,Promise.resolve(originalRead.record)]]);
  const capture=(cache,path,read)=>{if(!cache.has(path))cache.set(path,Promise.resolve().then(read));return cache.get(path);};
  const scope={get:path=>capture(observed,path,()=>store.read(path)),getAsUser:path=>capture(authorized,path,()=>timedStore.readAsUser(path,actor))};
  // Independent point reads share only this request's image. Start together;
  // the snapshot still validates coverage, membership and user visibility.
  await Promise.allSettled([scope.get(Index.COVERAGE_PATH),scope.getAsUser('sisventas/ventas/'+saleKey)]).then(results=>{const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;});
  const image=await measure('snapshotMs',()=>snapshot(scope,actor,[saleKey])),sale=image.sales[saleKey],original={...sale};
  if(!Object.hasOwn(record,'fbKey'))delete original.fbKey;
  if(digest(original)!==digest(record))throw fail('La venta cambió durante la consulta.');
  const global=image.bySale[saleKey];if(global.some(p=>!Matcher.belongsToSale(p,sale)))throw fail('La pertenencia del cobro requiere revisión.',503);
  let source='global',payments=global;
  if(!global.length){
   payments=Array.isArray(record.pagos)?record.pagos.filter(p=>p&&typeof p==='object'&&!Array.isArray(p)):[];
   for(const p of payments){const refs=Matcher.paymentReferences(p);if((refs.technical.length||refs.businessExact.length)&&!Matcher.belongsToSale(p,sale))throw fail('El cobro embebido pertenece a otra venta.',503);}
   source=payments.length?'embedded':'legacy';
  }
  const paidAmount=source==='legacy'?amount(record.totalPagado||record.pagado||record.montoPagado||0):Money.sum(payments.filter(active).map(p=>amount(p.monto)));
  // Reauthenticate, reread ownership and every observed source/bucket. No lease,
  // write capability, cross-request cache or service read substitutes a user read.
  // The route has authenticated before reading. Reauthenticate after all source
  // checks below, rather than duplicating that same check midway through a GET.
  // User reads still use the captured actor; no response precedes final access.
  const checks=[
   ...[...observed].filter(([path])=>path!==Index.COVERAGE_PATH).map(([path,value])=>async()=>{if(digest(await value)!==digest(await timedStore.read(path)))throw fail('La cobertura o las referencias de cobros cambiaron.');}),
   ...[...authorized].map(([path,value])=>async()=>{if(digest(await value)!==digest(await timedStore.readAsUser(path,actor)))throw fail('La fuente del cobro cambió.');})
  ];
  // pool bounds concurrency and waits for its workers before propagating errors.
  await measure('sourceValidationMs',()=>pool(checks,work=>work()));
  const finalActor=await measure('finalAuthorizationMs',()=>ownership.authorize(req,'ventas'));assertActor(finalActor);if(binding(actor)!==binding(finalActor))throw fail('La sesión o los permisos cambiaron.');
  const fresh=(await measure('finalOwnershipMs',()=>ownership.readAuthorizedRecordsByIds(finalActor,'ventas',[saleKey])))[saleKey];
  if(!fresh||digest(fresh)!==digest(record))throw fail('La propiedad o la venta cambió.');
  if(digest(Index.validateCoverage(await timedStore.read(Index.COVERAGE_PATH)))!==digest(image.coverage))throw fail('La cobertura o las referencias de cobros cambiaron.');
  if(!Number.isFinite(paidAmount)||paidAmount<0)throw fail('El saldo histórico requiere revisión.',503);
  return {record:fresh,paymentHistory:{schema:1,source,payments:payments.map(dto),paidAmount,complete:true}};
  } finally {
   const totalMs=Math.round(performance.now()-started),report={event:"sale_payment_history_performance",totalMs,...Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,Math.round(v)]))};
   try{if(observe)observe(report);else if(totalMs>=1000)console.info(JSON.stringify(report));}catch(_){}
  }
 }};
}
module.exports={create};
