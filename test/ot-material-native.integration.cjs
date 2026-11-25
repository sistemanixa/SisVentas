'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Fixture=require('./helpers/ot-performance-fixture.cjs'),Native=require('../cotizador/ot-material-native-policy'),Materials=require('../cotizador/ot-material-edit-policy'),{digest,put}=require('../cotizador/labor-guard'),Economics=require('../js/core/sale-economics-model.v1');
async function fixture(tamper){
 const f=await Fixture.create({rowCount:1,otherCount:0,runtimeModule:{createLaborRuntime:options=>require('../cotizador/labor-runtime').createLaborRuntime({...options,clientAccounts:true,clientHistory:true,saleFinancialDependencies:true})},prepare:async data=>{
  data.sv_ot_metadata_config={schema:1,ready:true,generation:'fiction-native'};data.sv_permisos.admin.acciones.ot.corregirMateriales=true;data.sisventas.ordenes_trabajo.ot.clienteFbKey='client';data.sisventas.clientes={client:{id:'C-FICTION',nombre:'Fiction'}};data.sisventas.ventas.sale=Economics.calculate(data.sisventas.ventas.sale);
  const customers={clients:data.sisventas.clientes,index:{},structures:{}},apply=patch=>{for(const [path,value]of Object.entries(patch))Object.assign(data,put(data,path.split('/'),value));};
  apply((await require('../cotizador/client-account-projections').prepare({sales:data.sisventas.ventas,payments:{},customers,owner:()=> 'u',generation:'fiction-accounts'})).patch);
  apply(require('../cotizador/payment-membership-index').buildIndex({},{generation:'fiction-membership',ready:true}).patch);
  const H=require('../cotizador/client-history-model');apply((await H.prepare({records:Object.fromEntries(H.domains.map(domain=>[domain,data.sisventas[domain]||{}])),customers,owner:()=> 'u',generation:'fiction-history'})).patch);
  apply((await require('../cotizador/sale-financial-dependencies-model').prepare({ventas:data.sisventas.ventas,gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'fiction-financial'})).patch);
  data.sv_client_accounts_config={schema:1,ready:true,generation:'fiction-accounts'};data.sv_client_history_config={schema:1,ready:true,generation:'fiction-history',writerSchema:1};
 }});
 const pages=await require('../cotizador/commercial-pages-projections').prepare({sales:f.get('sisventas/ventas'),payments:{},owner:()=> 'u',generation:'fiction-pages',nativeCollections:true});for(const [path,value]of Object.entries(pages.patch))f.set(path,value);f.set('sv_commercial_pages_config',{schema:1,ready:true,generation:'fiction-pages',nativeCollectionsReady:true,nativeCollectionsSchema:1});
 const commit=f.runtime.store.commit.bind(f.runtime.store);f.runtime.store.commit=async(patch,lease,actor)=>{
  if(tamper==='patch')patch['sisventas/ordenes_trabajo/ot'].materiales[0].instalada=77;
  await Materials.validateSource({actor:tamper==='clone'?JSON.parse(JSON.stringify(actor)):actor,lease,patch,readFresh:path=>f.runtime.store.read(path),operationalSummaries:true});
  return commit(patch,lease,actor);
 };
 const ot=f.get('sisventas/ordenes_trabajo/ot'),sale=f.get('sisventas/ventas/sale'),after=Economics.calculate({...sale,items:sale.items.map(row=>({...row,qty:3}))}),patch={'sisventas/ordenes_trabajo/ot/materiales':ot.materiales,'sisventas/ordenes_trabajo/ot/audit':[],'sisventas/ventas/sale':after},body={id:'fiction-native-materials',kind:'atomic',path:'',purpose:Native.PURPOSE,value:patch,expectedHashes:{'sisventas/ordenes_trabajo/ot':digest(ot),'sisventas/ventas/sale':digest(sale)}},actor={uid:'u',claims:{uid:'u'},mode:'user',operation:'legacy-atomic',input:body,opId:body.id,transportDigest:digest(body)};
 const run=()=>f.runtime.guard.run(actor,async scope=>{const prepared=await Native.prepare({actor,lease:scope.lease,body,patch,scope});await scope.update(prepared.patch);return{ok:true,committed:true,operationId:body.id,otKey:prepared.otKey};});return {...f,run,body,actor,sale};
}
test('backend bundled adapter is byte-identical to canonical UI pure model',()=>{assert.deepEqual(fs.readFileSync(require.resolve('../cotizador/ot-related-adapters')),fs.readFileSync(require.resolve('../js/modules/ot-related-adapters')));});

