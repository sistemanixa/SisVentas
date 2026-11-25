'use strict';
// Characterization of source 02f7693b. Synthetic orders and intercepted REST only.
// These tests deliberately expose an unmet migration requirement, not permission
// to install a cohort or manufacture inventoryCompra on a historical order.
const {test}=require('node:test'),a=require('node:assert/strict');
const {fixture,at,digest}=require('./helpers/purchase-manual-core-fixture.cjs');
const History=require('../cotizador/purchase-inventory-history'),Edit=require('../cotizador/purchase-order-edit-plan'),Base=require('../cotizador/purchase-inventory-order-plan'),Delete=require('../cotizador/purchase-typed-delete-model');
const ORDER='sisventas/ordenes/oldOrder',LEDGER='sisventas/inventario_operativo/legacy';
function oldOrder(){return {numero:'OC-FICTICIA',origen:'manual',estado:'borrador',proveedorKey:'provider',proveedor:'Proveedor ficticio',moneda:'ARS',fecha:'2026-11-01',items:[{productoKey:'product',codigo:'LEGACY-FICTICIO',descripcion:'Material ficticio',cantidadOrdenada:2,cantidadRecibida:0,costoUnitario:1.2345,precioPublico:9.8765,subtotal:2.469}],total:2.469,monto:2.469,unknown:{preserve:true}};}
const operations={header:{kind:'edit',header:{date:'2026-11-02'}},quantity:{kind:'edit',quantities:[{index:0,quantity:3}]},receipt:{kind:'receive',movements:[{index:0,quantity:1,realUnitCost:1.1111}]},delete:null};
for(const [name,change]of Object.entries(operations))for(const trace of ['no-order-trace','existing-order-trace'])test('classic '+name+' rejects before commit with '+trace+' and no invented registration',async()=>{
 const f=await fixture({coordinated:true,stockOrder:true,pending:2}),original=oldOrder();f.set(ORDER,original);f.set('sv_permisos/admin/acciones/ordenes/eliminar',true);
 if(trace==='existing-order-trace')f.set(LEDGER+'/operaciones/compra_oldOrder',f.now-1000);
 const before=structuredClone(f.get('sisventas')),counter=structuredClone(f.get('sv_purchase_numbering/state')),id='fiction-classic-'+name+'-'+trace;
 const options={enabled:true,authorize:async()=>f.identity,store:f.store,guard:f.guard,resolveReference:at('cotizador/office-stock-reference-port').createReferenceResolver({enabled:true,mappedAdmission:f.authority}),queryPage:f.store.queryPage,now:()=>f.now,assertAdmission:async({read})=>f.authority.admit({read})};
 const body={id,orderKey:'oldOrder',expectedHash:digest(original),...(change?{expectedRevision:0,...change}:{})};
 const command=at(name==='delete'?'cotizador/purchase-typed-delete-command':'cotizador/purchase-inventory-command').create(options);
 await a.rejects(command.execute({},body),{statusCode:409,code:'SV_PURCHASE_HISTORY_REVIEW'});
 a.equal(f.patches.length,0);a.deepEqual(f.get('sisventas'),before);a.deepEqual(f.get('sv_purchase_numbering/state'),counter);a.equal(f.get('sv_labor_receipts/'+id),null);a.equal(Object.hasOwn(f.get(ORDER),'inventarioCompra'),false);
 a.ok(f.calls.some(call=>decodeURIComponent(call.target.pathname).includes('inventario_operativo/legacy')));
});

test('pure header plan needs no physical delta, but this is not executable compatibility of the current command',()=>{
 const order=oldOrder(),before=structuredClone(order),body={id:'fiction-classic-header-model',kind:'edit',orderKey:'oldOrder',header:{date:'2026-11-02'}};
 const plan=Edit.build({sourceOrder:order,body,at:1730000000000,actorUid:'fictionUser',actorName:'Autor ficticio'});
 a.deepEqual(Object.keys(plan.patch),[ORDER]);a.deepEqual(Object.keys(plan.preconditions),[ORDER]);a.deepEqual(plan.patch[ORDER].items,order.items);a.deepEqual(plan.patch[ORDER].unknown,order.unknown);a.equal(Object.hasOwn(plan.patch[ORDER],'inventarioCompra'),false);a.deepEqual(order,before);
});

test('relaxing absent-history lookup alone cannot enable quantity or receipt plans',()=>{
 for(const change of [operations.quantity,operations.receipt]){
  const order=oldOrder(),before=structuredClone(order);a.throws(()=>Base.build({sourceOrder:order,body:{id:'fiction-classic-model',orderKey:'oldOrder',...change},inventories:{legacy:{general:10,enCompra:2,operaciones:{}}},references:{product:{productKey:'product',inventoryKey:'legacy',receiptIdentityKey:'legacy'}},at:1730000000000,actorName:'Ficticio'}),{code:'SV_PURCHASE_PLAN_REVIEW'});a.deepEqual(order,before);
 }
});

test('typed delete independently rejects absent registration even with supplied references and ample pending stock',()=>{
 const order=oldOrder(),before=structuredClone(order);a.throws(()=>Delete.plan({sourceOrder:order,body:{id:'fiction-classic-delete-model',orderKey:'oldOrder',expectedHash:digest(order)},inventories:{legacy:{general:10,enCompra:200,operaciones:{compra_oldOrder:1}}},references:{product:{productKey:'product',inventoryKey:'legacy',receiptIdentityKey:'legacy'}},at:1730000000000}),{code:'SV_PURCHASE_TYPED_DELETE_REVIEW'});a.deepEqual(order,before);
});

