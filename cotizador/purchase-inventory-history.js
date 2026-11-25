'use strict';
const {digest}=require('./labor-guard'),{key,reference}=require('./purchase-inventory-model'),{inventoryKey:legacyKey}=require('./purchase-order-delete-model');
const Baseline=require('./purchase-current-pending-baseline');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_HISTORY_REVIEW'});
async function identifyOriginal(stored,selector,{read,sourcePath}={}){
 if(!stored||!Array.isArray(stored.items)||!Number.isInteger(selector)||selector<0||selector>=stored.items.length||typeof read!=='function')throw fail('Falta el renglón original de Compras.');
 const row=stored.items[selector],evidence=stored.inventarioCompra?.references?.[String(selector)],verifiedReads=[],readLedger=async inventoryKey=>{const path='sisventas/inventario_operativo/'+key(inventoryKey),ledger=await read(path);verifiedReads.push(path);if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))throw fail('Falta verificar el inventario histórico completo.');return ledger;};
 if(evidence){reference(evidence);const ledger=await readLedger(evidence.inventoryKey);
  if(Object.hasOwn(evidence,'baselineOperationId')||Object.hasOwn(evidence,'baselineRow')){const baseline=Baseline.validateBaseline(stored);if(!sourcePath||sourcePath!=='sisventas/ordenes/'+baseline.orderKey)throw fail('El baseline pertenece a otra fuente.');const receiptPath='sv_labor_receipts/'+baseline.operationId,receipt=await read(receiptPath);verifiedReads.push(receiptPath);Baseline.validateReceipt(stored,receipt);Baseline.assertReference(stored,selector,evidence,ledger);return{...structuredClone(evidence),aliases:[legacyKey(row.productoKey||row.codigo)],history:{kind:'confirmed',sourceHash:digest(stored),verifiedReads}};}
  const operation=evidence.operationId||stored.inventarioCompra?.lastOperation;
  if(!operation||!Object.hasOwn(ledger.operaciones||{},operation))throw fail('La identidad del inventario no tiene respaldo en su operación.');
  return {...structuredClone(evidence),aliases:[legacyKey(row.productoKey||row.codigo)],history:{kind:'confirmed',sourceHash:digest(stored),verifiedReads}};
 }
 // Lookup mapping BEFORE catalog; a removed legacy catalog key must not hide stock.
 const aliases=[...new Set([row.inventoryKey,row.productoKey,row.codigo,row.cod].filter(Boolean).map(legacyKey))];if(!aliases.length)throw fail('Falta identificar el material histórico.');
 const mappings=[];for(const alias of aliases){const forward=await read('sisventas/stock_vinculos/porProducto/'+alias),reverse=await read('sisventas/stock_vinculos/porInventario/'+alias);if(forward)mappings.push(forward);if(reverse)mappings.push(reverse);}
 if(mappings.some(m=>digest(m)!==digest(mappings[0])))throw fail('Las referencias de compra tienen asociaciones contradictorias.');
 const physical=mappings[0]?.inventoryKey||row.inventoryKey||legacyKey(row.productoKey||row.codigo),ledger=await readLedger(physical);
 const oldSignals=['receiptIdentityKey','stockRegistro','stockRevision','stockPendiente','instalada','devuelta','devueltaPendiente','cantidadRecibida','cantidadCostoReal','costoRealAcumulado','rendicion','rendiciones','recepciones','receipt','operacionStock'];
 if(oldSignals.some(field=>Object.hasOwn(row,field)&&![null,false,0,''].includes(row[field]))||stored.recepciones!=null&&(!Array.isArray(stored.recepciones)||stored.recepciones.length)||stored.recepcionPendiente||stored.inventarioCompra?.registered!==false||stored.inventarioCompra?.revision!==0||stored.inventarioCompra?.lastOperation)throw fail('La historia de compra requiere una identidad confirmada, no una ausencia supuesta.');
 const orderKey=sourcePath?.split('/').at(-1);if(!orderKey)throw fail('Falta la procedencia de la compra.');
 if(['compra_'+orderKey,'cancel_'+orderKey,stored.inventarioCompra?.lastOperation].filter(Boolean).some(id=>Object.hasOwn(ledger.operaciones||{},id)))throw fail('Existe una operación histórica sin identidad reconciliada.');
 // Scan complete original ledgers for references to THIS order, without assuming
 // that missing UI flags prove absence. Other orders' history remains untouched.
 for(const field of ['rendicionesOT','asignaciones','recepciones','operacionesCompra'])for(const record of Object.values(ledger[field]||{}))if(record&&typeof record==='object'&&[record.order,record.orderKey,record.orden,record.ordenKey].includes(orderKey))throw fail('Existe historia de inventario vinculada a esta compra.');
 return {productKey:mappings[0]?.productKey||row.productoKey||null,inventoryKey:physical,aliases,history:{kind:'absent',sourceHash:digest(stored),verifiedReads}};
}
async function legacy(stored,selector,ports){const identity=await identifyOriginal(stored,selector,ports);return {productKey:identity.productKey||legacyKey(stored.items[selector].productoKey||stored.items[selector].codigo),inventoryKey:identity.inventoryKey,receiptIdentityKey:identity.receiptIdentityKey||identity.inventoryKey};}
module.exports={identifyOriginal,legacy};
