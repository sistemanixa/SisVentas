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
 out.hasReceipt=!!(payment.comprobanteRef||payment.comprobanteAdjunto||payment.comprobante);return out;
}
function create({ownership,store}){
 if(!ownership?.authorize||!ownership.visibleRecordsByIds||!store?.read||!store.readAsUser)throw TypeError('Faltan puertos autorizados de historial de cobros.');
 const snapshot=createPaymentSnapshot({store,maxCandidates:1000});
 return {async load({req,actor,saleKey,record}){
  assertActor(actor);Index.recordKey(saleKey);if(!record||typeof record!=='object'||Array.isArray(record))throw fail('La venta ya no está disponible.',404);
  const observed=new Map(),authorized=new Map();
  const capture=(cache,path,read)=>{if(!cache.has(path))cache.set(path,Promise.resolve().then(read));return cache.get(path);};
  const scope={get:path=>capture(observed,path,()=>store.read(path)),getAsUser:path=>capture(authorized,path,()=>store.readAsUser(path,actor))};
  const image=await snapshot(scope,actor,[saleKey]),sale=image.sales[saleKey],original={...sale};
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
  const freshActor=await ownership.authorize(req,'ventas');assertActor(freshActor);
  if(binding(actor)!==binding(freshActor))throw fail('La sesión o los permisos cambiaron.');
  await pool([...observed],async([path,value])=>{if(digest(await value)!==digest(await store.read(path)))throw fail('La cobertura o las referencias de cobros cambiaron.');});
  await pool([...authorized],async([path,value])=>{if(digest(await value)!==digest(await store.readAsUser(path,freshActor)))throw fail('La fuente del cobro cambió.');});
  const finalActor=await ownership.authorize(req,'ventas');assertActor(finalActor);if(binding(actor)!==binding(finalActor))throw fail('La sesión o los permisos cambiaron.');
  const fresh=(await ownership.visibleRecordsByIds(finalActor,'ventas',[saleKey]))[saleKey];
  if(!fresh||digest(fresh)!==digest(record))throw fail('La propiedad o la venta cambió.');
  if(digest(Index.validateCoverage(await store.read(Index.COVERAGE_PATH)))!==digest(image.coverage))throw fail('La cobertura de cobros cambió.');
  if(!Number.isFinite(paidAmount)||paidAmount<0)throw fail('El saldo histórico requiere revisión.',503);
  return {record:fresh,paymentHistory:{schema:1,source,payments:payments.map(dto),paidAmount,complete:true}};
 }};
}
module.exports={create};
