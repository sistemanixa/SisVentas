'use strict';
// Confirmed physical movements may use only backed own reserves and General.
// Only physically confirmed, unbacked own units can retire an old own deficit;
// foreign assignments and their remaining discrepancy stay untouched. No marker
// grants authority; callers must supply original and proposed authoritative data.
const Money=require('./commercial-models/commercial-money.v1.js'),crypto=require('node:crypto');
const add=(...values)=>Money.quantitySum(values);
const fail=()=>Error('La diferencia histórica de reservas no permite este movimiento de stock.');
function key(v){if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw fail();return v;}
function object(v){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw fail();for(const k of Object.keys(v))key(k);return v;}
function q(v){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw fail();return add(v);}
function canonical(v){if(v===undefined)return 'undefined';if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
const equal=(a,b)=>canonical(a)===canonical(b),clone=v=>JSON.parse(JSON.stringify(v));
function normalizeAudits(v){const out=clone(v);for(const name of ['confirmacionesOT','regularizacionesOT']){if(out[name]==null)continue;object(out[name]);for(const [op,rows]of Object.entries(out[name])){if(!Array.isArray(rows))object(rows);const next={};for(const [k,audit]of Object.entries(rows)){if(Array.isArray(rows)&&audit===null)continue;key(k);object(audit);const normalized=/^(0|[1-9][0-9]*)$/.test(k)?'r'+k:k;if(Object.hasOwn(next,normalized))throw fail();next[normalized]=audit;}out[name][op]=next;}}return out;}
function ledger(v){object(v);for(const k of ['general','reservado','consumido'])q(v[k]);object(v.asignaciones||{});let reserved=0,consumed=0;for(const a of Object.values(v.asignaciones||{})){object(a);reserved=add(reserved,q(a.reservado??0));consumed=add(consumed,q(a.consumido??0));}if(consumed>v.consumido)throw fail();let installed=0,held=0;const grouped={};object(v.rendicionesOT||{});for(const [id,r]of Object.entries(v.rendicionesOT||{})){if(!/^[a-f0-9]{64}$/.test(id))throw fail();object(r);key(r.ot);key(r.venta);if(!Number.isSafeInteger(r.revision)||r.revision<1||add(q(r.deReserva??0),q(r.deGeneral??0))!==q(r.instalada))throw fail();installed=add(installed,r.instalada);held=add(held,q(r.enReserva??0));const t=grouped[r.venta]||{installed:0,held:0};t.installed=add(t.installed,r.instalada);t.held=add(t.held,q(r.enReserva??0));grouped[r.venta]=t;}if(installed>v.consumido||held>v.reservado)throw fail();for(const [id,t]of Object.entries(grouped)){const a=v.asignaciones?.[id];if(!a||t.installed>q(a.consumido??0)||t.held>q(a.reservado??0))throw fail();}return{reserved,consumed};}
function validate(input){
 const {otKey,actor,operationId,productKey}=input||{};
 if(!actor||!['admin','administrativo'].includes(actor.role)||actor.allowed!==true||actor.active===false||actor.viewAs===true||actor.viewing===true)throw fail();
 key(actor.uid);key(otKey);key(operationId);key(productKey);
 const changes=input.changes||[input];if(!Array.isArray(changes)||!changes.length||changes.length>100)throw fail();
 const before=normalizeAudits(object(input.before)),after=normalizeAudits(object(input.after)),lb=ledger(before),la=ledger(after),deficit=add(lb.reserved,-before.reservado);
 if(deficit<=0)throw fail();
 const initialDiscrepancy={kind:'reserved-total-existing',assignedReserved:lb.reserved,globalReserved:before.reservado,difference:deficit,corrected:false};
 const expected=clone(before),receipts=new Set(),rows=new Set();let delta=0,adopted=0,regularized=0,releasedOwn=0,remainingGeneral=before.general;
 for(const change of changes){
  const {allocation,receipt,beforeInstalled,targetInstalled,revision,rowKey}=change||{};key(allocation);key(rowKey);
  if(!/^[a-f0-9]{64}$/.test(receipt||'')||receipts.has(receipt)||rows.has(rowKey)||!Number.isSafeInteger(revision)||revision<0)throw fail();receipts.add(receipt);rows.add(rowKey);
  const bi=q(beforeInstalled),ti=q(targetInstalled),requested=add(ti,-bi);if((change.kind||'installation')==='installation'?requested<=0:requested!==0)throw fail();
  const old=before.rendicionesOT?.[receipt];
  // The former client may have committed consumption before losing its OT save.
  // Adoption is read-only for that receipt and needs its exact identity/revision.
  const rowIdentity=old&&(old.fila===rowKey||old.fila===undefined&&(change.sourceReceipt===receipt||change.legacyReceipt===receipt));
  const applied=(change.kind||'installation')==='installation'&&old&&old.ot===otKey&&old.venta===allocation&&rowIdentity&&old.instalada===ti&&old.revision===revision+1;
  if(applied){if(!equal(after.rendicionesOT?.[receipt],old))throw fail();adopted++;continue;}
  if(old&&(old.ot!==otKey||old.venta!==allocation||old.fila!==undefined&&old.fila!==rowKey||old.instalada!==bi||old.revision!==revision))throw fail();if(!old&&bi!==0)throw fail();

  const kind=change.kind||'installation';if(!['installation','delivery'].includes(kind))throw fail();
  const current=expected.asignaciones?.[allocation],ownReserved=q(current?.reservado??0),ownConsumed=q(current?.consumido??0);
  let assignedReserved=0,receiptHeld=0;for(const a of Object.values(expected.asignaciones||{}))assignedReserved=add(assignedReserved,q(a.reservado??0));for(const r of Object.values(expected.rendicionesOT||{}))receiptHeld=add(receiptHeld,q(r.enReserva??0));
  const previousReceipt=expected.rendicionesOT?.[receipt],oldHeld=q(previousReceipt?.enReserva??0),foreignReserved=add(assignedReserved,-ownReserved);
  const held=q(change.heldByOthers??0);if(held>ownReserved)throw fail();
  const unreceiptedBacking=Math.max(0,add(expected.reservado,-foreignReserved,-held));
  const receiptedBacking=Math.min(oldHeld,Math.max(0,add(expected.reservado,-receiptHeld,oldHeld)));
  const proposed=after.rendicionesOT?.[receipt];if(!proposed)throw fail();
  let reserve=0,generalNeeded=0,reservedAdded=0,ownReservationReleased=0;
  if(kind==='installation'){
   reserve=Math.min(requested,Math.max(0,add(ownReserved,-held)),Math.max(unreceiptedBacking,receiptedBacking));
   generalNeeded=add(requested,-reserve);
   ownReservationReleased=Math.min(generalNeeded,Math.max(0,add(ownReserved,-held,-reserve)),add(assignedReserved,-expected.reservado));
  }else{
   const bd=q(change.beforeDelivered),td=q(change.targetDelivered),returned=q(change.returned??0);
   if(ti!==bi||td<=bd||add(ti,returned)>bd||held>ownReserved)throw fail();
   const required=add(td,-ti,-returned),available=Math.min(Math.max(0,add(ownReserved,-held)),Math.max(unreceiptedBacking,receiptedBacking));
   reservedAdded=Math.max(0,add(required,-available));generalNeeded=reservedAdded;
   ownReservationReleased=Math.min(reservedAdded,Math.max(0,add(ownReserved,-held,-available)),add(assignedReserved,-expected.reservado));
  }
  releasedOwn=add(releasedOwn,ownReservationReleased);
  const expectedAssignment={...(current||{reservado:0,consumido:0,liberado:0}),reservado:add(ownReserved,reservedAdded,-reserve,-ownReservationReleased),consumido:add(ownConsumed,kind==='installation'?requested:0)};
  expected.asignaciones??={};expected.asignaciones[allocation]=expectedAssignment;expected.reservado=add(expected.reservado,reservedAdded,-reserve);
  const expectedReceipt={...(old||{revision,instalada:0,deReserva:0,deGeneral:0,enReserva:0,ot:otKey,venta:allocation,fila:rowKey}),revision:revision+1,instalada:ti,deReserva:add(q(old?.deReserva??0),reserve),deGeneral:add(q(old?.deGeneral??0),kind==='installation'?generalNeeded:0),enReserva:kind==='delivery'?add(q(change.targetDelivered),-ti,-q(change.returned??0)):Math.max(0,add(oldHeld,-reserve))};
  if(!equal(proposed,expectedReceipt))throw fail();expected.rendicionesOT??={};expected.rendicionesOT[receipt]=expectedReceipt;
  const rowRegularization=Math.max(0,add(generalNeeded,-remainingGeneral));remainingGeneral=Math.max(0,add(remainingGeneral,-generalNeeded));
  const stepDeficit=add(assignedReserved,-expected.reservado,reservedAdded,-reserve);
  const discrepancy=stepDeficit>0?{kind:'reserved-total-existing',assignedReserved,globalReserved:add(expected.reservado,-reservedAdded,reserve),difference:stepDeficit,corrected:false}:undefined;
  if(ownReservationReleased>0)Object.assign(discrepancy,{corrected:true,ownReservationReleased});
  const auditKey='r'+rowKey,audit=after.confirmacionesOT?.[operationId]?.[auditKey],auditFields=['signature','receipt','revision','regularization','kind','producto','ot','fila','venta','autor','nombre','fecha','motivo','stockDiscrepancy'];
  if(before.confirmacionesOT?.[operationId]?.[auditKey]||!audit||Object.keys(audit).some(k=>!auditFields.includes(k))||audit.kind!==kind||audit.producto!==productKey||audit.ot!==otKey||audit.fila!==rowKey||audit.venta!==allocation||audit.autor!==actor.uid||audit.receipt!==receipt||audit.revision!==revision+1||audit.regularization!==rowRegularization||!equal(audit.stockDiscrepancy,discrepancy)||!/^[a-f0-9]{64}$/.test(audit.signature||'')||!Number.isSafeInteger(audit.fecha)||audit.fecha<=0||typeof audit.nombre!=='string'||typeof audit.motivo!=='string')throw fail();key(audit.producto);
  expected.confirmacionesOT??={};expected.confirmacionesOT[operationId]??={};expected.confirmacionesOT[operationId][auditKey]=audit;if(rowRegularization>0){expected.regularizacionesOT??={};expected.regularizacionesOT[operationId]??={};expected.regularizacionesOT[operationId][auditKey]=clone(audit);}delta=add(delta,kind==='installation'?requested:0);regularized=add(regularized,rowRegularization);
 }
 if(after.general!==remainingGeneral||after.consumido!==add(before.consumido,delta)||add(la.reserved,-after.reservado)!==add(deficit,-releasedOwn))throw fail();
 expected.general=after.general;expected.consumido=after.consumido;
 if(Object.hasOwn(after,'_svReadRevision')){const oldRevision=before._svReadRevision??0;if(!Number.isSafeInteger(oldRevision)||oldRevision<0||!Number.isSafeInteger(after._svReadRevision)||![oldRevision,oldRevision+1].includes(after._svReadRevision))throw fail();if(after._svReadRevision===oldRevision+1){if(after._svReadOperation!==operationId)throw fail();expected._svReadOperation=operationId;}expected._svReadRevision=after._svReadRevision;}
 if(!equal(after._svReadOperation,before._svReadOperation)&&!(after._svReadOperation===operationId&&after._svReadRevision===(before._svReadRevision??0)+1))throw fail();
 if(!equal(expected,after))throw fail();
 return Object.freeze({allowed:true,delta,adopted,regularized,reservedDeficit:deficit,discrepancy:Object.freeze(initialDiscrepancy),beforeHash:crypto.createHash('sha256').update(canonical(before)).digest('hex'),afterHash:crypto.createHash('sha256').update(canonical(after)).digest('hex')});
}
module.exports=Object.freeze({validate});
