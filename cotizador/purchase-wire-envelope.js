'use strict';
// Reconstruct only server-owned purchase envelopes. Never accept a
// caller digest or a flag as evidence of the relationship to the wire request.
const {digest}=require('./labor-guard');
const {byOperation}=require('./purchase-route-contract');
const fail=()=>Object.assign(Error('La solicitud de compra no coincide con su representación interna.'),{statusCode:403,code:'SV_PURCHASE_WIRE_BOUND'});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const key=value=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=768&&!['constructor','prototype','__proto__'].includes(value)&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(value)&&key(value);
function wireFor(actor){
 if(!actor||!key(actor.uid)||actor.claims?.uid!==actor.uid||!id(actor.opId)||actor.input?.id!==actor.opId)throw fail();
 const input=actor.input;
 if(actor.operation==='purchase-preparation-save'){
  const required=['id','kind','listKey','expectedHash','preparation','applyCosts'];
  if(!object(input)||required.some(field=>!Object.hasOwn(input,field))||Object.keys(input).some(field=>!required.includes(field)&&field!=='documents')||input.kind!=='prepare'||!key(input.listKey)||typeof input.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedHash)||!object(input.preparation)||typeof input.applyCosts!=='boolean')throw fail();
  const {kind,...wire}=input;return structuredClone(wire);
 }
 if(actor.operation==='purchase-inventory-edit'){
  const required=['id','kind','orderKey','expectedHash','expectedRevision'],allowed=[...required,'declaration','header','quantities'];
  if(!object(input)||required.some(field=>!Object.hasOwn(input,field))||Object.keys(input).some(field=>!allowed.includes(field))||input.kind!=='edit'||!key(input.orderKey)||typeof input.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedHash)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw fail();
  const declaration=Object.hasOwn(input,'declaration'),header=Object.hasOwn(input,'header'),quantities=Object.hasOwn(input,'quantities');
  if(declaration?(header||quantities):!header&&!quantities)throw fail();
  if(declaration&&(!exact(input.declaration,['providerKey','currency','date','items'])||!Array.isArray(input.declaration.items)||!input.declaration.items.length||input.declaration.items.length>100||input.declaration.items.some(row=>!object(row)||['productKey','quantity','unitCost','publicPrice'].some(field=>!Object.hasOwn(row,field))||Object.keys(row).some(field=>!['productKey','quantity','unitCost','publicPrice','sourceIndex','destination'].includes(field))||!key(row.productKey)||Object.hasOwn(row,'sourceIndex')&&(!Number.isSafeInteger(row.sourceIndex)||row.sourceIndex<0)||Object.hasOwn(row,'destination')&&row.destination!=='stock')))throw fail();
  if(header&&(!object(input.header)||!Object.keys(input.header).length||Object.keys(input.header).some(field=>!['providerKey','date'].includes(field))||Object.hasOwn(input.header,'providerKey')&&!key(input.header.providerKey)||Object.hasOwn(input.header,'date')&&(typeof input.header.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.header.date))))throw fail();
  if(quantities&&(!Array.isArray(input.quantities)||!input.quantities.length||input.quantities.length>100||input.quantities.some(row=>!exact(row,['index','quantity'])||!Number.isSafeInteger(row.index)||row.index<0||typeof row.quantity!=='number'||!Number.isFinite(row.quantity)||row.quantity<0)))throw fail();
  return structuredClone(input);
 }
 if(actor.operation==='purchase-manual-create'){
  if(!exact(input,['id','kind','orderKey','expectedHash','declaration'])||input.kind!=='register'||input.orderKey!=='manual_'+digest({uid:actor.uid,id:input.id}).slice(0,40)||input.expectedHash!==digest(null)||!exact(input.declaration,['providerKey','currency','date','items'])||!Array.isArray(input.declaration.items)||input.declaration.items.length<1||input.declaration.items.length>100||input.declaration.items.some(row=>!exact(row,['productKey','quantity','unitCost','publicPrice'])||!key(row.productKey)))throw fail();
  return structuredClone({id:input.id,...input.declaration});
 }
 if(actor.operation==='purchase-list-generate'||actor.operation==='purchase-list-reserve'){
  const kind=actor.operation==='purchase-list-generate'?'generate':'reserve';
  if(!exact(input,['id','kind','listKey','expectedHash'])||input.kind!==kind||!key(input.listKey)||typeof input.expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(input.expectedHash))throw fail();
  return structuredClone({id:input.id,listKey:input.listKey,expectedHash:input.expectedHash});
 }
 if(Object.hasOwn(byOperation,actor.operation)){
  const spec=byOperation[actor.operation];
  if(!object(input)||!Object.hasOwn(input,'id')||!Object.hasOwn(input,'kind')||input.kind!==spec.kind||Object.keys(input).some(field=>field!=='kind'&&!spec.fields.includes(field)))throw fail();
  // Optional wire fields remain optional. Their business meaning is checked by
  // the typed model; transport reconstruction must not supply defaults.
  return structuredClone(Object.fromEntries(Object.entries(input).filter(([field])=>field!=='kind')));
 }
 throw fail();
}
function assertBound(actor,lease){
 const wire=wireFor(actor),hash=digest(wire);
 if(!lease||actor.transportDigest!==hash||lease.digest!==hash||lease.actorUid!==actor.uid||lease.opId!==actor.opId)throw fail();
 return wire;
}
function assertEditSource(actor,productKey,original){
 const input=wireFor(actor);
 if(actor.operation!=='purchase-inventory-edit'||!input.declaration||!key(productKey)||!object(original)||original._svSummary||original._svListSummary||original._svPagedSummary||digest(original)!==input.expectedHash||(original._svReadRevision??0)!==input.expectedRevision||!Array.isArray(original.items)||original.items.some(row=>!object(row)||!key(row.productoKey??row.productKey)||row.productoKey&&row.productKey&&row.productoKey!==row.productKey)||!input.declaration.items.some(row=>row.productKey===productKey)||original.items.some(row=>(row.productoKey??row.productKey)===productKey))throw fail();
 return true;
}
module.exports={wireFor,assertBound,assertEditSource};
