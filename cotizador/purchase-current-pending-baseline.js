'use strict';
// Pure evidence checks only. History/Policy must validate the REAL Guard receipt
// and fresh source reads before issuing authority; JSON baseline is not a grant.
const {digest}=require('./labor-guard'),Inventory=require('./purchase-inventory-model'),Money=require('./commercial-models/commercial-money');
const own=(v,k)=>Object.hasOwn(v||{},k),copy=v=>structuredClone(v),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=m=>Object.assign(Error(m),{statusCode:409,code:'SV_PURCHASE_CURRENT_PENDING_BASELINE_REVIEW'});
function need(ok,m){if(!ok)throw fail(m);}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function exact(v,keys){return object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>own(v,k));}
// RTDB returns dense numeric-key objects as arrays. Normalize ONLY these two
// metadata bags, retaining the original map digest used before serialization.
function indexed(value,expectedLength){
 const array=Array.isArray(value);need(array||object(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'Falta una colección indexada de metadata.');
 const keys=Reflect.ownKeys(value).filter(key=>!array||key!=='length'),length=array?value.length:keys.length;
 need(Number.isSafeInteger(length)&&length>0&&length<=100&&keys.length===length&&(expectedLength===undefined||length===expectedLength)&&keys.every(key=>typeof key==='string'),'La metadata indexada tiene huecos o campos extra.');
 const result={};for(let index=0;index<length;index++){const key=String(index);need(own(value,key)&&object(value[key]),'La metadata indexada no es densa y canónica.');result[key]=value[key];}return result;
}
function rowsDigest(rows){return digest(indexed(rows));}
function baselineDigest(baseline){need(object(baseline),'Falta el baseline original.');return digest({...baseline,rows:indexed(baseline.rows)});}
function quantity(v){need(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER,'Cantidad baseline inválida.');Money.decimal(v);return v;}
function identity(ref){Inventory.reference(ref);return{productKey:ref.productKey,inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey};}
function validateBaseline(order){
 const marker=order?.inventarioCompra,baseline=marker?.baseline;
 need(object(order)&&Array.isArray(order.items)&&marker?.schema===1&&marker.registered===true&&Number.isSafeInteger(marker.revision)&&marker.revision>=1,'Falta registro de compra confirmado.');
 need(exact(baseline,['schema','kind','operationId','actorUid','orderKey','ts','originalOrderHash','coverageDigest','rows','fence'])&&baseline.schema===1&&baseline.kind==='current-pending'&&Number.isSafeInteger(baseline.ts)&&baseline.ts>0&&hash(baseline.originalOrderHash)&&hash(baseline.coverageDigest),'Baseline current-pending incompleto.');
 for(const field of ['operationId','actorUid','orderKey','fence'])Inventory.key(baseline[field]);need(baseline.operationId.length>=8,'Operación baseline inválida.');
 need(!own(order,'fbKey')||order.fbKey===baseline.orderKey,'Baseline de otra orden.');
 const rows=indexed(baseline.rows);indexed(marker.references,order.items.length);
 for(const row of Object.values(rows)){need(exact(row,['productKey','inventoryKey','receiptIdentityKey','ordered','received','pending','sourceRowHash'])&&hash(row.sourceRowHash),'Falta captura original de fila baseline.');identity(row);quantity(row.ordered);quantity(row.received);quantity(row.pending);need(row.ordered>0&&row.received<=row.ordered&&Money.quantitySum([row.ordered,-row.received])===row.pending,'Cantidades baseline contradictorias.');}
 return baseline;
}
function baselineReference(order,index,ref){
 const baseline=validateBaseline(order),evidence=order.inventarioCompra.references?.[String(index)];
 need(exact(evidence,['productKey','inventoryKey','receiptIdentityKey','baselineOperationId','baselineRow'])&&evidence.baselineOperationId===baseline.operationId&&typeof evidence.baselineRow==='string'&&own(baseline.rows,evidence.baselineRow),'La referencia no pertenece al baseline original.');
 const source=baseline.rows[evidence.baselineRow],row=order.items[index];
 need(digest(identity(evidence))===digest(identity(ref))&&digest(identity(source))===digest(identity(ref))&&row,'Identidad baseline P/J/R contradictoria.');
 // Code/description/prices are editable display/economic fields. Identity comes
 // from the sealed baseline selector and the currently verified P/J/R pair.
 for(const field of ['productoKey','productKey'])need(!own(row,field)||row[field]===ref.productKey,'El producto explícito no coincide con P canónico.');
 need(quantity(row.cantidadOrdenada??row.cantidad)===source.ordered&&quantity(row.cantidadRecibida??0)===source.received,'La fila movida requiere una operación real nueva.');
 return evidence;
}
function assertReference(order,index,reference,ledger){
 need(object(order)&&Array.isArray(order.items)&&Number.isSafeInteger(index)&&index>=0&&index<order.items.length&&object(ledger),'Falta fila o ledger actual.');need(order.inventarioCompra?.schema===1&&order.inventarioCompra.registered===true&&Number.isSafeInteger(order.inventarioCompra.revision)&&order.inventarioCompra.revision>=(own(order.inventarioCompra,'baseline')?1:0),'Falta registro confirmado de compra.');const ref=identity(reference),evidence=order.inventarioCompra?.references?.[String(index)];
 need(object(evidence)&&digest(identity(evidence))===digest(ref),'La referencia histórica no coincide con P/J/R.');
 if(own(evidence,'baselineOperationId')||own(evidence,'baselineRow'))return copy(baselineReference(order,index,ref));
 need(!!evidence.operationId&&own(ledger.operaciones||{},evidence.operationId),'Falta la operación real del ledger.');return copy(evidence);
}
function validateReceipt(order,receipt){
 const baseline=validateBaseline(order),expected={ok:true,committed:true,operationId:baseline.operationId,orderKey:baseline.orderKey,reconciliation:'current-pending',baselineVersion:1,actorUid:baseline.actorUid,originalOrderHash:baseline.originalOrderHash,rowsHash:rowsDigest(baseline.rows),baselineDigest:baselineDigest(baseline)};
 need(exact(receipt,['fence','digest','actorUid','result','confirmedAt'])&&receipt.fence===baseline.fence&&receipt.actorUid===baseline.actorUid&&hash(receipt.digest)&&Number.isSafeInteger(receipt.confirmedAt)&&receipt.confirmedAt>=baseline.ts&&receipt.digest===digest({id:baseline.operationId,orderKey:baseline.orderKey,expectedHash:baseline.originalOrderHash})&&digest(receipt.result)===digest(expected),'El baseline no tiene su recibo Guard original válido.');
 return true;
}
function nextReference({order,index,reference,operationId,changed}){
 const ref=identity(reference);need(typeof changed==='boolean','Falta identificar el movimiento real.');
 if(changed){Inventory.key(operationId);need(operationId.length>=8&&operationId!==order?.inventarioCompra?.baseline?.operationId,'El movimiento requiere una operación nueva real.');return{...ref,operationId};}
 const evidence=order?.inventarioCompra?.references?.[String(index)];need(object(evidence)&&digest(identity(evidence))===digest(ref),'Una fila nueva no puede heredar evidencia ajena.');
 if(own(evidence,'baselineOperationId')||own(evidence,'baselineRow'))return copy(baselineReference(order,index,ref));
 Inventory.key(evidence.operationId);return copy(evidence);
}
module.exports={assertReference,validateReceipt,nextReference,validateBaseline,rowsDigest,baselineDigest};
