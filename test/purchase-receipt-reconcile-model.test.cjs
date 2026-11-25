'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plan}=require('../cotizador/purchase-receipt-reconcile-model');
function fixture() {
 const item={productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:2,cantidadCostoReal:2,costoUnitario:10,costoUnitarioPresupuestado:10,costoUnitarioReal:12,costoRealAcumulado:24,sourceLine:'sale:s:0',sourceSaleQty:5,sourceOriginalUnit:10,precioPublico:40};
 const order={ventaFbKey:'s',listaMaterialesId:'l',estado:'recibida',creadoPor:'original',creadoEn:10,recibidoEn:20,recepciones:[{id:'receipt',ts:20}],items:[item],inventarioCompra:{revision:2},pagos:[{id:'paid'}]};
 const sale={listaMaterialesId:'l',ordenesCompraIds:['o'],subtotal:200,total:242,iva:42,descuento:0,pagada:true,pagos:[{id:'payment'}],comisiones:{paid:88},jobs:{id:1},autor:'author',fecha:1,costoTotal:54,items:[{productoKey:'p',qty:5,punit:40,subtotal:200,iva:42,discount:0,costoUnitarioAntesPreparacion:10,costoUnitarioPresupuestado:10,costoTotalPresupuestado:50,costoTotalCompra:54,costoUnitarioCompra:10.8,cantidadCompraReal:2,costoRealCompraAcumulado:24,preparacionCompra:{cantidadStock:1,cantidadComprar:4,costoStockUnitario:10,costoCompraUnitario:10}}]};
 return {order,orderKey:'o',sale,list:{ventaFbKey:'s',ordenesIds:['o'],items:[{precioPublico:40}],saved:1},providers:{v:{nombre:'Proveedor real',rawPrecision:1.234567}},body:{movements:[{index:0,realUnitCost:13.123456,providerKey:'v'}]},context:{id:'op',at:100,actor:'operator'}};
}
const review=input=>assert.throws(()=>plan(input),{code:'SV_PURCHASE_RECONCILE_REVIEW'});
test('paid canonical sale: exact contribution delta, raw supplier precision and immutable originals',()=>{
 const input=fixture(),original=structuredClone(input),out=plan(input),order=out.patch['sisventas/ordenes/o'],sale=out.patch['sisventas/ventas/s'];
 assert.deepEqual(input,original);assert.equal(order.items[0].costoUnitarioReal,13.123456);assert.equal(order.items[0].costoRealAcumulado,26.246912);assert.equal(out.result.costDelta,2.246912);assert.equal(sale.items[0].costoRealCompraAcumulado,26.246912);assert.equal(sale.items[0].costoTotalCompra,56.25);
 for(const k of ['creadoPor','creadoEn','recibidoEn','recepciones','inventarioCompra','pagos'])assert.deepEqual(order[k],input.order[k]);
 for(const k of ['total','subtotal','iva','descuento','pagada','pagos','comisiones','jobs','autor','fecha'])assert.deepEqual(sale[k],input.sale[k]);
 for(const k of ['qty','punit','subtotal','iva','discount','preparacionCompra','costoUnitarioAntesPreparacion','costoTotalPresupuestado','costoUnitarioPresupuestado'])assert.deepEqual(sale.items[0][k],input.sale.items[0][k]);
 assert.deepEqual(out.preconditions['sisventas/ordenes/o'],input.order);assert.deepEqual(out.readDependencies['sisventas/listas_materiales/l'],input.list);
 assert.deepEqual(Object.keys(out.patch).sort(),['sisventas/ordenes/o','sisventas/ventas/s']);
});
test('legacy quantity alias with captured snapshots is preserved',()=>{const input=fixture();input.sale.items[0].cantidad=5;delete input.sale.items[0].qty;delete input.order.items[0].cantidadCostoReal;const out=plan(input);assert.equal(out.patch['sisventas/ventas/s'].items[0].cantidad,5);assert.equal(Object.hasOwn(out.patch['sisventas/ordenes/o'].items[0],'cantidadCostoReal'),false);});
test('multiple orders keep other contribution and ambiguous provider metadata unchanged',()=>{
 const input=fixture();input.sale.ordenesCompraIds.push('other');input.otherOrders={other:structuredClone(input.order)};const other=input.otherOrders.other.items[0];other.cantidadOrdenada=2;other.cantidadRecibida=1;other.cantidadCostoReal=1;other.costoRealAcumulado=20;other.costoUnitarioReal=20;
 input.sale.costoTotal=64;Object.assign(input.sale.items[0],{cantidadCompraReal:3,costoRealCompraAcumulado:44,costoTotalCompra:64,proveedorCompraReal:'Mixed',ultimoCostoCompraReal:20});
 const out=plan(input),line=out.patch['sisventas/ventas/s'].items[0];assert.equal(line.costoRealCompraAcumulado,46.246912);assert.equal(line.costoTotalCompra,66.25);assert.equal(line.cantidadCompraReal,3);assert.equal(line.proveedorCompraReal,'Mixed');assert.equal(line.ultimoCostoCompraReal,20);assert.deepEqual(out.readDependencies['sisventas/ordenes/other'],input.otherOrders.other);assert.equal(out.patch['sisventas/ordenes/other'],undefined);
});
test('general purchase never changes stock or reference cost without inventory evidence',()=>{const input=fixture();delete input.order.ventaFbKey;delete input.order.listaMaterialesId;delete input.sale;delete input.list;const out=plan(input);assert.deepEqual(Object.keys(out.patch),['sisventas/ordenes/o']);assert.equal(out.result.inventoryChanged,false);});
test('negative delta and repeat reconciliation do not compound costs',()=>{const input=fixture();input.body.movements[0].realUnitCost=9;const first=plan(input);assert.equal(first.result.costDelta,-6);assert.equal(first.patch['sisventas/ventas/s'].items[0].costoTotalCompra,48);input.order=first.patch['sisventas/ordenes/o'];input.sale=first.patch['sisventas/ventas/s'];input.context.id='next';input.context.at=101;const second=plan(input);assert.equal(second.result.costDelta,0);assert.equal(second.patch['sisventas/ventas/s'].items[0].costoRealCompraAcumulado,18);});
test('multiple changed rows to one sale line aggregate their deltas once',()=>{const input=fixture();const row=structuredClone(input.order.items[0]);for(const item of [row,input.order.items[0]]){item.cantidadOrdenada=1;item.cantidadRecibida=1;item.cantidadCostoReal=1;item.costoRealAcumulado=12;}input.order.items.push(row);input.body.movements.push({index:1,realUnitCost:15,providerKey:'v'});const out=plan(input);assert.equal(out.result.costDelta,4.123456);assert.equal(out.patch['sisventas/ventas/s'].items[0].costoRealCompraAcumulado,28.123456);});
test('joint purchase fails closed and preserves grouped sources',()=>{const input=fixture();input.list.origen='conjunta';input.list.sources=[{ventaFbKey:'s'},{ventaFbKey:'another'}];const before=structuredClone(input);review(input);assert.deepEqual(input,before);});
for(const [name,modify]of Object.entries({
 missingSnapshot:i=>delete i.order.items[0].sourceOriginalUnit,
 missingPreparation:i=>delete i.sale.items[0].preparacionCompra,
 missingCapturedBudget:i=>delete i.order.items[0].costoUnitarioPresupuestado,
 missingOtherOrder:i=>i.sale.ordenesCompraIds.push('missing'),
 aggregateQuantity:i=>i.sale.items[0].cantidadCompraReal=1,
 aggregateCost:i=>i.sale.items[0].costoRealCompraAcumulado=20,
 aggregateEffectiveCost:i=>i.sale.items[0].costoTotalCompra=55,
 excessReceived:i=>i.order.items[0].cantidadRecibida=3,
 mismatchedQuantity:i=>i.order.items[0].cantidadCostoReal=1,
 pendingReceipt:i=>i.order.recepcionPendiente={id:'pending'},
 providerMissing:i=>delete i.providers.v,
 unknownQuantityControl:i=>i.body.movements[0].quantity=1,
 duplicateMovement:i=>i.body.movements.push({...i.body.movements[0]}),
 unknownBodyControl:i=>i.body.stock=100,
 listMismatch:i=>i.list.ventaFbKey='another',
 ambiguousLegacyLine:i=>delete i.order.items[0].sourceLine,
 invalidCost:i=>i.body.movements[0].realUnitCost=NaN,
 cancelled:i=>i.order.estado='cancelada',
 originalBudgetChanged:i=>i.sale.items[0].costoTotalPresupuestado=49,
 originalSaleTotalChanged:i=>i.sale.costoTotal=99,
 snapshotForeignSale:i=>i.order.items[0].sourceLine='sale:another:0',
 summary:i=>i.order._svSummary=true
}))test('reject '+name+' without mutation',()=>{const input=fixture();modify(input);const before=structuredClone(input);review(input);assert.deepEqual(input,before);});
