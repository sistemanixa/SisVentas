'use strict';
const {digest,parts}=require('./labor-guard'),Money=require('./commercial-models/commercial-money'),Calc=require('./commission-calculations'),Model=require('./bonus-payment-model');
const {allowed,resolveExpenseMovement,mapPayments,describe,paymentTotal}=require('./bonus-payment');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode,code:statusCode===409?'SV_CAS_CONFLICT':statusCode===403?'SV_BONUS_PAYMENT_DENIED':'SV_EXPENSE_PAYMENT_INVALID'});
const same=(a,b)=>digest(a??null)===digest(b??null),copy=v=>structuredClone(v);
function validKey(v){return typeof v==='string'&&v.length>0&&v.length<=768&&!['__proto__','prototype','constructor'].includes(v)&&parts(v).length===1;}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function request(body){
 if(!body||Object.keys(body).some(k=>!['id','key','paymentKey','expectedHash','action','reason','changes'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!validKey(body.key)||!validKey(body.paymentKey)||!/^[a-f0-9]{64}$/.test(body.expectedHash||'')||!['edicion','anulacion'].includes(body.action)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>2000)throw fail(400,'Revisá el pago y el motivo de la corrección');
 const c=body.changes;
 if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['monto','fecha','medio','comprobante'].includes(k)))throw fail(400,'Corrección inválida');
 if(body.action==='anulacion'&&Object.keys(c).length)throw fail(400,'La anulación conserva los datos del pago');
 if(body.action==='edicion'){
  if(!Money.isAmount(c.monto)||!(c.monto>0)||!validDate(c.fecha)||typeof c.medio!=='string'||!c.medio.trim()||c.medio.length>160)throw fail(400,'Revisá importe, fecha y medio');
  if(c.comprobante!=null)describe({id:body.id,items:[{key:body.key,monto:c.monto,expectedHash:body.expectedHash}],medio:c.medio,comprobante:c.comprobante});
 }
 return copy(body);
}
function createExpensePaymentAdjustment({authorize,guard,store,enabled=false,now=Date.now}){
 async function access(actor,read){
  if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
  const profile=await read('sv_chat_roles/'+actor.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid);
  if(actor.claims.svPasswordChangeRequired||reset?.required||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail(403,'Volvé a iniciar sesión');
  return allowed(profile,cfg,['administrar','corregirPago']);
 }
 async function execute(actor,input){
  if(!enabled)throw fail(503,'La corrección no está disponible');
  const body=request(input),captured=await access(actor,p=>store.read(p));
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'command',role:captured.role,permissionRevision:captured.permissionRevision,permissionDigest:captured.permissionDigest,opId:body.id,transportDigest:digest(body),recoverReceipt:true,operation:'expense-payment-adjustment',input:body},async scope=>{
   if(!same(await access(actor,p=>scope.get(p)),captured))throw fail(409,'Los permisos cambiaron');
   const path='sisventas/gastos/'+body.key,g=await scope.get(path),visible=await store.readAsUser(path,actor);
   if(!g||!same(g,visible)||!Model.isPayableExpense(g)||digest(Model.revisionData(g))!==body.expectedHash)throw fail(409,'El gasto cambió. Volvé a abrir el pago');
   const payments=Array.isArray(g.pagos)?copy(g.pagos):mapPayments(g.pagos),old=payments[body.paymentKey];
   if(!old||Calc.pagoGastoEstaAnulado?.(old)||old.anulado||String(old.estado||'').toLowerCase()==='anulado')throw fail(409,'El pago ya no está disponible');
   const resolved=await resolveExpenseMovement(g,body.key,scope),m=resolved.movement;
   if(m&&(Number(m.monto)!==Number(g.monto)||!same(m.pagos||{},g.pagos||{})||!same(m.periodoComputo??null,g.periodoComputo??null)||paymentTotal(m)!==paymentTotal(g)))throw fail(409,'El historial vinculado requiere revisión');
   const ts=now(),actorName=captured.name||actor.claims.name||'Usuario autorizado',changes=body.action==='anulacion'?{anulado:true,estado:'anulado',anuladoTs:ts,anuladoPor:actorName,motivoAnulacion:body.reason}:{monto:body.changes.monto,fecha:body.changes.fecha,medio:body.changes.medio,editadoTs:ts,editadoPor:actorName,motivoEdicion:body.reason};
   const snapshots=new Map(resolved.snapshots),patch={},full=body.changes.comprobante;
   if(full){changes.comprobante={nombre:full.nombre,tipo:full.tipo,externo:true};const p='sisventas/gastos_adjuntos/'+body.key+'/pagos/'+body.paymentKey+'/comprobanteData';snapshots.set(p,await scope.get(p));patch[p]=full.data;}
   payments[body.paymentKey]={...old,...changes};
   const active=Object.values(payments).filter(p=>!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado');
   const paid=Money.sum([Number(g.saldoPagadoLegacy)||0,...active.map(p=>Number(p.monto))]);
   if(!Money.isAmount(paid)||paid<0||paid>Number(g.monto)||m&&paid<Number(m.montoCompensado||0))throw fail(409,'La corrección excede el saldo o afecta una compensación');
   const state=paid===Number(g.monto)?'pagado':paid>0?'pagado_parcial':'pendiente_pago',last=active.slice().sort((a,b)=>(b.ts||0)-(a.ts||0))[0]||{};
   const next={...copy(g),pagos:payments,montoPagado:paid,estado:state,reembolsado:state==='pagado'};if(last.medio)next.medio=last.medio;
   patch[path]=next;snapshots.set(path,g);
   if(m){patch[resolved.path]={...copy(m),pagos:copy(payments),montoPagado:paid,estado:paid?state:'aprobado',fechaPago:last.fecha||null,medioPago:last.medio||null};}
   const auditPath='sisventas/auditoria_pagos/ajuste_'+body.id;
   if(await scope.get(auditPath)!==null)throw fail(409,'La corrección ya existe');snapshots.set(auditPath,null);
   patch[auditPath]={accion:body.action,gastoFbKey:body.key,pagoKey:body.paymentKey,anterior:copy(old),nuevo:copy(payments[body.paymentKey]),motivo:body.reason,usuario:actorName,rol:captured.role,ts};
   if(old.lotePagoKey){if(!validKey(old.lotePagoKey))throw fail(409,'El lote requiere revisión');const p='sisventas/pagos_realizados/'+old.lotePagoKey+'/ajustes/ajuste_'+body.id;if(await scope.get(p)!==null)throw fail(409,'El ajuste del lote ya existe');snapshots.set(p,null);patch[p]={accion:body.action,gastoFbKey:body.key,pagoKey:body.paymentKey,motivo:body.reason,usuario:actorName,ts};}
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{if(!same(await access(actor,readFresh),captured)||!same(await readFreshAsUser(path),g))throw fail(409,'El gasto o los permisos cambiaron');for(const [p,v]of snapshots)if(!same(await readFresh(p),v))throw fail(409,'El historial cambió durante la corrección');});
   await scope.update(patch);return {ok:true,committed:true};
  });
  if(!result?.committed)throw fail(409,'No se confirmó la corrección');
  if(!same(await access(actor,p=>store.read(p)),captured))throw fail(409,'La corrección quedó confirmada. Actualizá Gastos');
  const g=await store.readAsUser('sisventas/gastos/'+body.key,actor);if(!g)throw fail(403,'Actualizá Gastos para ver el resultado');
  return {ok:true,committed:true,key:body.key,update:{pagos:g.pagos,montoPagado:g.montoPagado,estado:g.estado,reembolsado:g.reembolsado,medio:g.medio||''}};
 }
 return {authorize,execute};
}
module.exports={createExpensePaymentAdjustment,request};
