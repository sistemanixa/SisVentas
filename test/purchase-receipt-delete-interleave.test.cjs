'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const base=require('node:path').resolve(__dirname,'..')+'/';
const {createCoordinatedBackend}=require(base+'test/helpers/coordinated-backend.cjs');
const {apply}=require(base+'test/helpers/labor-ui-flow.cjs');
const {digest}=require(base+'cotizador/labor-guard');
const {createSaleDeleteCommand}=require(base+'cotizador/sale-delete-command');
const {createPurchaseOrderDelete}=require(base+'cotizador/purchase-order-delete');
const Costs=require(base+'cotizador/commercial-models/purchase-receipt-costs.v1.js');
const Financial=require(base+'cotizador/sale-financial-dependencies-model');
const FinancialProvider=require(base+'cotizador/sale-financial-dependencies-provider');
const source=fs.readFileSync(base+'js/modules/purchase-orders.js','utf8');
function extract(name){const start=source.search(new RegExp('  (?:async )?function '+name+'\\(')),tail=source.slice(start+3),next=tail.search(/\n  (?:async )?function /);return source.slice(start,next<0?undefined:start+3+next);}
async function run(loseAck){
 const item={codigo:'P',productoKey:'P',cantidadOrdenada:1,cantidadRecibida:0,costoUnitario:12};
 const order={numero:'OC-FIXTURE',estado:'ordenada',ventaFbKey:'s',ventaId:'V-0001',items:[item]};
 const sale={id:'V-0001',total:100,subtotal:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u',ordenesCompraIds:['o'],items:[{codigo:'P',productoKey:'P',qty:1,costoUnitarioCompra:12,costoTotalCompra:12,costoUnitarioPresupuestado:12,costoTotalPresupuestado:12}]};
 const backend=await createCoordinatedBackend({ventas:{s:sale},ordenes:{o:order},inventario_operativo:{P:{enCompra:1,reservado:0,general:0}},comisiones:{untouched:{monto:7}}});
 apply(backend.state,(await Financial.prepare({ventas:{s:sale},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'purchase-receipt-financial-fixture'})).patch);
 backend.store.saleDeleteFinancialEvidence=FinancialProvider.create();
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true,ordenes:true},acciones:{ventas:{eliminar:true},ordenes:{eliminar:true}}}});
 Object.assign(backend.store,{saleDeleteFenceReady:true,saleDeleteActivityFenceReady:true,operationalFenceReady:true});
 const actor={uid:'u',claims:{uid:'u'}},saleDelete=createSaleDeleteCommand({store:backend.store,guard:backend.guard,enabled:true,verifyActor:async()=>{}}),orderDelete=createPurchaseOrderDelete({store:backend.store,guard:backend.guard,enabled:true,authorize:async()=>actor});
 assert.equal(backend.guard.clientAccounts,true);assert.equal(backend.guard.clientHistory,true);assert.equal(backend.guard.saleFinancialDependencies,true);assert.equal(saleDelete.capability(),true);
 let release,reached;const barrier=new Promise(resolve=>{release=resolve;}),paused=new Promise(resolve=>{reached=resolve;});let first=true;
 const context={state:{orders:[{...order,fbKey:'o'}]},PATH_ORDERS:'sisventas/ordenes',PATH_LISTS:'sisventas/listas_materiales',today:()=> '2026-11-04',safeKey:value=>value,orderProviderSummary:()=>'',document:{getElementById:()=>({style:{}})},
  async transactionInventory(key,transform){const original=backend.get('sisventas/inventario_operativo/'+key),next=structuredClone(original);transform(next);apply(backend.state,{['sisventas/inventario_operativo/'+key]:next});if(first){first=false;reached();await barrier;if(loseAck)throw Error('ACK_INVENTORY_LOST_FIXTURE');}},
  update:async(path,value)=>apply(backend.state,{[path]:{...backend.get(path),...value}})
 };
 context.window={fbDB:{},currentUser:'Fixture',SVPurchaseReceiptCosts:Costs,obtenerCostoItemVenta:line=>line.costoUnitarioCompra,notify(){},fbRef:(_,path)=>path,fbRunTransaction:async(path,transform)=>{const next=transform(backend.get(path));if(next===undefined)return {committed:false};apply(backend.state,{[path]:next});return {committed:true,snapshot:{val:()=>structuredClone(next)}};}};
 vm.createContext(context);vm.runInContext(extract('syncSalePurchaseCosts')+'\n'+extract('finishReceipt'),context);
 const movements=[{index:0,item:structuredClone(item),qty:1,costoUnitarioReal:20,proveedor:'Fixture',proveedorKey:'fixture'}];
 const pending=context.finishReceipt({...structuredClone(order),fbKey:'o'},movements);const settled=pending.then(()=>null,error=>error);
 await paused;assert(backend.get('sisventas/ordenes/o/recepcionPendiente'));assert.equal(backend.get('sisventas/inventario_operativo/P/reservado'),1);assert.equal(backend.get('sisventas/ventas/s/items/0/costoTotalCompra'),12);
 async function attemptDeletes(){const before=backend.get('sisventas');await assert.rejects(saleDelete.execute(actor,{id:'sale-delete-fixture',ventaKey:'s',expectedHash:digest(backend.get('sisventas/ventas/s'))}),{code:'SV_SALE_DELETE_ACTIVITY'});await assert.rejects(orderDelete.handle({method:'POST',url:'/compras/ordenes/eliminar'},{id:'order-delete-fixture',orderKey:'o',expectedHash:digest(backend.get('sisventas/ordenes/o'))}),/recepción pendiente/);assert.deepEqual(backend.get('sisventas'),before);assert.equal(backend.commits.length,0);}
 await attemptDeletes();release();const error=await settled;
 if(loseAck){assert.match(error.message,/ACK_INVENTORY_LOST/);await attemptDeletes();await context.finishReceipt({...structuredClone(order),fbKey:'o'},movements);}else assert.equal(error,null);
 assert.equal(backend.get('sisventas/inventario_operativo/P/reservado'),1);assert.equal(backend.get('sisventas/inventario_operativo/P/enCompra'),0);assert.equal(backend.get('sisventas/ventas/s/items/0/costoTotalCompra'),20);assert.equal(backend.get('sisventas/ordenes/o/recepcionPendiente'),null);assert.equal(backend.get('sisventas/comisiones/untouched/monto'),7);
 assert.equal(backend.commits.length,0);
}
for(const loseAck of [false,true])test('recepción intercalada veta eliminación de venta y orden'+(loseAck?' y recupera ACK perdido sin repetir stock':''),{timeout:10000},()=>run(loseAck));
