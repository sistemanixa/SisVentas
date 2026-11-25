'use strict';
const Base=require('./purchase-inventory-order-plan'),Inventory=require('./purchase-inventory-model'),Costs=require('./commercial-models/purchase-receipt-costs.v1'),Money=require('./commercial-models/commercial-money');
const {digest}=require('./labor-guard');
const FX=require('./purchase-receipt-fx');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_LINKED_REVIEW'});
const number=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw fail('Falta un costo o cantidad original de la preparación.');return value;};
function refs(record,field){const value=record?.[field];if(!Array.isArray(value)||value.some(v=>typeof v!=='string')||new Set(value).size!==value.length)throw fail('Los vínculos comerciales originales requieren revisión.');return value;}
function build(input){
 const {sourceOrder:order,sale,list,body,inventories,references,at,actorName,otherOrders={}}=input;
 if(order.ventaId&&!order.ventaFbKey||order.listaOrigenId||list?.origen==='conjunta'||list?.sources?.length)throw fail('La compra conjunta o la referencia de venta requiere un plan de sus fuentes completas.');
 const saleKey=order.ventaFbKey&&Inventory.key(order.ventaFbKey),listKey=order.listaMaterialesId&&Inventory.key(order.listaMaterialesId);
 if(saleKey&&(!sale||sale._svListSummary||sale.eliminado||sale.anulada||sale.anulado||!Array.isArray(sale.items)))throw fail('Falta la venta original vigente.');
 if(listKey&&(!list||list._svSummary||!Array.isArray(list.items)))throw fail('Falta la preparación original completa.');
 if(list&&saleKey&&list.ventaFbKey!==saleKey||sale&&listKey&&sale.listaMaterialesId!==listKey)throw fail('La venta y la preparación no conservan el mismo vínculo.');
 if(sale)refs(sale,'ordenesCompraIds');if(list)refs(list,'ordenesIds');
 if(body.kind!=='register'&&(sale&&!sale.ordenesCompraIds.includes(body.orderKey)||list&&!list.ordenesIds.includes(body.orderKey)))throw fail('La compra ya no está vinculada a sus originales.');
 const lineByOrder=new Map(),used=new Set();
 if(sale)for(const [index,item]of order.items.entries()){
  if(FX.destination(order,item)==='stock')continue;
  if(item.sourceLine==null||item.sourceSaleQty==null||item.sourceOriginalUnit==null)throw fail('Faltan snapshots del renglón original de venta.');
  const canonical={...item,productoKey:references[item.productoKey||item.codigo]?.productKey||item.productoKey},lineIndex=Costs.resolve(sale.items,canonical);if(used.has(lineIndex))throw fail('Varios materiales apuntan al mismo renglón de venta.');used.add(lineIndex);lineByOrder.set(index,lineIndex);
  const line=sale.items[lineIndex],quantity=Costs.quantity(line),plan=line.preparacionCompra;
  if(!['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado','costoUnitarioCompra','costoUnitario','costoCompra','costoTotalCompra'].some(field=>line[field]!=null))throw fail('La venta no conserva su costo original.');
  if(plan){if(Money.quantitySum([number(plan.cantidadStock),number(plan.cantidadComprar)])!==quantity)throw fail('Las cantidades de la preparación no coinciden con la venta.');number(plan.costoStockUnitario);number(plan.costoCompraUnitario);if(number(item.cantidadOrdenada??item.cantidad)>plan.cantidadComprar)throw fail('La orden supera la cantidad de compra acordada.');}
  const quoted=plan?number(plan.costoCompraUnitario):number(line.costoUnitarioPresupuestado);if(FX.budgetARS(order,item,line)!==quoted)throw fail('El precio pactado del proveedor no coincide con la preparación original.');
  if(body.kind==='edit'&&body.quantities.some(move=>move.index===index&&move.quantity!==number(item.cantidadOrdenada??item.cantidad)))throw fail('Cambiar cantidades de una orden vinculada exige revisar la preparación completa.');
 }
 const plan=Base.build({...input,allowLinked:true}),nextSale=sale&&structuredClone(sale),nextList=list&&structuredClone(list);
 function write(path,before,after){if(digest(before)===digest(after))return;plan.preconditions[path]=structuredClone(before);plan.patch[path]=after;}
 if(body.kind==='register'){
  if(nextSale){if(!nextSale.ordenesCompraIds.includes(body.orderKey))nextSale.ordenesCompraIds.push(body.orderKey);nextSale.compraEstado='ordenada';}
  if(nextList){if(!nextList.ordenesIds.includes(body.orderKey))nextList.ordenesIds.push(body.orderKey);nextList.estado='ordenada';if(nextList.ordenadaEn==null)nextList.ordenadaEn=at;}
  // Stock quantities/prices come only from the captured sale preparation.
  const completedStock=new Set(),stockGroups=new Map();if(sale)for(const [index,lineIndex]of lineByOrder){const item=order.items[index],line=sale.items[lineIndex],quantity=line.preparacionCompra?number(line.preparacionCompra.cantidadStock):0;if(!quantity)continue;const identity=item.productoKey||item.codigo,ref=references[identity],group=stockGroups.get(ref.productKey)||{identity,ref,quantity:0,sources:[]};if(group.ref.inventoryKey!==ref.inventoryKey||group.ref.receiptIdentityKey!==ref.receiptIdentityKey)throw fail('La reserva tiene identidades contradictorias.');group.quantity=Money.quantitySum([group.quantity,quantity]);group.sources.push({saleLine:lineIndex,quantity,stockUnitCost:number(line.preparacionCompra.costoStockUnitario)});stockGroups.set(ref.productKey,group);}
  for(const {identity,ref,quantity,sources}of stockGroups.values()){const inventoryPath='sisventas/inventario_operativo/'+ref.inventoryKey,original=inventories[ref.inventoryKey],proof=list?.reservasInventario?.[ref.productKey],legacyOperation='existente_plan_'+String(listKey||'').replace(/[^a-zA-Z0-9_-]/g,'_');
   if(!listKey)throw fail('La reserva existente requiere su preparación original.');
   if(proof){if(proof.inventoryKey!==ref.inventoryKey||proof.receiptIdentityKey!==ref.receiptIdentityKey||number(proof.quantity)!==quantity||digest(proof.sources)!==digest(sources)||!Object.hasOwn(original.operaciones||{},proof.operationId))throw fail('La reserva de la preparación cambió.');completedStock.add(ref.productKey);continue;}
   if(list.stockExistenteReservado===true||Object.hasOwn(original.operaciones||{},legacyOperation)){
    const assignment=original.asignaciones?.[saleKey];if(list.stockExistenteReservado!==true||!Object.hasOwn(original.operaciones||{},legacyOperation)||!assignment||Money.quantitySum([number(assignment.reservado??0),number(assignment.consumido??0),number(assignment.liberado??0)])<quantity)throw fail('La reserva histórica no conserva evidencia suficiente.');
    // Read-only preservation: never recreate or move a historical reservation.
    completedStock.add(ref.productKey);continue;
   }
   const assignment=original.asignaciones?.[saleKey];if(assignment&&['reservado','consumido','liberado'].some(field=>number(assignment[field]??0)>0)||Object.values(original.rendicionesOT||{}).some(row=>row?.venta===saleKey))throw fail('La preparación tiene movimientos sin reserva atribuible.');
   const operationId=body.id+'_stock',existing=plan.patch[inventoryPath]||original,reserved=Inventory.planExistingReservation({id:operationId,at,inventories:{[ref.inventoryKey]:existing},references:{[identity]:ref},identity,allocationKey:saleKey,saleNumber:order.ventaId||'',quantity});
   plan.patch[inventoryPath]=reserved.patch[inventoryPath];if(!Object.hasOwn(plan.preconditions,inventoryPath))plan.preconditions[inventoryPath]=structuredClone(original);
   nextList.reservasInventario={...(nextList.reservasInventario||{}),[ref.productKey]:{inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey,quantity,operationId,sources}};completedStock.add(ref.productKey);
  }
  if(nextList&&sale){const resolvedLines=new Map([...lineByOrder].map(([index,lineIndex])=>[lineIndex,references[order.items[index].productoKey||order.items[index].codigo].productKey]));if(sale.items.every((line,index)=>!line.preparacionCompra||number(line.preparacionCompra.cantidadStock)===0||completedStock.has(resolvedLines.get(index))))nextList.stockExistenteReservado=true;}
 }
 if(body.kind==='receive'&&nextSale){
  const fx=FX.terms(order,body.exchangeRate);
  if(Object.hasOwn(nextSale.recepcionesAplicadas||{},body.id))throw fail('La recepción previa requiere consultar su recibo.');
  for(const movement of body.movements){const row=order.items[movement.index];if(FX.destination(order,row)==='stock')continue;const index=lineByOrder.get(movement.index),before=nextSale.items[index],budget=FX.budgetARS(order,row,before),canonical={...row,productoKey:references[row.productoKey||row.codigo].productKey,...(fx.currency==='USD'?{costoUnitarioPresupuestado:budget,costoUnitario:budget}:{})},effective=FX.provider(order,movement,input.providers),next=Costs.apply(before,canonical,{qty:movement.quantity,costoUnitarioReal:FX.convert(movement.realUnitCost,fx),proveedor:effective.name,proveedorKey:effective.key});
   if(fx.currency==='USD')plan.patch['sisventas/ordenes/'+body.orderKey].items[movement.index].costoUnitarioPresupuestadoARS=budget;
   for(const field of ['costoUnitarioAntesPreparacion','costoUnitarioPresupuestado','costoTotalPresupuestado'])if(before[field]!=null){if(Math.abs(number(before[field])-number(next[field]))>0.000001)throw fail('El snapshot de costo histórico no coincide con la preparación.');next[field]=before[field];}
   nextSale.items[index]=next;
  }
  nextSale.costoTotal=Money.quantitySum(nextSale.items.map(row=>number(row.costoTotalCompra)));const income=number(nextSale.subtotal);if(income<=0)throw fail('Falta la base neta original de la venta.');nextSale.margenPct=(income-nextSale.costoTotal)/income*100;
  nextSale.recepcionesAplicadas={...(nextSale.recepcionesAplicadas||{}),[body.id]:at};nextSale.compraEstado='recepcion_parcial';
  const ownAfter=plan.patch['sisventas/ordenes/'+body.orderKey],all=nextSale.ordenesCompraIds.map(id=>id===body.orderKey?ownAfter:otherOrders[id]);if(all.every(o=>o&&['recibida','cancelada'].includes(o.estado)))nextSale.compraEstado='recibida_parcial_o_total';
  nextSale.conciliacionCompraActualizadaEn=at;nextSale.conciliacionCompraActualizadaPor=actorName;
 }
 if(nextSale)write('sisventas/ventas/'+saleKey,sale,nextSale);if(nextList)write('sisventas/listas_materiales/'+listKey,list,nextList);
 plan.readDependencies={...(sale?{['sisventas/ventas/'+saleKey]:structuredClone(sale)}:{}),...(list?{['sisventas/listas_materiales/'+listKey]:structuredClone(list)}:{})};
 // No payment, commission, fiscal document or OT is part of this plan.
 for(const path of Object.keys(plan.patch))if(!/^sisventas\/(ordenes|inventario_operativo|ventas|listas_materiales)\//.test(path))throw fail('El plan excede sus fuentes comerciales.');
 plan.linkedSourceHash=digest({sale,list});return plan;
}
module.exports={build};