test('explicit unregistered revision zero is a different original from an absent marker',async()=>{
 const order=oldOrder(),read=async path=>path===LEDGER?{general:10,enCompra:2,operaciones:{}}:path.includes('/stock_vinculos/')?{productKey:'product',inventoryKey:'legacy',receiptIdentityKey:'legacy'}:null,ports={read,sourcePath:ORDER};
 await a.rejects(History.identifyOriginal(order,0,ports),{code:'SV_PURCHASE_HISTORY_REVIEW'});
 const declared={...structuredClone(order),inventarioCompra:{schema:1,registered:false,revision:0}},identified=await History.identifyOriginal(declared,0,ports);
 a.equal(identified.history.kind,'absent');a.equal(identified.history.sourceHash,digest(declared));a.equal(Object.hasOwn(order,'inventarioCompra'),false);
 // This is a contrast of two originals, never a migration performed by the test.
});

test('explicit false marker still cannot override a real legacy operation or reception evidence',async()=>{
 for(const scenario of ['operation','row-received','order-receipt']){
  const order={...oldOrder(),inventarioCompra:{schema:1,registered:false,revision:0}};
  if(scenario==='row-received')order.items[0].cantidadRecibida=1;
  if(scenario==='order-receipt')order.recepciones=[{id:'fiction-previous-receipt'}];
  const ledger={general:10,enCompra:2,operaciones:scenario==='operation'?{compra_oldOrder:1}:{}},before=structuredClone({order,ledger});
  const read=async path=>path===LEDGER?ledger:path.includes('/stock_vinculos/')?{productKey:'product',inventoryKey:'legacy',receiptIdentityKey:'legacy'}:null;
  await a.rejects(History.identifyOriginal(order,0,{read,sourcePath:ORDER}),{code:'SV_PURCHASE_HISTORY_REVIEW'});a.deepEqual({order,ledger},before);
 }
});

test('current host readiness does not cover classic orders: a valid stock-order fence is not a purchase migration fence',async t=>{
 const f=await require('./helpers/initial-inventory-fixture.cjs').fixture(t),backend=await require('./helpers/coordinated-backend.cjs').createCoordinatedBackend({});
 for(const [path,value]of Object.entries(backend.state))if(!['sisventas','sv_labor_guard'].includes(path))f.set(path,value);
 const Financial=require('../cotizador/sale-financial-dependencies-model'),Numbering=require('../cotizador/purchase-numbering'),Install=require('../cotizador/inventory-installation-contract'),StockOrder=require('../cotizador/office-stock-order');
 for(const [path,value]of Object.entries((await Financial.prepare({ventas:{},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'fiction-classic-capability'})).patch))f.set(path,value);
 f.set('sv_operational_read_config',{schema:1,ready:true});
 const document=f.get('sv_stock_reference_config/activation'),pins=Object.fromEntries(['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].map(key=>[key,document[key]]));
 f.set(Numbering.PATH,{schema:1,generation:document.generation,revision:1,lastNumber:9,bootstrapOrderCount:0,bootstrapHash:'0'.repeat(64),cohortDigest:digest(pins),lastOperation:'fiction-bootstrap'});
 const orderProjection=StockOrder.prepare({inventory:{},generation:document.generation});f.set(StockOrder.CONFIG,{...orderProjection.config,ready:true,writersClosed:true});f.set(StockOrder.FENCE,orderProjection.fence);
 const reads=[],store={...f.store,read:async path=>{reads.push(path);return f.store.read(path);},readAsUser:f.store.read};
 const cohort={mappedAdmission:f.options.mappedAdmission,absenceAuthority:f.options.absenceAuthority,capabilities:async({read})=>{const [marker,doc]=await Promise.all([read('sv_stock_reference_config/installed'),read('sv_stock_reference_config/activation')]);return{version:1,installed:true,ready:Install.validateMarker(marker,{document:doc,verifier:f.verifier,now:f.now}),generation:document.generation};},assertAdmission:async({read})=>{const marker=await read('sv_stock_reference_config/installed'),doc=await read('sv_stock_reference_config/activation');a.equal(Install.validateMarker(marker,{document:doc,verifier:f.verifier,now:f.now}),true);await f.options.mappedAdmission.admit({read});}};
 // Readiness-only dependency shape, matching existing Host tests. It issues no
 // transaction or capability; executable rejection cases above use real Guard.
 const guard={run:()=>a.fail('Readiness must not start a transaction'),clientAccounts:true,clientHistory:true,saleFinancialDependencies:true,stockOrderProjections:true,operationalSummaries:true};
 const host=require('../cotizador/purchase-command-host').create({enabled:true,authorize:async()=>a.fail('Readiness must not authorize a command'),store,guard,cohort,now:()=>f.now});
 const clean=await host.readiness();a.equal(clean.ready,true);a.deepEqual(clean.missing,[]);
 f.set(ORDER,oldOrder());const before=digest(f.get('sisventas')),classic=await host.readiness();
 a.equal(classic.ready,true);a.deepEqual(classic.missing,[]);a.deepEqual(classic.commands,clean.commands);a.equal(classic.commands.orderInventory,true);a.equal(classic.commands.orderDelete,true);a.equal(orderProjection.fence.invalidCount,0);a.equal(reads.some(path=>path==='sisventas/ordenes'||path.startsWith('sisventas/ordenes/')),false);a.equal(digest(f.get('sisventas')),before);
});
