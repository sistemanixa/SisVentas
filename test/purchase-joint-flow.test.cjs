'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createFixture,legacyModule,LEGACY_SHA,clone}=require('./helpers/purchase-focal-ui-fixture.cjs');
const P=require('../js/modules/exterior-preparation'),{calculate}=require('../js/modules/paraguay-planner.js');
const inventoryPath='sisventas/inventario_operativo/P1',listPath=id=>'sisventas/listas_materiales/'+id,salePath=id=>'sisventas/ventas/'+id,orderPath=id=>'sisventas/ordenes/'+id;
const capturedSources=[{listId:'A',ventaId:'VA',ventaFbKey:'SA',cliente:'Cliente'},{listId:'B',ventaId:'VB',ventaFbKey:'SB',cliente:'Cliente'}];
function historicalSimulation(){
 // These exact original allocation/exclusion assertions belong to the old form.
 const parameters={usd:1000,usdt:1000,bus:101.01,allocation:'value',shippingMode:'insured',shippingInsuredUSD:0};
 const rows=[{key:'P1|A:0|PY',sourceListId:'A',productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',qty:1,usd:10,include:true,existing:1},{key:'P1|B:0|PY',sourceListId:'B',productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',qty:2,usd:10,include:true,existing:1,expenseExcluded:true}];
 const result=calculate(parameters,rows);assert.deepEqual(result.onsiteAllocation,[101.01,0]);assert.equal(result.onsite,30101.01);
 return {complete:true,chosen:'onsite',parameters,result,rows,extras:[{productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',qty:1,usd:10}]};
}
function futureSimulation(){
 const rows=[{key:'P1|A:0|PY',sourceListId:'A',productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',description:'Material ficticio',needed:2,qty:1,requestedQty:1,sourceQty:1,existing:1,method:'exterior',include:true,agreed:10,usd:10,baselinePart:20000,reference:{currency:'USD',amount:10,providerKey:'PY'}},{key:'P1|B:0|PY',sourceListId:'B',productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',description:'Material ficticio',needed:3,qty:2,requestedQty:2,sourceQty:2,existing:1,method:'exterior',include:true,agreed:10,usd:10,baselinePart:30000,reference:{currency:'USD',amount:10,providerKey:'PY'}}];
 const saved={version:6,chosen:'onsite',parameters:{usd:1000,usdMode:'manual',usdt:1000,usdtExchange:'manual',payment:'USD',usdtPerUsd:1,allocation:'value',shippingMode:'insured',shippingInsuredUSD:0,tripTotalARS:101.01,extraLogisticsUSD:0},rows,extras:[{productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',description:'Extra ficticio',qty:1,method:'exterior',include:true,agreed:10,reference:{currency:'USD',amount:10,providerKey:'PY'}}]};
 const sim=P.calculateDraft(P.initialize({rows,saved,initial:{revenue:75000,baseline:50000}}));assert.equal(sim.complete,true,sim.pending.join(', '));assert.equal(Math.round(sim.result.orderTotal*100),4010101);return sim;
}
function setup({historical=false}={}){
 const sim=historical?historicalSimulation():futureSimulation(),list={fbKey:'CJ',numero:'CJ',estado:'preparacion',origen:'conjunta',sources:clone(capturedSources),simuladorParaguay:sim,items:sim.rows.map(r=>({sourceListId:r.sourceListId,productoKey:r.productKey,codigo:r.code,descripcion:'Material ficticio',linea:r.sourceListId+':0',proveedorKey:'PY',cantidadNecesaria:r.qty+r.existing,incluir:true}))};
 const records={[inventoryPath]:{codigo:'P1',general:2,enCompra:0,reservado:0,consumido:0,asignaciones:{},operaciones:{}},[listPath('CJ')]:clone(list)};delete records[listPath('CJ')].fbKey;
 for(const [index,source]of capturedSources.entries()){
  const qty=index===0?2:3;
  // Captured originals exist BEFORE any command; no reconstructed receipt history.
  records[salePath(source.ventaFbKey)]={id:source.ventaId,listaMaterialesId:source.listId,ordenesCompraIds:[],items:[{productoKey:'P1',codigo:'P1',qty,punit:15000,costoUnitarioCompra:10000}],subtotal:qty*15000,total:qty*15000,iva:0,pagos:{capturado:{monto:5000}},comisiones:{capturada:{pagada:true,monto:100}}};
  records[listPath(source.listId)]={estado:'preparacion',compraConjuntaId:'CJ',ventaFbKey:source.ventaFbKey,ventaId:source.ventaId,items:[{productoKey:'P1',codigo:'P1',descripcion:'Material ficticio',linea:0,proveedorKey:'PY',cantidadNecesaria:qty,incluir:true}],ordenesIds:[]};
 }
 const f=createFixture({records,...(historical?{source:legacyModule()}:{})}),orders=clone(f.api.buildPlannedOrders(clone(list),clone(sim)));
 const confirmation={estado:'pendiente',ordenes:clone(orders),fecha:1};f.records[listPath('CJ')].compraConfirmacion=clone(confirmation);
 return {...f,list,sim,orders,confirmation};
}
function assertOriginalOrderShape(f){assert.equal(f.orders.length,3);assert.equal(new Set(f.orders.map(o=>o.fbKey)).size,3);assert.ok(f.orders.every(o=>o.listaMaterialesId==='CJ'));}
function protectedSales(f){return Object.fromEntries(['SA','SB'].map(key=>{const s=f.records[salePath(key)];return [key,clone({total:s.total,subtotal:s.subtotal,iva:s.iva,pagos:s.pagos,comisiones:s.comisiones,pvp:s.items.map(i=>i.punit)})];}));}
async function generate(f){await f.api.finishPlannedPurchase(clone(f.list),f.confirmation);}
function receiptInput(f){const order=f.orders.find(o=>o.ventaFbKey==='SB'),current=clone(f.records[orderPath(order.fbKey)]);return {order,current,movement:{index:0,item:clone(current.items[0]),qty:1,costoUnitarioReal:9000,proveedor:'PY',proveedorKey:'PY'}};}

test('LEGACY '+LEGACY_SHA.slice(0,8)+': conserva todas las aserciones originales de gastos, reservas y recepción parcial',async()=>{
 const f=setup({historical:true}),paid=protectedSales(f);assertOriginalOrderShape(f);assert.ok(f.orders.every(order=>order.inventoryFlowVersion===undefined));
 assert.equal(f.orders.find(o=>o.ventaFbKey==='SA').total,10101.01);assert.equal(f.orders.find(o=>o.ventaFbKey==='SB').total,20000);assert.equal(f.orders.find(o=>!o.ventaFbKey).total,10000);
 await generate(f);assert.equal(f.records[inventoryPath].general,0);assert.equal(f.records[inventoryPath].reservado,2);assert.equal(f.records[inventoryPath].enCompra,4);assert.equal(f.records[inventoryPath].asignaciones.SA.reservado,1);assert.equal(f.records[inventoryPath].asignaciones.SB.reservado,1);
 f.confirmation.estado='pendiente';await generate(f);assert.equal(f.records[inventoryPath].reservado,2);assert.equal(f.records[inventoryPath].enCompra,4);assert.ok(!f.records[listPath('CJ_A')]);assert.ok(!f.records[listPath('CJ_B')]);assert.equal(f.records[salePath('SA')].ordenesCompraIds.length,1);assert.equal(f.records[salePath('SB')].ordenesCompraIds.length,1);
 const {order,current,movement}=receiptInput(f);await f.api.finishReceipt(current,[movement]);
 assert.equal(f.records[inventoryPath].asignaciones.SA.reservado,1);assert.equal(f.records[inventoryPath].asignaciones.SB.reservado,2);assert.equal(f.records[inventoryPath].enCompra,3);assert.equal(f.records[orderPath(order.fbKey)].estado,'recepcion_parcial');assert.equal(f.records[orderPath(order.fbKey)].proveedorFinalResumen,'PY');assert.equal(f.records[salePath('SB')].items[0].costoRealCompraAcumulado,9000);assert.equal(f.records[salePath('SA')].items[0].costoRealCompraAcumulado,undefined);assert.deepEqual(protectedSales(f),paid);
});

test('V2 nueva conjunta: gasto único, vínculos descriptivos y replay sin reserva física ni doble enCompra',async()=>{
 const f=setup(),paid=protectedSales(f);assertOriginalOrderShape(f);assert.ok(f.orders.every(order=>order.inventoryFlowVersion===2));
 assert.equal(f.orders.find(o=>o.ventaFbKey==='SA').total,10025.25);assert.equal(f.orders.find(o=>o.ventaFbKey==='SB').total,20050.51);assert.equal(f.orders.find(o=>!o.ventaFbKey).total,10025.25);assert.equal(f.orders.reduce((sum,o)=>sum+Math.round(o.total*100),0),4010101);
 await generate(f);const inv=f.records[inventoryPath];assert.equal(inv.general,2);assert.equal(inv.reservado,0);assert.equal(inv.enCompra,4);
 for(const [sale,list]of [['SA','A'],['SB','B']]){assert.equal(inv.asignaciones[sale].reservado,undefined);assert.equal(inv.asignaciones[sale].planesCompra[list].schema,2);assert.equal(inv.asignaciones[sale].planesCompra[list].cantidad,1);const child=f.records[listPath(list)];assert.equal(child.stockExistenteReservado,undefined);assert.equal(child.stockExistenteVinculado,true);assert.equal(child.vinculosInventario[0].saleKey,sale);assert.equal(child.vinculosInventario[0].listKey,list);assert.equal(Object.keys(child.vinculosInventario[0]).length,9);}
 assert.equal(f.records[listPath('CJ')].vinculosInventario.length,2);const before=clone(inv);f.confirmation.estado='pendiente';await generate(f);assert.deepEqual(f.records[inventoryPath],before);assert.ok(!f.records[listPath('CJ_A')]);assert.ok(!f.records[listPath('CJ_B')]);assert.deepEqual(protectedSales(f),paid);assert.ok(f.capabilities.length>0);
});

test('V2 recepción parcial con corte retoma mismo recibo: un ingreso a general, costo único y sin cruzar ventas/pagos',async()=>{
 const f=setup();await generate(f);const paid=protectedSales(f),{order,current,movement}=receiptInput(f);let fail=true;
 f.before(({kind,path})=>{if(kind==='sdk'&&path===salePath('SB')&&fail){fail=false;throw Error('fallo simulado');}});
 const notices=f.notes.length;await assert.rejects(f.api.finishReceipt(current,[movement]),/fallo simulado/);assert.equal(f.notes.length,notices);
 const pending=clone(f.records[orderPath(order.fbKey)].recepcionPendiente);assert.equal(pending.inventoryFlowVersion,2);assert.equal(f.records[inventoryPath].general,3);assert.equal(f.records[inventoryPath].reservado,0);
 await f.api.finishReceipt(clone(f.records[orderPath(order.fbKey)]),[]);const inv=f.records[inventoryPath],saved=f.records[orderPath(order.fbKey)];assert.equal(inv.general,3);assert.equal(inv.reservado,0);assert.equal(inv.enCompra,3);assert.equal(inv.asignaciones.SA.reservado,undefined);assert.equal(inv.asignaciones.SB.reservado,undefined);assert.equal(inv.asignaciones.SA.recepcionesCompra,undefined);assert.equal(inv.asignaciones.SB.recepcionesCompra[pending.id].cantidad,1);assert.equal(saved.recepciones.length,1);assert.equal(saved.recepciones[0].id,pending.id);assert.equal(saved.recepciones[0].inventoryFlowVersion,2);assert.equal(saved.estado,'recepcion_parcial');assert.equal(saved.proveedorFinalResumen,'PY');assert.equal(f.records[salePath('SB')].items[0].costoRealCompraAcumulado,9000);assert.equal(f.records[salePath('SA')].items[0].costoRealCompraAcumulado,undefined);assert.deepEqual(protectedSales(f),paid);
});

test('confirmación histórica capturada no se retaggea v2 para hacerla continuar en el controlador actual',async()=>{
 const historical=setup({historical:true}),captured=clone(historical.records),f=createFixture({records:captured});await assert.rejects(f.api.finishPlannedPurchase(clone(historical.list),clone(historical.confirmation)),/histórica requiere revisión/);assert.deepEqual(f.records,captured);assert.equal(f.writes.length,0);assert.equal(f.notes.length,0);
});

test('recibo pendiente producido por controlador histórico conserva ledger e identidad al exigir revisión actual',async()=>{
 const historical=setup({historical:true});await generate(historical);const {order,current,movement}=receiptInput(historical);let fail=true;historical.before(({kind,path})=>{if(kind==='sdk'&&path===salePath('SB')&&fail){fail=false;throw Error('corte histórico');}});await assert.rejects(historical.api.finishReceipt(current,[movement]),/corte histórico/);
 const captured=clone(historical.records),pending=captured[orderPath(order.fbKey)].recepcionPendiente;assert.ok(pending);assert.equal(pending.inventoryFlowVersion,undefined);const f=createFixture({records:captured});await assert.rejects(f.api.finishReceipt(clone(captured[orderPath(order.fbKey)]),[]),/histórica requiere revisión/);assert.deepEqual(f.records,captured);assert.equal(f.writes.length,0);assert.equal(f.notes.length,0);
});

test('V2 actual conserva recibos y reservas de otra venta capturados del controlador histórico',async()=>{
 const oldRows=[{key:'P1|0|PY',productKey:'P1',providerKey:'PY',provider:'PY',code:'P1',qty:2,usd:10,include:true,existing:0}],oldParameters={usd:1000,usdt:1000,allocation:'value',shippingMode:'insured',shippingInsuredUSD:0};
 const oldSim={complete:true,chosen:'onsite',parameters:oldParameters,result:calculate(oldParameters,oldRows),rows:oldRows,extras:[]};
 const oldList={fbKey:'OLD_LIST',numero:'LM-OLD',estado:'preparacion',origen:'venta',ventaFbKey:'OLD_SALE',ventaId:'V-OLD',simuladorParaguay:oldSim,items:[{productoKey:'P1',codigo:'P1',linea:0,proveedorKey:'PY',cantidadNecesaria:2,incluir:true}]};
 const historical=createFixture({source:legacyModule(),records:{[inventoryPath]:{codigo:'P1',general:2,enCompra:0,reservado:0,consumido:0,asignaciones:{},operaciones:{}},[listPath('OLD_LIST')]:clone(oldList),[salePath('OLD_SALE')]:{id:'V-OLD',listaMaterialesId:'OLD_LIST',ordenesCompraIds:[],items:[{productoKey:'P1',codigo:'P1',qty:2,punit:15000,costoUnitarioCompra:10000}],total:30000,subtotal:30000,iva:0,pagos:{capturado:{monto:5000}}}}});
 // Produce the old receipt using the pinned COMPLETE historical controller;
 // do not fabricate an old receipt or attach a v2 marker to it.
 const oldOrders=clone(historical.api.buildPlannedOrders(clone(oldList),clone(oldSim))),oldConfirmation={estado:'pendiente',ordenes:oldOrders};
 await historical.api.finishPlannedPurchase(clone(oldList),oldConfirmation);const oldOrder=clone(historical.records[orderPath(oldOrders[0].fbKey)]);
 await historical.api.finishReceipt(oldOrder,[{index:0,item:clone(oldOrder.items[0]),qty:1,costoUnitarioReal:9000,proveedor:'PY',proveedorKey:'PY'}]);
 const captured=clone(historical.records),oldLedger=captured[inventoryPath];assert.equal(oldLedger.general,2);assert.equal(oldLedger.reservado,1);assert.equal(oldLedger.enCompra,1);assert.equal(captured[orderPath(oldOrder.fbKey)].recepciones.length,1);assert.equal(captured[orderPath(oldOrder.fbKey)].recepciones[0].inventoryFlowVersion,undefined);
 const f=setup();for(const [path,value]of Object.entries(captured))f.records[path]=clone(value);
 await generate(f);assert.equal(f.records[inventoryPath].general,2);assert.equal(f.records[inventoryPath].reservado,1);assert.equal(f.records[inventoryPath].enCompra,5);
 f.confirmation.estado='pendiente';await generate(f);assert.equal(f.records[inventoryPath].enCompra,5);
 const {order,current,movement}=receiptInput(f);await f.api.finishReceipt(current,[movement]);const inv=f.records[inventoryPath];assert.equal(inv.general,3);assert.equal(inv.enCompra,4);assert.equal(inv.reservado,1);assert.deepEqual(inv.asignaciones.OLD_SALE,oldLedger.asignaciones.OLD_SALE);
 for(const [id,value]of Object.entries(oldLedger.operaciones))assert.deepEqual(inv.operaciones[id],value);
 for(const path of [orderPath(oldOrder.fbKey),salePath('OLD_SALE'),listPath('OLD_LIST')])assert.deepEqual(f.records[path],captured[path],path);
 assert.equal(f.records[orderPath(order.fbKey)].recepciones[0].inventoryFlowVersion,2);
});
