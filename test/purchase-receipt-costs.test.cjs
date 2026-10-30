'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Model=require('../js/core/purchase-receipt-costs.v1'),Preparation=require('../js/modules/exterior-preparation');
const cost=item=>item.costoTotalCompra??item.costoUnitarioCompra*item.qty;
test('planned sale cost includes shipping and the effective USDT rate exactly once',()=>{
 for(const parameters of [{usd:1000,payment:'USD',shippingInsuredUSD:20,remoteOther:0,extraLogisticsUSD:0},{usd:1000,payment:'USDT',usdt:1200,usdtPerUsd:1.02,fee:2,balance:0,shippingInsuredUSD:20,remoteOther:0,extraLogisticsUSD:0}]){
  const sale={fecha:'2025-12-31',total:500000,descuento:5,pagos:[{monto:10}],comisiones:[{importe:1}],items:[{cod:'P1',qty:2,costoUnitarioCompra:150000}]},before=structuredClone(sale);
  const snapshot=Preparation.calculateDraft({parameters:{...parameters,baseline:300000,revenue:500000},rows:[{code:'P1',key:'P1|0|p',sourceLine:0,needed:2,existing:0,baselineUnit:150000,method:'exterior',providerKey:'p',provider:'Proveedor',agreed:100,reference:{amount:100,currency:'USD'}}],extras:[],chosen:'remote'});
  const next=Preparation.applySaleCosts(sale,snapshot.rows,1000,cost,()=>500000);
  assert.equal(next.costoTotal,snapshot.result.orderTotal);assert.equal(next.items[0].costoUnitarioAntesPreparacion,150000);assert.equal(next.fecha,before.fecha);assert.equal(next.total,before.total);assert.deepEqual(next.pagos,before.pagos);assert.deepEqual(next.comisiones,before.comisiones);assert.deepEqual(sale,before);
 }
});
test('two equal product codes resolve by captured source line, quantity and original cost',()=>{
 const items=[{cod:'P1',qty:2,costoUnitarioCompra:100},{cod:'P1',qty:3,costoUnitarioCompra:200}],row={codigo:'P1',sourceLine:'list:1',sourceSaleQty:3,sourceOriginalUnit:200};
 assert.equal(Model.resolve(items,row),1);assert.throws(()=>Model.resolve(items,{codigo:'P1'}),/varios renglones/);assert.throws(()=>Model.resolve(items,{...row,sourceSaleQty:4}),/Cambió/);assert.throws(()=>Model.resolve(items,{...row,sourceOriginalUnit:100}),/Cambió/);
});
test('mixed office stock and purchased materials preserve their distinct costs through partial receipts',()=>{
 const original={cod:'P1',qty:5,costoUnitarioAntesPreparacion:50,costoUnitarioCompra:92,preparacionCompra:{cantidadStock:2,costoStockUnitario:50,cantidadComprar:3,costoCompraUnitario:120}},row={codigo:'P1'},movement={qty:1,costoUnitarioReal:110,proveedor:'Proveedor',proveedorKey:'p'};
 const first=Model.apply(original,row,movement,cost);assert.equal(first.costoTotalCompra,450);assert.equal(first.costoTotalPresupuestado,460);assert.equal(first.costoUnitarioAntesPreparacion,50);assert.equal(original.cantidadCompraReal,undefined);
 const second=Model.apply(first,row,{...movement,qty:2,costoUnitarioReal:120},cost);assert.equal(second.costoTotalCompra,450);assert.equal(second.cantidadCompraReal,3);assert.equal(second.costoUnitarioAntesPreparacion,50);assert.throws(()=>Model.apply(second,row,movement,cost),/supera/);
});
test('zero original cost and fractional quantities do not fall back to another price',()=>{
 const item={cod:'P1',qty:0.5,costoUnitarioPresupuestado:0,costoUnitarioCompra:0},next=Model.apply(item,{costoUnitarioPresupuestado:900},{qty:0.25,costoUnitarioReal:80},cost);
 assert.equal(next.costoUnitarioAntesPreparacion,0);assert.equal(next.costoTotalPresupuestado,0);assert.equal(next.costoTotalCompra,20);assert.equal(next.cantidadCompraReal,0.25);
});