test('actual Gateway routes typed Materials under genuine cohort, native physical Store and Financial/History, replay is one effect',async t=>{
 const f=await fixture(),seal=require('./helpers/ot-gateway-signed-cohort.cjs').create(t),Runtime=require('../cotizador/inventory-cohort-runtime');
 f.set(Runtime.ACTIVATION,seal.document);f.set(Runtime.INSTALLED,seal.marker);
 const cohort=Runtime.create({enabled:true,read:f.runtime.store.read,...seal}),tokens=[];
 const native=require('../cotizador/labor-rtdb-store').createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'FICTION',otPhysicalWrites:true,fetchImpl:async(url,options)=>{
  const u=new URL(url),p=decodeURIComponent(u.pathname).slice(1,-5);assert.equal(u.hostname,'fixture.invalid');let value=null;
  if(options.method==='GET')value=f.get(p);else{assert.equal(options.method,'PATCH');tokens.push(JSON.parse(u.searchParams.get('auth_variable_override')).token);const patch=JSON.parse(options.body);f.commits.push(patch);for(const [path,value]of Object.entries(patch))f.set(path,value);}
  return{ok:true,status:200,json:async()=>structuredClone(value),body:{cancel:async()=>{}}};
 }});
 f.runtime.store.commit=native.commit;
 const gateway=require('../cotizador/labor-write-gateway').createLaborWriteGateway({...f.runtime,enabled:true,inventoryCohort:cohort});
 const out=await gateway.write(f.identity,f.body);assert.equal(out.committed,true);assert.equal(tokens[0].svOTMetadataKind,'materials');assert.equal(tokens[0].svOTPhysicalCommitVersion,1);assert.equal(tokens[0].svOTPhysicalUnchanged,true);assert.equal(tokens[0].svSaleFinancialWriterVersion,1);
 assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/entregada'),0);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/instalada'),0);assert.equal(f.get('sisventas/comisiones/preserved/monto'),7);
 await gateway.write(f.identity,f.body);assert.equal(f.commits.length,1);assert.equal(tokens.length,1);
});
test('native Materials prepare with real Guard/REST Store maintains Financial and History ON',async()=>{
 const f=await fixture();assert.equal(f.runtime.guard.clientHistory,true);assert.equal(f.runtime.guard.saleFinancialDependencies,true);await f.run();assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/entregada'),0);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/instalada'),0);assert.equal(f.get('sisventas/ventas/sale/total'),150);
 assert(Object.keys(f.commits[0]).some(path=>path.startsWith('sv_sale_financial_dependencies/')));assert(Object.keys(f.commits[0]).some(path=>path.startsWith('sv_client_history/')));assert.equal(f.get('sisventas/comisiones/preserved/monto'),7);await f.run();assert.equal(f.commits.length,1);
});
for(const tamper of ['patch','clone'])test('native Materials rejects '+tamper+' with zero PATCH under Financial/History ON',async()=>{const f=await fixture(tamper);await assert.rejects(f.run(),{code:'SV_OT_MATERIAL_EDIT_AUTHORITY'});assert.equal(f.commits.length,0);});
test('native Materials reset and stale Sale references reject with zero PATCH',async()=>{
 for(const mode of ['reset','stale']){const f=await fixture();if(mode==='reset')f.set('sv_access_resets/u',{required:true});else f.set('sisventas/ventas/sale/otId','other');await assert.rejects(f.run());assert.equal(f.commits.length,0);}
});
test('native Materials permission or access reset revoked in fresh phase prevents commit',async()=>{
 for(const mode of ['permission','reset']){const f=await fixture();let reads=0;f.onRequest(entry=>{if(entry.method==='GET'&&entry.path==='sv_permisos/admin'&&++reads===2){if(mode==='permission')f.set('sv_permisos/admin/acciones/ot/corregirMateriales',false);else f.set('sv_access_resets/u',{required:true});}});await assert.rejects(f.run());assert.equal(f.commits.length,0);}
});
test('native Materials tech custom permission still requires current assignment and rereads it freshly',async()=>{
 for(const mode of ['assigned','revoked']){const f=await fixture();f.set('sv_chat_roles/u/rol','tecnico');f.set('sv_permisos/tecnico',{indiceVersion:2,indiceRevision:1,indiceModulos:{ordentrabajo:true},acciones:{ot:{corregirMateriales:true}}});f.set('sv_empleado_uid/u',{perfilFbKey:'profile'});f.set('sv_usuarios/profile',{uid:'u',activo:true,empleadoFbKey:'employee'});f.set('sisventas/empleados/employee',{nombre:'Fiction technician',activo:true});const ot=f.get('sisventas/ordenes_trabajo/ot');ot.tecnico='Fiction technician';f.set('sisventas/ordenes_trabajo/ot',ot);f.body.expectedHashes['sisventas/ordenes_trabajo/ot']=digest(ot);f.actor.transportDigest=digest(f.body);
  let reads=0;if(mode==='revoked')f.onRequest(entry=>{if(entry.method==='GET'&&entry.path==='sv_usuarios/profile'&&++reads===2)f.set('sv_usuarios/profile/empleadoFbKey','other');});
  if(mode==='assigned'){await f.run();assert.equal(f.commits.length,1);}else{await assert.rejects(f.run());assert.equal(f.commits.length,0);}
 }
});
test('native Materials derives additional mode from null Sale original and preserves primary Sale under F/H ON',async()=>{
 const f=await fixture(),ot=f.get('sisventas/ordenes_trabajo/ot'),primary=structuredClone(f.get('sisventas/ventas/sale')),extra=Economics.calculate({...primary,id:'V-EXTRA',otNumero:ot.id,tipoVenta:'adicional_ot',ts:Date.now(),items:primary.items.map(row=>({...row,desc:'Ficticio',adicionalOT:true,origenOTKey:'ot'}))});
 delete f.body.value['sisventas/ventas/sale'];f.body.value['sisventas/ventas/extra']=extra;f.body.expectedHashes={'sisventas/ordenes_trabajo/ot':digest(ot),'sisventas/ventas/extra':digest(null)};f.actor.transportDigest=digest(f.body);await f.run();assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/ventaDestinoFbKey'),'extra');assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/1/entregada'),0);assert.deepEqual(f.get('sisventas/ventas/sale'),primary);
});
test('native Materials strict body denies extra source or client mode flags',()=>{
 for(const mutate of [body=>body.mode='additional',body=>body.expectedHashes['sisventas/ventas/other']='b'.repeat(64),body=>body.kind='patch']){const body={id:'fiction-strict',kind:'atomic',path:'',purpose:'ot-materials',value:{},expectedHashes:{'sisventas/ordenes_trabajo/ot':'a'.repeat(64),'sisventas/ventas/sale':'a'.repeat(64)}};mutate(body);assert.throws(()=>Native.describe(body),{code:'SV_OT_MATERIAL_NATIVE_AUTHORITY'});}
});
