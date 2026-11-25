'use strict';
const Money = require('./commercial-models/commercial-money');
const Costs = require('./commercial-models/purchase-receipt-costs.v1');
const FX=require('./purchase-receipt-fx');
const clone = value => structuredClone(value);
const fail = message => Object.assign(new Error(message), {statusCode:409, code:'SV_PURCHASE_RECONCILE_REVIEW'});
const n = value => { if(typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw fail('Falta una cantidad o costo original válido.'); return value; };
const key = value => { if(typeof value !== 'string' || !value || /[.#$\[\]/\u0000-\u001f]/.test(value)) throw fail('Clave inválida.'); return value; };
const sum = values => Money.quantitySum(values);
function same(a,b,message) { if(a !== b) throw fail(message); }
function full(record) { if(!record || record._svSummary || record._svListSummary || record._svPagedSummary || !Array.isArray(record.items)) throw fail('Falta el original completo.'); }
function received(row) {
 const qty=n(row.cantidadRecibida??0), accounted=n(row.cantidadCostoReal??row.cantidadRecibida??0);
 same(qty,accounted,'La cantidad recibida y su costo no coinciden.');
 if(qty>n(row.cantidadOrdenada??row.cantidad)) throw fail('La recepción supera la orden.');
 if(qty>0) { n(row.costoRealAcumulado); n(row.costoUnitarioReal); n(row.costoUnitarioPresupuestado); }
 return qty;
}
function sourceLine(sale,row) {
 if(row.sourceLine==null || row.sourceSaleQty==null || row.sourceOriginalUnit==null) throw fail('Faltan snapshots del renglón de venta.');
 n(row.sourceSaleQty);n(row.sourceOriginalUnit);
 try { const index=Costs.resolve(sale.items,row);same(Costs.original(sale.items[index]),row.sourceOriginalUnit,'Cambió el costo original de venta.');return index; } catch(error) { throw fail(error.message); }
}
function plan({order,orderKey,sale,list,otherOrders={},providers,body,context}) {
 key(orderKey); full(order);
 if(!context || !key(context.id) || !Number.isSafeInteger(context.at) || context.at<=0 || typeof context.actor!=='string' || !context.actor.trim()) throw fail('Falta el contexto del servidor.');
 if(order.recepcionPendiente || order.generacionPendiente || order.cancelacionPendiente || order.estado==='cancelada') throw fail('La orden requiere resolver su operación pendiente.');
 if(!body || Object.keys(body).some(k=>!['movements','exchangeRate'].includes(k)) || !Array.isArray(body.movements) || !body.movements.length) throw fail('Faltan correcciones de recepción.');
 const fx=FX.terms(order,body.exchangeRate);
 // A single-sale input cannot establish allocations of a joint/external purchase.
 if(order.listaOrigenId || order.compraVentaReferencia || list?.origen==='conjunta' || list?.sources?.length || order.items.some(row=>row.sourceListId)) throw fail('Las fuentes conjuntas o externas requieren revisión completa.');
 if(order.ventaId && !order.ventaFbKey) throw fail('Falta el vínculo canónico de venta.');
 if(Boolean(sale)!==Boolean(order.ventaFbKey) || Boolean(list)!==Boolean(order.listaMaterialesId)) throw fail('Faltan las fuentes vinculadas o hay fuentes ajenas.');
 const patch={},preconditions={},readDependencies={};
 const depend=(path,value)=>{readDependencies[path]=clone(value);};
 const write=(path,before,after)=>{preconditions[path]=clone(before);patch[path]=clone(after);depend(path,before);};
 const next=clone(order),seen=new Set(),changes=[];
 order.items.forEach(received);
 for(const movement of body.movements) {
  if(!movement || Object.keys(movement).some(k=>!['index','realUnitCost','providerKey'].includes(k)) || !Number.isSafeInteger(movement.index) || !order.items[movement.index] || seen.has(movement.index)) throw fail('Renglón inválido o repetido.');
  seen.add(movement.index); const row=order.items[movement.index],qty=received(row),unit=n(movement.realUnitCost),providerKey=key(movement.providerKey),provider=providers?.[providerKey];
  if(!qty || !unit || !provider || provider.eliminado || provider.activo===false || typeof provider.nombre!=='string' || !provider.nombre.trim()) throw fail('Falta recepción, costo o proveedor real válido.');
  depend('sisventas/proveedores/'+providerKey,provider);
  const total=Money.rawProduct(qty,unit),deltaOriginal=sum([total,-row.costoRealAcumulado]),unitARS=FX.convert(unit,fx),totalARS=Money.rawProduct(qty,unitARS),delta=sum([totalARS,-FX.priorARS(order,row,qty)]);
  Object.assign(next.items[movement.index],{costoUnitarioReal:unit,ultimoCostoReal:unit,costoRealAcumulado:total,proveedorFinalKey:providerKey,proveedorFinal:provider.nombre.trim()});
  if(fx.currency==='USD')Object.assign(next.items[movement.index],{costoUnitarioRealARS:unitARS,ultimoCostoRealARS:unitARS,costoRealAcumuladoARS:totalARS,monedaCostoReal:'USD',cotizacionUltimaRecepcion:fx.rate,cotizacionRegistradaEn:context.at,cotizacionRegistradaPor:context.actor});
  changes.push({index:movement.index,delta,deltaOriginal,unit:unitARS,providerKey,provider:provider.nombre.trim()});
 }
 next.totalRealRecibido=sum(next.items.map(row=>n(row.costoRealAcumulado??0)));
 next.totalPresupuestadoRecibido=sum(next.items.map(row=>Money.rawProduct(received(row),n(row.costoUnitarioPresupuestado??row.costoUnitario))));
 next.diferenciaCompra=sum([next.totalPresupuestadoRecibido,-next.totalRealRecibido]);
 next.proveedoresFinales=[...new Set(next.items.map(row=>row.proveedorFinal).filter(Boolean))];
 next.proveedorFinalResumen=next.proveedoresFinales.length===1?next.proveedoresFinales[0]:next.proveedoresFinales.length?'Varios proveedores':order.proveedor||'Sin proveedor';
 next.conciliacionEditadaEn=context.at;next.conciliacionEditadaPor=context.actor;
 if(fx.currency==='USD'){next.totalRealRecibidoARS=sum(next.items.map(row=>FX.priorARS(order,row,received(row))));next.conciliacionCotizacion={...FX.stamp(fx,context.at,context.actor),operationId:context.id};}
 if(list) {
  full(list); key(order.listaMaterialesId);
  if(!Array.isArray(list.ordenesIds) || !list.ordenesIds.includes(orderKey) || (sale && list.ventaFbKey!==order.ventaFbKey)) throw fail('Cambió el vínculo de la preparación.');
  depend('sisventas/listas_materiales/'+order.listaMaterialesId,list);
 }
 if(sale) {
  full(sale);key(order.ventaFbKey);
  if(sale.eliminado || sale.anulada || sale.anulado || !Array.isArray(sale.ordenesCompraIds) || new Set(sale.ordenesCompraIds).size!==sale.ordenesCompraIds.length || !sale.ordenesCompraIds.includes(orderKey) || (list && sale.listaMaterialesId!==order.listaMaterialesId)) throw fail('Cambió el vínculo de la venta.');
  same(n(sale.costoTotal),sum(sale.items.map(row=>n(row.costoTotalCompra))),'El total original de venta requiere revisión.');
  const contributions=new Map();
  for(const id of sale.ordenesCompraIds) {
   key(id);const original=id===orderKey?order:otherOrders[id];full(original);
   if(original.ventaFbKey!==order.ventaFbKey || original.listaOrigenId || original.recepcionPendiente || original.generacionPendiente || original.cancelacionPendiente || original.items.some(row=>row.sourceListId)) throw fail('Falta una fuente de recepción inequívoca.');
   depend('sisventas/ordenes/'+id,original);
   for(const row of original.items) {
    if(FX.destination(original,row)==='stock')continue;
    if(typeof row.sourceLine==='string' && row.sourceLine.startsWith('sale:') && !row.sourceLine.startsWith('sale:'+order.ventaFbKey+':')) throw fail('El snapshot pertenece a otra venta.');
    const index=sourceLine(sale,row),qty=received(row),acc=contributions.get(index)||{qty:0,total:0,ordered:0};
    acc.qty=sum([acc.qty,qty]);acc.total=sum([acc.total,FX.priorARS(original,row,qty)]);
    if(original.estado!=='cancelada')acc.ordered=sum([acc.ordered,n(row.cantidadOrdenada??row.cantidad)]);
    contributions.set(index,acc);
   }
  }
  const updated=clone(sale),deltas=new Map();
  for(const change of changes) { if(FX.destination(order,order.items[change.index])==='stock')continue;const index=sourceLine(sale,order.items[change.index]),entry=deltas.get(index)||{delta:0,changes:[]};entry.delta=sum([entry.delta,change.delta]);entry.changes.push(change);deltas.set(index,entry); }
  for(const [index,entry] of deltas) {
   const row=sale.items[index],target=updated.items[index],acc=contributions.get(index),qty=Costs.quantity(row),prep=row.preparacionCompra;
   if(!prep || row.costoUnitarioAntesPreparacion==null || row.costoTotalPresupuestado==null || row.costoUnitarioPresupuestado==null) throw fail('Faltan snapshots originales de preparación.');
   const stock=n(prep.cantidadStock),buy=n(prep.cantidadComprar),budget=n(prep.costoCompraUnitario),stockCost=Money.rawProduct(stock,n(prep.costoStockUnitario));
   same(sum([stock,buy]),qty,'La preparación no conserva la cantidad de venta.');
   if(acc.ordered>buy || acc.qty>buy) throw fail('Las órdenes exceden la preparación.');
   same(n(row.cantidadCompraReal),acc.qty,'Faltan cantidades agregadas atribuibles.');same(n(row.costoRealCompraAcumulado),acc.total,'Faltan costos agregados atribuibles.');
   const expected=sum([stockCost,acc.total,Money.rawProduct(sum([buy,-acc.qty]),budget)]);
   same(n(row.costoTotalCompra),Money.amount(expected),'El costo agregado no coincide con sus fuentes.');
   same(Money.amount(n(row.costoTotalPresupuestado)),Money.amount(sum([stockCost,Money.rawProduct(buy,budget)])),'El presupuesto original cambió.');
   for(const id of sale.ordenesCompraIds){const original=id===orderKey?order:otherOrders[id];for(const item of original.items)if(FX.destination(original,item)==='sale'&&sourceLine(sale,item)===index) same(FX.budgetARS(original,item,sale.items[index]),budget,'El precio capturado no coincide con la preparación.');}
   target.costoRealCompraAcumulado=sum([acc.total,entry.delta]);
   const effective=sum([expected,entry.delta]);target.costoTotalCompra=Money.amount(effective);target.costoUnitarioCompra=Money.quotient(effective,qty);
   // Provider/latest-unit metadata describes the whole line only for one source.
   const sources=sale.ordenesCompraIds.flatMap(id=>{const original=id===orderKey?order:otherOrders[id];return original.items.filter(item=>FX.destination(original,item)==='sale'&&sourceLine(sale,item)===index&&received(item)>0);});
   if(sources.length===1 && entry.changes.length===1) {const change=entry.changes[0];target.ultimoCostoCompraReal=change.unit;target.proveedorCompraReal=change.provider;target.proveedorCompraRealKey=change.providerKey;}
  }
  if(deltas.size){updated.costoTotal=sum(updated.items.map(row=>n(row.costoTotalCompra)));
  if(n(sale.subtotal)<=0) throw fail('Falta el ingreso neto original.');
  updated.margenPct=(sale.subtotal-updated.costoTotal)/sale.subtotal*100;
  updated.conciliacionCompraActualizadaEn=context.at;updated.conciliacionCompraActualizadaPor=context.actor;
  write('sisventas/ventas/'+order.ventaFbKey,sale,updated);}
 }
 // No inventory was supplied: even general stock reference costs remain untouched.
 write('sisventas/ordenes/'+orderKey,order,next);
 return {patch,preconditions,readDependencies,result:{orderKey,reconciled:changes.length,costDelta:sum(changes.map(change=>change.deltaOriginal)),...(fx.currency==='USD'?{costDeltaARS:sum(changes.map(change=>change.delta))}:{}),inventoryChanged:false}};
}
module.exports=Object.freeze({plan});
