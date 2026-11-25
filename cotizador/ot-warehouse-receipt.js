'use strict';
const {digest}=require('./labor-guard'),Money=require('./commercial-models/commercial-money');
const sum=(...values)=>Money.quantitySum(values),issued=new WeakMap(),warnings=new WeakSet(),port=Symbol('ot-warehouse-delivery');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_OT_WAREHOUSE_REVIEW',svLaborAttempted:false});
const qty=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail('Las cantidades físicas requieren revisión.');return value;};
function modern(receipt){return receipt?.warehouse?.schema===2;}
function balance(receipt){
 if(!modern(receipt)||!receipt.warehouse.events||typeof receipt.warehouse.events!=='object'||Array.isArray(receipt.warehouse.events))throw fail('Falta el recibo físico v2.');
 const w=receipt.warehouse;let quantity=0,general=0,reserve=0,shortage=0;
 for(const [operationId,event]of Object.entries(w.events)){if(event.operationId!==operationId||qty(event.quantity)!==sum(qty(event.debitedGeneral),qty(event.debitedReserve),qty(event.shortage)))throw fail('El descuento del recibo no coincide con la entrega.');quantity=sum(quantity,event.quantity);general=sum(general,event.debitedGeneral);reserve=sum(reserve,event.debitedReserve);shortage=sum(shortage,event.shortage);}
 const credited=qty(w.returnedCredited),uncredited=qty(w.returnedUncredited),installed=qty(receipt.instalada),received=qty(receipt.recibidas??0),held=qty(receipt.enReserva),real=sum(general,reserve);
 if(credited>real||uncredited>shortage||sum(credited,uncredited)!==received||sum(installed,received,held)!==quantity)throw fail('La devolución excede el origen real del recibo.');
 const installedReal=Math.min(installed,sum(real,-credited)),installedShortage=sum(installed,-installedReal),reservedReal=sum(real,-credited,-installedReal),reservedShortage=sum(shortage,-uncredited,-installedShortage);
 if(reservedReal<0||reservedShortage<0||sum(reservedReal,reservedShortage)!==held)throw fail('La custodia no respalda el descuento registrado.');
 return{quantity,general,reserve,shortage,credited,uncredited,installedReal,installedShortage,reservedReal,reservedShortage};
}
function deliveryEvent({beforeInventory,result,quantity,otKey,rowKey,reference,operationId,actorUid}){
 if(!beforeInventory||typeof beforeInventory!=='object'||Array.isArray(beforeInventory))throw fail('Falta el inventario original verificable. No se lo puede tratar como cero histórico.');
 const receipt=result.inventory.rendicionesOT[result.receipt],before=beforeInventory.rendicionesOT?.[result.receipt];
 if(before&&!modern(before))throw fail('El recibo histórico no acredita cuánto se descontó. Requiere revisión individual.');
 if(before)balance(before);
 const assigned=Object.values(beforeInventory.asignaciones||{}).reduce((total,row)=>sum(total,qty(row.reservado??0)),0);if(assigned>qty(beforeInventory.reservado))throw fail('Las reservas históricas no tienen respaldo verificable.');
 const debitedGeneral=sum(qty(beforeInventory.general),-qty(result.inventory.general)),shortage=qty(result.regularization),debitedReserve=sum(qty(quantity),-debitedGeneral,-shortage);
 if(debitedGeneral<0||debitedReserve<0)throw fail('No se puede acreditar el descuento de la entrega.');
 const event={operationId,actorUid,otKey,rowKey:String(rowKey),productKey:reference.productKey,inventoryKey:reference.inventoryKey,receiptIdentityKey:reference.receiptIdentityKey,receipt:result.receipt,quantity,debitedGeneral,debitedReserve,shortage};
 receipt.warehouse={schema:2,events:{...(before?.warehouse.events||{}),[operationId]:event},returnedCredited:before?.warehouse.returnedCredited??0,returnedUncredited:before?.warehouse.returnedUncredited??0};balance(receipt);return event;
}
function quote({ot,references,inventories,heldByOthers,events,context}){
 const rows=events.map(event=>({index:Number(event.rowKey),cantidad:event.quantity,descontadoGeneral:event.debitedGeneral,descontadoReserva:event.debitedReserve,faltante:event.shortage}));
 const sourceHash=digest({otHash:digest(ot),inventories:[...inventories].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,digest(value)]),references:[...references].sort(([a],[b])=>Number(a)-Number(b)).map(([index,ref])=>[index,ref.productKey,ref.inventoryKey,ref.receiptIdentityKey,ref.mappingRevision]),held:[...heldByOthers].sort(([a],[b])=>String(a).localeCompare(String(b))),rows,uid:context?.actor?.uid,permissionDigest:context?.actor?.permissionDigest});return{sourceHash,rows};
}
function confirm(quote,confirmation){
 const missing=quote.rows.some(row=>row.faltante>0);
 if(confirmation!==undefined&&digest(confirmation)!==digest(quote)||missing&&confirmation===undefined){const error=Object.assign(Error(confirmation===undefined?'Confirmá expresamente el faltante indicado antes de entregar.':'El stock cambió. Revisá nuevamente el descuento y el faltante.'),{statusCode:409,code:confirmation===undefined?'SV_OT_SHORTAGE_CONFIRMATION_REQUIRED':'SV_OT_DELIVERY_QUOTE_CHANGED',svLaborAttempted:false,deliveryQuote:structuredClone(quote)});warnings.add(error);throw error;}
}
function authority(context){
 const {actor,lease}=context||{},life=require('./ot-lifecycle-policy').token(actor,lease),inventory=require('./ot-inventory-policy').token(actor,lease);
 const allowed=life.svOTLifecycleVersion===1&&life.svOTLifecycleKind==='delivery'||inventory.svOTInventoryVersion===1&&inventory.svOTInventoryKind==='delivery';
 if(!allowed||actor?.mode!=='user'||actor.uid!==actor.claims?.uid||actor.uid!==lease?.actorUid||actor.opId!==lease?.opId||!lease?.fence||!['admin','administrativo'].includes(actor.role))throw fail('La entrega requiere su capacidad interna vigente.');return actor;
}
function bind(context,events){const actor=authority(context),handle=Object.freeze({});issued.set(handle,{cap:actor.otLifecycle||actor.otInventory,fence:context.lease.fence,uid:actor.uid,opId:actor.opId,digest:actor.transportDigest,events:structuredClone(events)});actor[port]=handle;}
function planned(context,event){if(!context)return false;const actor=authority(context),proof=issued.get(actor[port]);return !!proof&&proof.cap===(actor.otLifecycle||actor.otInventory)&&proof.fence===context.lease.fence&&proof.uid===actor.uid&&proof.opId===event.operationId&&proof.digest===context.lease.digest&&proof.events.some(value=>digest(value)===digest(event));}
async function verify({receipt,read,context,inventoryKey,receiptKey}){
 if(!modern(receipt))return;balance(receipt);
 for(const event of Object.values(receipt.warehouse.events)){
  if(event.receipt!==receiptKey||event.inventoryKey!==inventoryKey||event.otKey!==receipt.ot||event.rowKey!==receipt.fila)throw fail('El comprobante físico pertenece a otro ledger o fila.');
  if(context&&context.actor?.opId===event.operationId&&planned(context,event))continue;
  const record=await read('sv_labor_receipts/'+event.operationId);if(!record||record.actorUid!==event.actorUid||record.result?.ok!==true||record.result.committed!==true||record.result.operationId!==event.operationId||record.result.otKey!==event.otKey||record.result.warehouseVersion!==2||!Array.isArray(record.result.warehouseEvents)||!record.result.warehouseEvents.some(value=>digest(value)===digest(event)))throw fail('Falta el comprobante genuino del descuento físico.');
 }
}
function receive(receipt,amount){const state=balance(receipt);amount=qty(amount);if(amount>receipt.enReserva)throw fail('La devolución supera la custodia pendiente.');const credit=Math.min(amount,state.reservedReal),uncredited=sum(amount,-credit);if(uncredited>state.reservedShortage)throw fail('La devolución no coincide con su faltante autorizado.');receipt.warehouse.returnedCredited=sum(state.credited,credit);receipt.warehouse.returnedUncredited=sum(state.uncredited,uncredited);receipt.enReserva=sum(receipt.enReserva,-amount);receipt.recibidas=sum(qty(receipt.recibidas??0),amount);balance(receipt);return credit;}
function errorDetails(error){return warnings.has(error)?{code:error.code,svLaborAttempted:false,deliveryQuote:structuredClone(error.deliveryQuote)}:{};}
module.exports={modern,balance,deliveryEvent,quote,confirm,bind,verify,receive,errorDetails};
