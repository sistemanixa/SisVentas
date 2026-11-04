'use strict';
const Costs=require('./commercial-models/purchase-receipt-costs.v1.js');
const Money=require('./commercial-models/commercial-money');
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_DELETE_BLOCKED'});
const copy=value=>structuredClone(value);
const inventoryKey=value=>{const result=String(value||'sin_referencia').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);if(['__proto__','constructor','prototype'].includes(result))throw fail('Clave de inventario inválida.');return result;};
const key=value=>{if(typeof value!=='string'||!value||/[.#$\[\]\/\x00-\x1f]/.test(value))throw fail('Referencia inválida.');return value;};
const number=value=>{if(value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0)throw fail('Falta una cantidad o costo original válido.');return Number(value);};
function prepareOrderDeletion({order,inventoryByKey,sale,list}){
 if(!order||order._svListSummary||order._svPagedSummary)throw fail('Hace falta la orden original completa.');
 const orderKey=key(order.fbKey);if(orderKey.startsWith('plan_')||order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente)throw fail('Completá la recepción pendiente o cancelá la orden; conserva su trazabilidad.');
 if(!Array.isArray(order.items))throw fail('Los materiales requieren revisión.');
 const patch={},preconditions={};const write=(path,before,after)=>{preconditions[path]=copy(before);patch[path]=copy(after);};
 const refs=(record,field)=>{const raw=record[field];if(!Array.isArray(raw)||raw.some(value=>typeof value!=='string'))throw fail('Los vínculos de compra requieren revisión.');return raw;};
 if(order.ventaId&&!order.ventaFbKey)throw fail('Falta resolver la referencia técnica de la venta.');
 let nextSale;if(order.ventaFbKey){key(order.ventaFbKey);if(!sale)throw fail('Falta la venta original.');nextSale=copy(sale);const remaining=refs(sale,'ordenesCompraIds').filter(id=>id!==orderKey);if(!sale.ordenesCompraIds.includes(orderKey))throw fail('La venta ya no referencia esta orden.');nextSale.ordenesCompraIds=remaining;if(!remaining.length)nextSale.compraEstado='preparacion';}
 if(order.listaMaterialesId){key(order.listaMaterialesId);if(!list)throw fail('Falta la lista original.');const next=copy(list);next.ordenesIds=refs(list,'ordenesIds').filter(id=>id!==orderKey);if(!list.ordenesIds.includes(orderKey))throw fail('La lista ya no referencia esta orden.');if(!next.ordenesIds.length)next.estado='preparacion';write('sisventas/listas_materiales/'+order.listaMaterialesId,list,next);}
 const inventories=new Map(),identities=new Map(),matched=new Set();let costsChanged=false;
 for(const item of order.items){
  const ordered=number(item.cantidadOrdenada??item.cantidad),received=number(item.cantidadRecibida??0);if(received>ordered)throw fail('La recepción supera lo ordenado.');
  if(order.estado==='cancelada')continue;
  const pending=Money.quantitySum([ordered,-received]);if(!pending&&!received)continue;
  const identity=item.productoKey||item.codigo;if(!identity)throw fail('Falta identificar el producto.');const product=inventoryKey(identity);if(identities.has(product)&&identities.get(product)!==identity)throw fail('Dos productos comparten la misma clave de inventario.');identities.set(product,identity);let inv=inventories.get(product);if(!inv){if(!inventoryByKey?.[product])throw fail('Falta el inventario original.');inv=copy(inventoryByKey[product]);inventories.set(product,inv);}
  const subtract=(record,field,amount)=>{if(!amount)return;const before=number(record[field]);if(before<amount)throw fail('Stock insuficiente para revertir; revisá entregas o devoluciones.');record[field]=Money.quantitySum([before,-amount]);};
  subtract(inv,'enCompra',pending);
  if(received&&nextSale){subtract(inv,'reservado',received);const allocation=inv.asignaciones?.[order.ventaFbKey];if(!allocation)throw fail('Falta la asignación original de stock.');subtract(allocation,'reservado',received);
   if(nextSale.ordenesCompraIds.length)throw fail('Hay otras órdenes: falta atribuir los costos recibidos a esta orden.');
   if(!Array.isArray(nextSale.items))throw fail('Faltan los renglones originales de venta.');const index=Costs.resolve(nextSale.items,item);if(matched.has(index))throw fail('Varios materiales apuntan al mismo renglón.');matched.add(index);const line=nextSale.items[index];
   if(number(line.cantidadCompraReal)!==received)throw fail('La cantidad conciliada no corresponde exclusivamente a esta recepción.');
   const total=number(line.costoTotalPresupuestado),unit=number(line.costoUnitarioPresupuestado),quantity=Costs.quantity(line);
   if(Money.amount(total)!==Money.product(unit,quantity))throw fail('Los snapshots de costo presupuestado son contradictorios.');
   if(line.preparacionCompra){const plan=line.preparacionCompra,stock=number(plan.cantidadStock),purchased=number(plan.cantidadComprar);if(Money.quantitySum([stock,purchased])!==quantity||received>purchased)throw fail('La preparación no coincide con las cantidades originales.');const planned=Money.sum([Money.rawProduct(stock,number(plan.costoStockUnitario)),Money.rawProduct(purchased,number(plan.costoCompraUnitario))]);if(planned!==Money.amount(total))throw fail('La preparación no coincide con el costo presupuestado original.');}
   Object.assign(line,{cantidadCompraReal:0,costoRealCompraAcumulado:0,costoTotalCompra:total,costoUnitarioCompra:unit});for(const field of ['ultimoCostoCompraReal','proveedorCompraReal','proveedorCompraRealKey'])delete line[field];costsChanged=true;
  }else if(received)subtract(inv,'general',received);
 }
 if(costsChanged){nextSale.costoTotal=Money.sum(nextSale.items.map(line=>number(line.costoTotalCompra)));const income=number(nextSale.subtotal);if(income<=0)throw fail('Falta una base neta positiva para conservar las métricas.');nextSale.margenPct=Money.quantitySum([income,-nextSale.costoTotal])/income*100;}
 for(const [product,inventory]of inventories)write('sisventas/inventario_operativo/'+product,inventoryByKey[product],inventory);
 if(nextSale)write('sisventas/ventas/'+order.ventaFbKey,sale,nextSale);
 const original=copy(order);delete original.fbKey;write('sisventas/ordenes/'+orderKey,original,null);
 return {patch,preconditions};
}
module.exports={prepareOrderDeletion,inventoryKey};
