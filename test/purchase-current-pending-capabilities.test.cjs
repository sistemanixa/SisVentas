'use strict';
// Measurement only. Native Guard/RESTStore; all HTTP/auth is intercepted fiction.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/initial-inventory-fixture.cjs'),{createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{queryRows}=require('./helpers/stock-reference-query-fixture.cjs');
const Host=require('../cotizador/purchase-command-host'),Current=require('../cotizador/purchase-current-pending-command'),Mapper=require('../cotizador/office-stock-link-command'),Financial=require('../cotizador/sale-financial-dependencies-model'),Numbering=require('../cotizador/purchase-numbering'),Order=require('../cotizador/office-stock-order'),Projection=require('../cotizador/office-stock-order-projections'),Install=require('../cotizador/inventory-installation-contract');
const {createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const copy=value=>structuredClone(value),P='sisventas/ordenes/classic',J='sisventas/inventario_operativo/legacy';

test('measure two uncached native Host.capabilities calls after a genuine fictitious current-pending baseline',async t=>{
 const f=await fixture(t),transport=[],patches=[];
 // initial-inventory-fixture deliberately deletes these roots. Seed an explicit
 // KNOWN original ledger, never reinterpret null as a physical zero.
 const originalStock={codigo:'legacy',general:10,reservado:2,consumido:0,enCompra:2,asignaciones:{},operaciones:{},costoReferenciaStock:2.25};f.set(J,originalStock);
 f.set('sisventas/productos/product/unidad','Unidad');f.set('sisventas/proveedores/provider',{nombre:'Proveedor ficticio',activo:true});
 const backend=await createCoordinatedBackend(f.get('sisventas'));
 for(const [path,value]of Object.entries(backend.state))if(!['sisventas','sv_labor_guard','sv_chat_roles','sv_permisos'].includes(path))f.set(path,value);
 const financial=await Financial.prepare({ventas:f.get('sisventas/ventas'),gastos:f.get('sisventas/gastos'),ctaemp:f.get('sisventas/ctaemp'),comisiones_generacion:f.get('sisventas/comisiones_generacion'),sv_commission_generation:f.get('sv_commission_generation')},{generation:'capabilities-known-baseline'});
 for(const [path,value]of Object.entries(financial.patch))f.set(path,value);
 f.set('sv_operational_read_config',{schema:1,ready:true});f.set('sv_permisos/admin/indiceModulos/ordenes',true);f.set('sv_permisos/admin/indiceModulos/configuracion',true);f.set('sv_permisos/admin/acciones/ordenes/editar',true);f.set('sv_permisos/admin/acciones/mantenimiento/migrar',true);
 // Drop only the fixture's pre-created, unexecuted initial-operation lease.
 f.set('sv_labor_guard',null);
 const document=f.get('sv_stock_reference_config/activation'),pins=Object.fromEntries(['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].map(key=>[key,document[key]]));
 f.set(Numbering.PATH,{schema:1,generation:document.generation,revision:1,lastNumber:9,bootstrapOrderCount:0,bootstrapHash:'0'.repeat(64),cohortDigest:digest(pins),lastOperation:'capabilities-bootstrap'});
 const prepared=Order.prepare({inventory:f.get('sisventas/inventario_operativo'),generation:document.generation});for(const [path,value]of Object.entries(prepared.patch))f.set(path,value);f.set(Order.CONFIG,{...prepared.config,ready:true,writersClosed:true});f.set(Order.FENCE,prepared.fence);
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-no-network',now:()=>f.now,accessToken:async()=>'fiction-only-no-http-auth',fetchImpl:async(url,options)=>{
  const target=new URL(url);assert.equal(target.hostname,'127.0.0.1');const path=decodeURIComponent(target.pathname).slice(1,-5),call={method:options.method,path,query:false,bytes:0};let value=null;
  if(options.method==='GET'){
   assert.ok(path,'No database-root GET');value=f.get(path);
   if(target.searchParams.has('orderBy')){call.query=true;const query=Object.fromEntries([...target.searchParams].filter(([key])=>!['ns','auth_variable_override'].includes(key)).map(([key,value])=>[key,JSON.parse(value)]));value=queryRows(value,query);}
   call.bytes=Buffer.byteLength(JSON.stringify(value),'utf8');
  }else if(options.method==='PUT'){assert.equal(path,'sv_labor_guard');f.set(path,JSON.parse(options.body));}
  else if(options.method==='DELETE'){assert.equal(path,'sv_labor_guard');f.set(path,null);}
  else if(options.method==='PATCH'){const patch=JSON.parse(options.body);patches.push(copy(patch));for(const [key,value]of Object.entries(patch))f.set(key,value);}
  else assert.fail('Unexpected REST method');transport.push(call);return {ok:true,status:200,body:{cancel:async()=>{}},json:async()=>copy(value)};
 }});
 async function admit({read}){const marker=await read('sv_stock_reference_config/installed'),doc=await read('sv_stock_reference_config/activation');assert.equal(Install.validateMarker(marker,{document:doc,verifier:f.verifier,now:f.now}),true);await f.options.mappedAdmission.admit({read});}
 const projector=Projection.create({enabled:true,verifyCohort:async({read})=>{await admit({read});const doc=await read('sv_stock_reference_config/activation');return {schema:1,generation:doc.generation,writerVersion:1,verified:true};}});
 const guard=createLaborGuard({store,now:()=>f.now,operationalSummaries:true,stockOrderProjections:projector,commercialPages:true,clientAccounts:true,clientHistory:true,saleFinancialDependencies:true,delay:async()=>{}});
 // Restore P/J/R through the real mapper, native lease and native REST commit.
 // The initial fixture removed the original pair; no mapping/marker is forged.
 const mapper=Mapper.create({store,guard,enabled:true,queryPage:store.queryPage,now:()=>f.now,assertBarrier:admit,authorize:async()=>f.identity});
 const preview=await mapper.preview(f.identity,{productKey:'product',inventoryKey:'legacy'});
 const mapped=await mapper.execute(f.identity,{id:'capabilities-genuine-map',productKey:'product',inventoryKey:'legacy',reason:'Asociación ficticia conocida',expectedHash:preview.expectedHash});assert.equal(mapped.committed,true);assert.equal(mapped.receiptIdentityKey,'legacy');
 const order={estado:'recepcion_parcial',origen:'manual',numero:'FICTION',proveedorKey:'provider',proveedor:'Proveedor ficticio',moneda:'ARS',items:[{productoKey:'product',cantidadOrdenada:3,cantidadRecibida:1,cantidadCostoReal:1,costoRealAcumulado:2.25,costoUnitario:2.25,precioPublico:9.75}],total:6.75,monto:6.75};f.set(P,order);
 const before=copy(f.get('sisventas')),stock=copy(f.get(J)),counter=copy(f.get(Numbering.PATH));
 const command=Current.create({enabled:true,authorize:async()=>f.identity,store,guard,mappedAdmission:f.options.mappedAdmission,queryPage:store.queryPage,assertAdmission:admit,now:()=>f.now});
 const body={id:'capabilities-genuine-baseline',orderKey:'classic',expectedHash:digest(order)},baseline=await command.execute({},body);
 assert.equal(baseline.reconciliation,'current-pending');assert.equal(baseline.baselineVersion,1);assert.deepEqual(f.get(J),stock);assert.deepEqual(f.get(Numbering.PATH),counter);assert.equal(f.get(P+'/inventarioCompra/baseline/rows/0/pending'),2);assert.equal(f.get(P+'/inventarioCompra/baseline/rows/0/received'),1);assert.equal(f.get('sv_labor_receipts/'+body.id+'/result/baselineDigest'),baseline.baselineDigest);assert.equal(f.get('sv_labor_guard'),null);
 const restored=copy(f.get(P));for(const field of ['inventarioCompra','_svReadRevision','_svReadOperation'])delete restored[field];assert.deepEqual(restored,before.ordenes.classic);
 const cohort={mappedAdmission:f.options.mappedAdmission,absenceAuthority:f.options.absenceAuthority,assertAdmission:admit,capabilities:async({read})=>{const [marker,doc]=await Promise.all([read('sv_stock_reference_config/installed'),read('sv_stock_reference_config/activation')]);return {version:1,installed:marker!==null||doc!==null,ready:Install.validateMarker(marker,{document:doc,verifier:f.verifier,now:f.now}),generation:doc.generation};}};
 const host=Host.create({enabled:true,authorize:async()=>f.identity,store,guard,cohort,initialInventoryReference:f.api,queryPage:store.queryPage,now:()=>f.now});
 const stable=copy(f.get('sisventas')),receipt=copy(f.get('sv_labor_receipts/'+body.id)),physical=copy(f.get(J)),writesBefore=patches.length,measurements=[];
 for(let index=0;index<2;index++){
  const start=transport.length,result=await host.capabilities(),calls=transport.slice(start),points=calls.filter(call=>call.method==='GET'&&!call.query),queries=calls.filter(call=>call.method==='GET'&&call.query);
  assert.equal(result.ready,true);assert.equal(result.installed,true);assert.ok(Object.values(result.commands).every(Boolean));assert.ok(points.length>0);assert.ok(calls.every(call=>call.method==='GET'));
  measurements.push({call:index+1,ready:result.ready,pointGETs:points.length,queryGETs:queries.length,jsonResponseBytesUTF8:calls.reduce((sum,call)=>sum+call.bytes,0),pointPaths:points.map(call=>call.path),queryPaths:queries.map(call=>call.path)});
 }
 assert.deepEqual(f.get('sisventas'),stable);assert.deepEqual(f.get(J),physical);assert.deepEqual(f.get('sv_labor_receipts/'+body.id),receipt);assert.equal(f.get('sv_labor_guard'),null);assert.equal(patches.length,writesBefore);assert.equal(measurements[1].pointGETs,measurements[0].pointGETs);assert.equal(measurements[1].queryGETs,measurements[0].queryGETs);assert.equal(measurements[1].jsonResponseBytesUTF8,measurements[0].jsonResponseBytesUTF8);
 console.log('PURCHASE_CAPABILITIES_MEASUREMENT '+JSON.stringify({httpAuthenticationMeasured:false,transport:'intercepted native RESTStore',baseline:'native Guard+RESTStore genuine signed cohort',measurements}));
});
