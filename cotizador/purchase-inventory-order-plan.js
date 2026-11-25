'use strict';
const Inventory=require('./purchase-inventory-model'),Money=require('./commercial-models/commercial-money');
const FX=require('./purchase-receipt-fx');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_PLAN_REVIEW'});
const amount=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail('Falta un importe original válido.');return value;};
function build({sourceOrder,body,inventories,references,at,actorName,providers,allowLinked=false}){
 const order=structuredClone(sourceOrder),marker=order.inventarioCompra;
 if(!order||!Array.isArray(order.items)||order._svSummary||order._svListSummary||order._svPagedSummary)throw fail('Hace falta la orden original completa.');
 if(!allowLinked&&(order.ventaFbKey||order.ventaId||order.listaMaterialesId||order.listaOrigenId||order.compraVentaReferencia))throw fail('Esta compra requiere un plan conjunto de venta, costos o preparación; no se guardó ningún cambio.');
 if(marker?.schema!==1||!Number.isSafeInteger(marker.revision)||marker.revision<0)throw fail('El estado histórico de inventario requiere conciliación explícita.');
 if(body.kind==='register'?marker.registered!==false:marker.registered!==true)throw fail('La compra ya fue registrada o falta confirmar su registro.');
 if(body.kind==='register'&&(marker.revision!==0||marker.lastOperation||marker.references))throw fail('El registro anterior requiere conciliación, no un alta repetida.');
 if(order.estado==='cancelada'||order.recepcionPendiente||order.generacionPendiente||order.cancelacionPendiente)throw fail('La compra no está disponible para esta operación.');
 if(!order.items.length||order.items.some(item=>!item||typeof item!=='object'))throw fail('Faltan los materiales originales.');
 if(body.kind!=='register')for(const [index,item]of order.items.entries()){
  const evidence=marker.references?.[String(index)],resolved=references[item.productoKey||item.codigo],ledger=evidence&&inventories[evidence.inventoryKey];
  if(!evidence||!evidence.operationId||!ledger||!Object.hasOwn(ledger.operaciones||{},evidence.operationId)||['productKey','inventoryKey','receiptIdentityKey'].some(field=>evidence[field]!==resolved?.[field]))throw fail('La identidad histórica de la compra requiere conciliación explícita.');
 }
 const next=structuredClone(order),common={id:body.id,at,inventories,references},orderKey=body.orderKey;
 // fbKey is metadata for planning, not an invented field in the stored document.
 const identified={...order,fbKey:orderKey};let plan;
 if(body.kind==='edit'){
  if(!Array.isArray(body.quantities)||!body.quantities.length)throw fail('Faltan cantidades para editar.');
  const expected=Money.quantitySum(order.items.map(item=>Money.rawProduct(amount(item.cantidadOrdenada??item.cantidad),amount(item.costoUnitario))));
  for(const field of ['total','monto'])if(Object.hasOwn(order,field)&&amount(order[field])!==expected)throw fail('La compra tiene costos adicionales que requieren un plan completo.');
  const seen=new Set();for(const move of body.quantities){if(!Number.isSafeInteger(move.index)||move.index<0||move.index>=next.items.length||seen.has(move.index)||amount(move.quantity)<=0)throw fail('Cantidad o renglón inválido.');seen.add(move.index);next.items[move.index].cantidadOrdenada=move.quantity;}
  for(const item of next.items)item.subtotal=Money.rawProduct(amount(item.cantidadOrdenada??item.cantidad),amount(item.costoUnitario));
  const total=Money.quantitySum(next.items.map(item=>item.subtotal));for(const field of ['total','monto'])if(Object.hasOwn(next,field))next[field]=total;
  plan=Inventory.planPendingOrder({...common,kind:'edit',order:{...next,fbKey:orderKey},previousOrder:identified});
 }else if(body.kind==='receive'){
  const fx=FX.terms(order,body.exchangeRate);plan=Inventory.planReceiptInventory({...common,order:identified,movements:body.movements,exchangeRate:body.exchangeRate});
  for(const movement of body.movements){const item=next.items[movement.index],prior=amount(item.cantidadCostoReal??item.cantidadRecibida??0),cost=prior>0?amount(item.costoRealAcumulado):0;
   item.costoUnitarioPresupuestado=amount(item.costoUnitarioPresupuestado??item.costoUnitario);item.cantidadRecibida=Money.quantitySum([amount(item.cantidadRecibida??0),movement.quantity]);item.cantidadCostoReal=Money.quantitySum([prior,movement.quantity]);item.costoRealAcumulado=Money.quantitySum([cost,Money.rawProduct(movement.quantity,movement.realUnitCost)]);item.ultimoCostoReal=movement.realUnitCost;item.costoUnitarioReal=item.costoRealAcumulado/item.cantidadCostoReal;
   const effective=FX.provider(order,movement,providers);item.proveedorFinal=effective.name;item.proveedorFinalKey=effective.key;
   if(fx.currency==='USD'){const previous=FX.priorARS(order,order.items[movement.index],prior),ars=FX.convert(movement.realUnitCost,fx);item.costoRealAcumuladoARS=Money.quantitySum([previous,Money.rawProduct(movement.quantity,ars)]);item.costoUnitarioRealARS=item.costoRealAcumuladoARS/item.cantidadCostoReal;item.ultimoCostoRealARS=ars;item.monedaCostoReal='USD';item.cotizacionUltimaRecepcion=fx.rate;item.cotizacionRegistradaEn=at;item.cotizacionRegistradaPor=actorName;}
  }
  if(order.recepciones!=null&&!Array.isArray(order.recepciones))throw fail('El historial de recepción requiere revisión.');
  next.recepciones=[...(order.recepciones||[]),{id:body.id,inventoryFlowVersion:2,ts:at,fecha:new Date(at).toISOString().slice(0,10),usuario:actorName,...FX.stamp(fx,at,actorName),items:body.movements.map(m=>{const effective=FX.provider(order,m,providers);return{index:m.index,codigo:order.items[m.index].codigo||'',cantidad:m.quantity,costoUnitarioReal:m.realUnitCost,proveedor:effective.name,proveedorKey:effective.key,...(fx.currency==='USD'?{costoUnitarioRealARS:FX.convert(m.realUnitCost,fx)}:{})};})}];
  if(fx.currency==='USD')next.totalRealRecibidoARS=Money.quantitySum(next.items.map(i=>FX.priorARS(order,i,amount(i.cantidadRecibida??0))));
  next.totalRealRecibido=Money.quantitySum(next.items.map(i=>amount(i.costoRealAcumulado??0)));next.totalPresupuestadoRecibido=Money.quantitySum(next.items.map(i=>Money.rawProduct(amount(i.cantidadCostoReal??0),amount(i.costoUnitarioPresupuestado??i.costoUnitario))));next.diferenciaCompra=Money.quantitySum([next.totalPresupuestadoRecibido,-next.totalRealRecibido]);next.estado=next.items.every(i=>amount(i.cantidadRecibida??0)>=amount(i.cantidadOrdenada??i.cantidad))?'recibida':'recepcion_parcial';next.recibidoEn=at;
 }else {plan=Inventory.planPendingOrder({...common,kind:body.kind,order:identified,previousOrder:identified});if(body.kind==='cancel'){next.estado='cancelada';next.canceladaEn=at;}}
 const identityByRow=Object.fromEntries(order.items.map((item,index)=>{const ref=Inventory.reference(references[item.productoKey||item.codigo]),changed=plan.patch['sisventas/inventario_operativo/'+ref.inventoryKey],operationId=Object.hasOwn(changed?.operaciones||{},body.id)?body.id:marker.references?.[String(index)]?.operationId||marker.lastOperation;if(!operationId)throw fail('Falta respaldo de inventario para un material.');return [String(index),{productKey:ref.productKey,inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey,operationId}];}));
 next.inventarioCompra={...marker,schema:1,registered:true,revision:marker.revision+1,lastOperation:body.id,references:identityByRow};next.actualizadoEn=at;
 const orderPath='sisventas/ordenes/'+orderKey;plan.patch[orderPath]=next;plan.preconditions[orderPath]=structuredClone(order);return {...plan,sourceOrder:order};
}
module.exports={build};
