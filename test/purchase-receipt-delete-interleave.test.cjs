'use strict';
const assert=require('node:assert/strict'),{isDeepStrictEqual}=require('node:util');
const {test}=require('node:test');
const base=require('node:path').resolve(__dirname,'..')+'/';
const {createCoordinatedBackend}=require(base+'test/helpers/coordinated-backend.cjs');
const {apply}=require(base+'test/helpers/labor-ui-flow.cjs');
const {digest}=require(base+'cotizador/labor-guard');
const {createSaleDeleteCommand}=require(base+'cotizador/sale-delete-command');
const {createPurchaseOrderDelete}=require(base+'cotizador/purchase-order-delete');
const {createFixture}=require('./helpers/purchase-focal-ui-fixture.cjs');
const Financial=require(base+'cotizador/sale-financial-dependencies-model');
const FinancialProvider=require(base+'cotizador/sale-financial-dependencies-provider');
async function run(loseAck){
 const item={codigo:'P',productoKey:'P',descripcion:'Material ficticio',cantidadOrdenada:1,cantidadRecibida:0,costoUnitario:12};
 const order={inventoryFlowVersion:2,moneda:'ARS',numero:'OC-FIXTURE',estado:'enviada',ventaFbKey:'s',ventaId:'V-0001',items:[item]};
 const sale={id:'V-0001',total:100,subtotal:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u',ordenesCompraIds:['o'],items:[{codigo:'P',productoKey:'P',qty:1,costoUnitarioCompra:12,costoTotalCompra:12,costoUnitarioPresupuestado:12,costoTotalPresupuestado:12}]};
 const historic={reservado:2,consumido:1,asignaciones:{previous:{reservado:2}},rendicionesOT:{old:{schema:1,revision:7,cantidad:2}},operaciones:{old:123}};
 const backend=await createCoordinatedBackend({ventas:{s:sale},ordenes:{o:order},inventario_operativo:{P:{codigo:'P',productKey:'P',enCompra:1,general:0,...structuredClone(historic)}},comisiones:{untouched:{monto:7}}});
 apply(backend.state,(await Financial.prepare({ventas:{s:sale},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'purchase-receipt-financial-fixture'})).patch);
 backend.store.saleDeleteFinancialEvidence=FinancialProvider.create();
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true,ordenes:true},acciones:{ventas:{eliminar:true},ordenes:{eliminar:true}}}});
 Object.assign(backend.store,{saleDeleteFenceReady:true,saleDeleteActivityFenceReady:true});
 const request={method:'POST',headers:{authorization:'Bearer fixture-token'}},actor=await backend.gateway.authorize(request),verifyActor=async candidate=>{const actual=await backend.gateway.authorize(request);assert.equal(actual.uid,candidate.uid);return actual;},saleDelete=createSaleDeleteCommand({store:backend.store,guard:backend.guard,enabled:true,verifyActor}),orderDelete=createPurchaseOrderDelete({store:backend.store,guard:backend.guard,review:require('./helpers/purchase-delete-command-review.cjs'),enabled:true,authorize:()=>backend.gateway.authorize(request)});
 assert.equal(backend.guard.clientAccounts,true);assert.equal(backend.guard.clientHistory,true);assert.equal(backend.guard.saleFinancialDependencies,true);assert.equal(saleDelete.capability(),true);
 let release,reached;const barrier=new Promise(resolve=>{release=resolve;}),paused=new Promise(resolve=>{reached=resolve;});let first=true;
 let stockEffects=0;
 const ui=createFixture({rootOverrides:{currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},fbGet:async path=>({val:()=>backend.get(path)}),fbUpdate:async(path,value)=>apply(backend.state,{[path]:{...backend.get(path),...value}}),fbRunTransaction:async(path,transform)=>{
  const original=backend.get(path),next=transform(structuredClone(original));if(next===undefined)return {committed:false,snapshot:{val:()=>original}};apply(backend.state,{[path]:next});
  if(path==='sisventas/inventario_operativo/P'){
   if(!isDeepStrictEqual(original,next))stockEffects++;
   if(first){first=false;assert.equal(next.general,1);reached();await barrier;if(loseAck)throw Error('ACK_INVENTORY_LOST_FIXTURE');}
  }
  return {committed:true,snapshot:{val:()=>structuredClone(next)}};
 }}});ui.state.orders=[{...structuredClone(order),fbKey:'o'}];
 const context={finishReceipt:ui.api.finishReceipt};
 const movements=[{index:0,item:structuredClone(item),qty:1,costoUnitarioReal:20,proveedor:'Fixture',proveedorKey:'fixture'}];
 const pending=context.finishReceipt({...structuredClone(order),fbKey:'o'},movements);const settled=pending.then(()=>null,error=>error);
 await Promise.race([paused,settled.then(error=>{throw error||Error('La recepción finalizó sin llegar a la barrera de stock');})]);assert(backend.get('sisventas/ordenes/o/recepcionPendiente'));assert.equal(backend.get('sisventas/inventario_operativo/P/general'),1);assert.equal(backend.get('sisventas/inventario_operativo/P/reservado'),historic.reservado);assert.equal(backend.get('sisventas/ventas/s/items/0/costoTotalCompra'),12);
 async function attemptDeletes(){const before=backend.get('sisventas');await assert.rejects(saleDelete.execute(actor,{id:'sale-delete-fixture',ventaKey:'s',expectedHash:digest(backend.get('sisventas/ventas/s'))}),{code:'SV_SALE_DELETE_ACTIVITY'});await assert.rejects(orderDelete.handle({method:'POST',url:'/compras/ordenes/eliminar'},{id:'order-delete-fixture',orderKey:'o',expectedHash:digest(backend.get('sisventas/ordenes/o'))}),/recepción pendiente/);assert.deepEqual(backend.get('sisventas'),before);assert.equal(backend.commits.length,0);}
 await attemptDeletes();release();const error=await settled;
 if(loseAck){assert.match(error.message,/ACK_INVENTORY_LOST/);await attemptDeletes();await context.finishReceipt({...structuredClone(order),fbKey:'o'},movements);}else assert.equal(error,null);
 assert.equal(backend.get('sisventas/inventario_operativo/P/general'),1);assert.equal(backend.get('sisventas/inventario_operativo/P/reservado'),historic.reservado);assert.equal(backend.get('sisventas/inventario_operativo/P/consumido'),historic.consumido);assert.deepEqual(backend.get('sisventas/inventario_operativo/P/rendicionesOT'),historic.rendicionesOT);assert.deepEqual(backend.get('sisventas/inventario_operativo/P/asignaciones/previous'),historic.asignaciones.previous);assert.equal(backend.get('sisventas/inventario_operativo/P/operaciones/old'),123);
 const traces=Object.values(backend.get('sisventas/inventario_operativo/P/asignaciones/s/recepcionesCompra'));assert.equal(traces.length,1);assert.equal(traces[0].schema,2);assert.equal(traces[0].cantidad,1);assert.equal(stockEffects,1);assert.equal(backend.get('sisventas/ordenes/o/recepciones').length,1);
 assert.equal(backend.get('sisventas/inventario_operativo/P/enCompra'),0);assert.equal(backend.get('sisventas/ventas/s/items/0/costoTotalCompra'),20);assert.equal(backend.get('sisventas/ordenes/o/recepcionPendiente'),null);assert.equal(backend.get('sisventas/comisiones/untouched/monto'),7);
 assert.equal(backend.commits.length,0);
}
for(const loseAck of [false,true])test('recepción intercalada veta eliminación de venta y orden'+(loseAck?' y recupera ACK perdido sin repetir stock':''),{timeout:10000},()=>run(loseAck));
