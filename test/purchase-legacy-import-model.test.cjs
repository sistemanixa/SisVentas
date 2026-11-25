'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {digest}=require('../cotizador/labor-guard');
const {plan}=require('../cotizador/purchase-legacy-import-model');
function fixture(){const legacy={numero:'OLD-7',ventaId:'V-OLD',proveedor:'Proveedor histórico',proveedorKey:'pv',fecha:'2020-02-03',ts:123,usuario:'Original',autor:'Dueño',moneda:'USD',estado:'pendiente',total:2.469134,monto:2.469134,unknown:{precise:3.456789,note:'keep'},items:[{cod:'P',desc:'Material',cantidad:2,precioRef:1.234567,precioPublico:8.765432,publicPrice:8.765432,extra:{captured:'old'}}]};return {legacy,legacyKey:'old',originalOrder:null,body:{id:'operation1',expectedHash:digest(legacy)},context:{orderKey:'server_order',numero:'OC-00999',at:1000,date:'2026-11-22',actor:{uid:'user',name:'Importador'}}};}
function hash(input){input.body.expectedHash=digest(input.legacy);return input;}
const destination=out=>out.patch['sisventas/ordenes/server_order'];
function rejects(input,field){const before=structuredClone(input);assert.throws(()=>plan(input),error=>error.code==='SV_PURCHASE_LEGACY_IMPORT_REVIEW'&&error.statusCode===409&&error.legacyKey==='old'&&(!field||error.field===field));assert.deepEqual(input,before);}
test('historical USD import preserves raw precision, owner/date, captured snapshots and old source',()=>{
 const input=fixture(),before=structuredClone(input),out=plan(input),order=destination(out);
 assert.deepEqual(input,before);assert.equal(order.items[0].cantidadOrdenada,2);assert.equal(order.items[0].costoUnitario,1.234567);assert.equal(order.items[0].subtotal,2.469134);assert.equal(order.total,2.469134);assert.equal(order.moneda,'USD');assert.equal(order.numero,'OC-00999');
 for(const field of ['fecha','ts','usuario','autor','proveedor','proveedorKey','estado','ventaId'])assert.deepEqual(order[field],input.legacy[field]);
 assert.deepEqual(order.items[0].extra,input.legacy.items[0].extra);assert.equal(order.items[0].publicPrice,8.765432);assert.deepEqual(order.importacionHistorica.source,input.legacy);assert.equal(order.importacionHistorica.sourceHash,digest(input.legacy));
 const changed=out.patch['sisventas/ordenes_compra/old'];assert.deepEqual(changed,{...input.legacy,migradaA:'server_order',migradaEn:1000});assert.deepEqual(out.preconditions['sisventas/ordenes/server_order'],null);assert.deepEqual(out.readDependencies['sisventas/ordenes/server_order'],null);
});
test('no stock, payment, commission, Sale, list or fictitious receipt/register writes',()=>{
 const input=fixture();Object.assign(input.legacy,{inventarioCompra:{registered:true},pagos:[{id:'paid'}],comisiones:{paid:1},jobs:{keep:true}});hash(input);const out=plan(input),order=destination(out);
 assert.deepEqual(Object.keys(out.patch).sort(),['sisventas/ordenes/server_order','sisventas/ordenes_compra/old']);
 for(const field of ['inventarioCompra','pagos','comisiones','jobs','recepciones','cantidadRecibida','ventaFbKey','listaMaterialesId'])assert.equal(Object.hasOwn(order,field),false);
 assert.equal(Object.hasOwn(order.items[0],'cantidadRecibida'),false);assert.deepEqual(order.importacionHistorica.source.comisiones,input.legacy.comisiones);assert.equal(order.importacionHistorica.historicalOnly,true);
});
test('missing historical date, owner, currency and status are not invented from context',()=>{const input=fixture();for(const field of ['fecha','ts','usuario','autor','moneda','estado'])delete input.legacy[field];const order=destination(plan(hash(input)));for(const field of ['fecha','ts','usuario','autor','moneda','estado'])assert.equal(Object.hasOwn(order,field),false);assert.equal(order.importacionHistorica.importedDate,'2026-11-22');});
test('consistent explicit received evidence is copied exactly without creating receipt records',()=>{
 const input=fixture(),row=input.legacy.items[0];Object.assign(row,{recibido:true,cantidadRecibida:2,cantidadCostoReal:2,costoUnitarioReal:1.345678,costoRealAcumulado:2.691356,ultimoCostoReal:1.345678,proveedorFinal:'Real',proveedorFinalKey:'real',recibidoEn:77});
 const order=destination(plan(hash(input)));for(const field of ['recibido','cantidadRecibida','cantidadCostoReal','costoUnitarioReal','costoRealAcumulado','ultimoCostoReal','proveedorFinal','proveedorFinalKey','recibidoEn'])assert.deepEqual(order.items[0][field],row[field]);assert.equal(Object.hasOwn(order,'recepciones'),false);
});
test('explicit recibido boolean supplies quantity evidence but not invented actual cost',()=>{const input=fixture();input.legacy.items[0].recibido=true;const row=destination(plan(hash(input))).items[0];assert.equal(row.cantidadRecibida,2);assert.equal(Object.hasOwn(row,'costoRealAcumulado'),false);});
test('valid received header aggregates and negative difference are copied without recalculation',()=>{const input=fixture();Object.assign(input.legacy.items[0],{cantidadRecibida:2,cantidadCostoReal:2,costoUnitarioReal:2,costoRealAcumulado:4});Object.assign(input.legacy,{totalRealRecibido:4,totalPresupuestadoRecibido:2.469134,diferenciaCompra:-1.530866});const order=destination(plan(hash(input)));assert.equal(order.totalRealRecibido,4);assert.equal(order.diferenciaCompra,-1.530866);assert.equal(order.total,2.469134);});
test('explicit zero cost is legitimate and never a fallback',()=>{const input=fixture();input.legacy.items[0].precioRef=0;delete input.legacy.total;delete input.legacy.monto;const order=destination(plan(hash(input)));assert.equal(order.total,0);assert.equal(order.items[0].costoUnitario,0);});
test('strict numeric aliases preserve raw strings in source and normalize canonical numeric fields',()=>{const input=fixture();Object.assign(input.legacy.items[0],{cantidad:'2',qty:2,costoUnitario:'1.234567'});const order=destination(plan(hash(input)));assert.equal(order.items[0].cantidadOrdenada,2);assert.equal(order.items[0].costoUnitario,1.234567);assert.equal(order.importacionHistorica.source.items[0].costoUnitario,'1.234567');});
test('an existing coherent cent-rounded total is preserved without rounding supplier cost',()=>{const input=fixture();input.legacy.total=2.47;input.legacy.monto=2.47;const order=destination(plan(hash(input)));assert.equal(order.total,2.47);assert.equal(order.items[0].costoUnitario,1.234567);});
test('missing totals calculated only from explicit quantities and costs',()=>{const input=fixture();delete input.legacy.total;delete input.legacy.monto;const order=destination(plan(hash(input)));assert.equal(order.total,2.469134);assert.equal(order.monto,2.469134);});
test('migrated matching source is read-only replay requiring receipt, not a new allocation',()=>{
 const input=fixture(),first=plan(input);input.legacy=first.patch['sisventas/ordenes_compra/old'];input.originalOrder=destination(first);input.context.at=2000;hash(input);const before=structuredClone(input),again=plan(input);assert.deepEqual(again.patch,{});assert.deepEqual(again.preconditions,{});assert.equal(again.result.alreadyImported,true);assert.equal(again.result.requiresReceipt,true);assert.deepEqual(again.readDependencies['sisventas/ordenes/server_order'],input.originalOrder);assert.deepEqual(input,before);
});
for(const [name,mutate]of Object.entries({
 missingQuantity:i=>delete i.legacy.items[0].cantidad,
 missingCost:i=>delete i.legacy.items[0].precioRef,
 negativeQuantity:i=>i.legacy.items[0].cantidad=-1,
 zeroQuantity:i=>i.legacy.items[0].cantidad=0,
 garbageQuantity:i=>i.legacy.items[0].cantidad='2 unidades',
 infiniteCost:i=>i.legacy.items[0].precioRef=Infinity,
 contradictoryQuantity:i=>i.legacy.items[0].qty=3,
 contradictoryCost:i=>i.legacy.items[0].costoUnitario=2,
 contradictorySubtotal:i=>i.legacy.items[0].subtotal=7,
 contradictoryTotal:i=>i.legacy.total=99,
 contradictoryHeaderTotals:i=>i.legacy.monto=2.47,
 outOfRangeProduct:i=>{i.legacy.items[0].cantidad=1e15;i.legacy.items[0].precioRef=1e15;},
 receivedBeyondOrdered:i=>i.legacy.items[0].cantidadRecibida=3,
 receivedContradiction:i=>Object.assign(i.legacy.items[0],{recibido:true,cantidadRecibida:1}),
 receiptCostWithoutEvidence:i=>i.legacy.items[0].costoRealAcumulado=20,
 receiptCostContradiction:i=>Object.assign(i.legacy.items[0],{cantidadRecibida:2,cantidadCostoReal:2,costoUnitarioReal:5,costoRealAcumulado:11}),
 receiptAggregateWithoutRows:i=>i.legacy.totalRealRecibido=5,
 receiptAggregateContradiction:i=>{Object.assign(i.legacy.items[0],{cantidadRecibida:2,cantidadCostoReal:2,costoUnitarioReal:5,costoRealAcumulado:10});i.legacy.totalRealRecibido=12;},
 receiptDifferenceWithoutTotals:i=>i.legacy.diferenciaCompra=-2,
 incompleteMarker:i=>i.legacy.migradaEn=100,
 occupiedDestination:i=>i.originalOrder={unrelated:true},
 destinationNotRead:i=>delete i.originalOrder,
 sourceProjection:i=>i.legacy._svSummary=true,
 unknownControl:i=>i.body.stock=true,
 badContextDate:i=>i.context.date='2026-02-30'
}))test('review identifiable '+name+' without mutation',()=>{const input=fixture();mutate(input);hash(input);rejects(input);});
test('CAS uses exact full source including unknown fields',()=>{const input=fixture();input.legacy.unknown.precise=7;rejects(input,'body.expectedHash');});
for(const [name,change]of Object.entries({wrongTarget:i=>i.context.orderKey='other',newNumber:i=>i.context.numero='OC-01000',newOperation:i=>i.body.id='operation2',sourceChanged:i=>i.legacy.unknown.note='changed',snapshotChanged:i=>i.originalOrder.importacionHistorica.source.unknown.note='changed',unrelatedDestination:i=>i.originalOrder={numero:'other'}}))test('migrated '+name+' is never overwritten',()=>{const input=fixture(),first=plan(input);input.legacy=first.patch['sisventas/ordenes_compra/old'];input.originalOrder=destination(first);change(input);hash(input);rejects(input);});
