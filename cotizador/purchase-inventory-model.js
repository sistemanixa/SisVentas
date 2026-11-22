'use strict';
// Pure local proposal; callers must derive source documents inside the shared guard.
const Money=require('./commercial-models/commercial-money');
const {digest}=require('./labor-guard');
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_INVENTORY_REVIEW',statusCode:409});
function key(value){if(typeof value!=='string'||!value||Buffer.byteLength(value)>768||['__proto__','constructor','prototype'].includes(value)||/[.#$\[\]/\x00-\x1f\x7f]/.test(value))throw fail('Referencia inválida.');return value;}
function qty(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail('Cantidad original inválida.');return value;}
function sum(...values){const result=Money.quantitySum(values);if(!Number.isFinite(result)||result<0)throw fail('El saldo no alcanza; revisá la operación.');return result;}
function reference(value){for(const field of ['productKey','inventoryKey','receiptIdentityKey'])key(value?.[field]);return value;}
function original(order){if(!order||typeof order!=='object'||!Array.isArray(order.items)||order._svListSummary||order._svPagedSummary)throw fail('Hace falta la compra original completa.');return order;}
function itemIdentity(item){return key(item.productoKey||item.codigo);}
function pending(order){const amounts=new Map();for(const item of original(order).items){const id=itemIdentity(item),ordered=qty(item.cantidadOrdenada??item.cantidad),received=qty(item.cantidadRecibida??0);if(received>ordered)throw fail('La recepción supera la compra.');amounts.set(id,sum(amounts.get(id)||0,ordered,-received));}return amounts;}
function planner({id,at,inventories,references}){
 key(id);if(id.length<8||!Number.isSafeInteger(at)||at<=0)throw fail('Falta identificar la operación.');
 const refs=new Map(),physical=new Map(),next=new Map(),preconditions=Object.create(null);
 for(const [identity,raw]of Object.entries(references||{})){key(identity);const ref=reference(raw);const prior=physical.get(ref.inventoryKey);if(prior&&(prior.productKey!==ref.productKey||prior.receiptIdentityKey!==ref.receiptIdentityKey))throw fail('Varios productos comparten inventario.');physical.set(ref.inventoryKey,ref);refs.set(identity,ref);}
 function get(identity){const ref=refs.get(identity);if(!ref)throw fail('Falta resolver el vínculo del material.');if(!next.has(ref.inventoryKey)){
  if(!Object.hasOwn(inventories||{},ref.inventoryKey)||!inventories[ref.inventoryKey]||typeof inventories[ref.inventoryKey]!=='object'||Array.isArray(inventories[ref.inventoryKey]))throw fail('Falta inventario original; no se crea una rama alternativa.');
  const before=structuredClone(inventories[ref.inventoryKey]);if(Object.hasOwn(before.operaciones||{},id))throw fail('La operación previa requiere consultar su recibo.');
  preconditions['sisventas/inventario_operativo/'+ref.inventoryKey]=before;next.set(ref.inventoryKey,structuredClone(before));
 }return next.get(ref.inventoryKey);}
 function finish(){const patch=Object.create(null);for(const [inventoryKey,inventory]of next){inventory.operaciones={...(inventory.operaciones||{}),[id]:at};patch['sisventas/inventario_operativo/'+inventoryKey]=inventory;}return {patch,preconditions,referenceDigest:digest(references),operationId:id};}
 return {get,finish};
}
function planPendingOrder(input){
 const {kind,order,previousOrder}=input;if(!['register','edit','cancel'].includes(kind))throw fail('Operación de compra inválida.');original(order);
 if(order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente)throw fail('La compra conserva una operación pendiente.');
 if(kind!=='register'&&(!previousOrder||order.fbKey!==previousOrder.fbKey))throw fail('La orden original cambió.');
 if(kind==='cancel'&&previousOrder.estado==='cancelada'||kind!=='cancel'&&order.estado==='cancelada')throw fail('La compra ya está cancelada.');
 if(kind==='edit'&&[order,previousOrder].some(o=>o.items.some(i=>qty(i.cantidadRecibida??0)>0)))throw fail('No se edita una compra ya recibida.');
 if(kind==='register'&&order.items.some(i=>qty(i.cantidadRecibida??0)>0))throw fail('El alta no puede inventar recepciones.');
 const before=kind==='register'?new Map():pending(previousOrder),after=kind==='cancel'?new Map():pending(order),p=planner(input);
 for(const identity of new Set([...before.keys(),...after.keys()])){const delta=Money.quantitySum([after.get(identity)||0,-(before.get(identity)||0)]);if(!delta)continue;const inv=p.get(identity);inv.enCompra=sum(qty(inv.enCompra),delta);}
 return p.finish();
}
function planReceiptInventory(input){
 const {order,movements}=input;original(order);key(order.fbKey);
 if(order.estado==='cancelada'||order.generacionPendiente||order.cancelacionPendiente||order.recepcionPendiente)throw fail('La compra no está preparada para recibir.');
 if(order.ventaId&&!order.ventaFbKey)throw fail('Falta resolver la venta técnica.');
 if(!Array.isArray(movements)||!movements.length)throw fail('Faltan materiales recibidos.');
 const p=planner(input),seen=new Set(),groups=new Map();
 for(const movement of movements){const index=movement.index;if(!Number.isSafeInteger(index)||index<0||index>=order.items.length||seen.has(index))throw fail('Renglón de recepción inválido o repetido.');seen.add(index);
  const item=order.items[index],quantity=qty(movement.quantity),unit=qty(movement.realUnitCost);if(quantity<=0||quantity>sum(qty(item.cantidadOrdenada??item.cantidad),-qty(item.cantidadRecibida??0)))throw fail('La recepción supera lo pendiente.');
  const identity=itemIdentity(item),ref=reference(input.references?.[identity]),inventory=p.get(identity),g=groups.get(ref.inventoryKey)||{inventory,quantity:0,cost:0};g.quantity=sum(g.quantity,quantity);g.cost=sum(g.cost,Money.rawProduct(quantity,unit));groups.set(ref.inventoryKey,g);
 }
 for(const {inventory:inv,quantity,cost}of groups.values()){
  inv.enCompra=sum(qty(inv.enCompra),-quantity);
  if(order.ventaFbKey){const allocation=key(order.ventaFbKey);inv.reservado=sum(qty(inv.reservado),quantity);inv.asignaciones=structuredClone(inv.asignaciones||{});const owned=inv.asignaciones[allocation]||{reservado:0,consumido:0,liberado:0};owned.reservado=sum(qty(owned.reservado),quantity);owned.ventaId=order.ventaId||'';inv.asignaciones[allocation]=owned;}
  else {inv.general=sum(qty(inv.general),quantity);inv.costoReferenciaStock={unit:cost/quantity,order:order.fbKey,number:order.numero||'',stamp:input.at,receipt:input.id,basis:'costo_final_con_gastos'};}
 }
 return p.finish();
}
function planExistingReservation(input){
 const {allocationKey,quantity,identity,saleNumber=''}=input;key(allocationKey);qty(quantity);if(quantity<=0)throw fail('Reserva inválida.');const p=planner(input),inv=p.get(key(identity));
 inv.general=sum(qty(inv.general),-quantity);inv.reservado=sum(qty(inv.reservado),quantity);inv.asignaciones=structuredClone(inv.asignaciones||{});const owned=inv.asignaciones[allocationKey]||{reservado:0,consumido:0,liberado:0};owned.reservado=sum(qty(owned.reservado),quantity);owned.ventaId=saleNumber;owned.origen='stock_general';inv.asignaciones[allocationKey]=owned;return p.finish();
}
module.exports={planPendingOrder,planReceiptInventory,planExistingReservation,key,reference};
