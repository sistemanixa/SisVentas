'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const sourceRoot=process.env.SV_SALE_DELETE_TARGET_PREPARATION_SOURCE_ROOT||path.resolve(__dirname,'..'),at=createRequire(path.join(sourceRoot,'cotizador','index.js'));
const M=at('./sale-delete-target-index'),Preparation=at('./sale-delete-target-preparation'),G=at('./labor-guard');
async function fixture(){
 const backend=await at('../test/helpers/coordinated-backend.cjs').createCoordinatedBackend({ventas:{sale:{id:'V-PREP-1',total:10,responsableUid:'u',clienteFbKey:'c'}},pagos:{pay:{ventaFbKey:'sale',monto:2}}});let state=backend.state;
 const get=p=>structuredClone(G.child(state,G.parts(p))),set=(p,v)=>{state=G.put(state,G.parts(p),structuredClone(v));};
 set('sv_client_history',null);set('sv_client_history_config',null);set('sv_sale_financial_dependencies',null);set('sv_sale_delete_relations',null);set('sv_chat_roles/u',{rol:'admin',activo:true});
 const permissions={indiceVersion:2,indiceRevision:1,indiceModulos:{configuracion:true,venta:true},acciones:{mantenimiento:{migrar:true},ventas:{eliminar:true}}};set('sv_permisos/admin',permissions);set('sv_labor_config',{schema:1,ready:true,writerSchema:2});
 const calls=[],commits=[],control={beforeRead:null};const fetchImpl=async(target,options)=>{
  const url=new URL(target),p=decodeURIComponent(url.pathname).slice(1,-5),body=options.body===undefined?undefined:JSON.parse(options.body),override=JSON.parse(url.searchParams.get('auth_variable_override')||'null');assert.equal(url.origin,'http://127.0.0.1:1');calls.push({method:options.method,path:p,override});
  if(options.method==='GET'){await control.beforeRead?.(p);return new Response(JSON.stringify(get(p)));}
  if(options.method==='PUT'){assert.equal(p,'sv_labor_guard');set(p,body);}
  else if(options.method==='DELETE'){assert.equal(p,'sv_labor_guard');set(p,null);}
  else if(options.method==='PATCH'){assert.equal(p,'');commits.push({patch:structuredClone(body),override});for(const[k,v]of Object.entries(body))set(k,v);}
  else assert.fail('Unexpected transport method');return new Response('null');
 };
 const db={ref:p=>({get:async()=>({val:()=>get(p)}),toString:()=> 'http://127.0.0.1:1/'+p})};
 const runtime=at('./labor-runtime').createLaborRuntime({db,databaseURL:'http://127.0.0.1:1/?ns=demo-preparation',accessToken:async()=>'FIXTURE_ONLY',fetchImpl,enabled:true,commercialPages:true,clientAccounts:true,operationalSummaries:true,clientHistory:false,saleFinancialDependencies:false,saleDeleteActivity:true,saleDeleteRelations:true,saleDeleteEvidenceMode:'targeted'});
 const actor=opId=>({uid:'u',claims:{uid:'u',svAccessVersion:'fixture-version'},mode:'user',role:'admin',permissionRevision:1,permissionDigest:G.digest(permissions),opId,operation:'sale-delete-prepare',financialAction:'ventas.eliminar.preparar',input:{id:opId}});
 const run=(work,opId='prepare-fixture-operation')=>runtime.guard.run(actor(opId),work);
 return {get,set,calls,commits,control,runtime,actor,run};
}
test('genuine Guard/RESTStore preparation installs metadata only and derives writer claim after maintenance',async()=>{
 const f=await fixture(),before=f.get('sisventas'),result=await f.run(scope=>Preparation.prepare({scope,store:f.runtime.store}));assert.equal(result.prepared,true);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas'),before);assert.equal(f.get('sv_client_history'),null);assert.equal(f.get('sv_sale_financial_dependencies'),null);assert.equal(f.get('sv_labor_guard'),null);M.validateConfig(f.get(M.CONFIG),f.get(M.ROOT+'/coverage'));
 const c=f.commits[0];assert.equal(c.override.token.svSaleDeleteRelationsWriterVersion,1);assert.equal(c.override.token.svClientHistoryWriterVersion,0);assert.equal(c.override.token.svSaleFinancialWriterVersion,0);assert(Object.keys(c.patch).every(p=>p.startsWith('sv_sale_delete_relations/')||p.startsWith('sv_labor_receipts/')||p==='sv_labor_guard'));
 for(const root of M.roots)assert.equal(f.calls.filter(c=>c.method==='GET'&&c.path===root).length,2,root+' initial/fresh');
});
test('a branded plan minted through fake scope callbacks cannot transfer to genuine scope with same UID and operation',async()=>{
 const f=await fixture(),opId='prepare-fake-operation';let plan;const fake={actor:f.actor(opId),lease:{opId},get:async()=>null,installSaleDeleteRelations:async p=>{plan=p;}};
 await Preparation.prepare({scope:fake,store:{exists:async()=>false}});assert(plan);await assert.rejects(f.run(scope=>scope.installSaleDeleteRelations(plan),opId),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.equal(f.commits.length,0);assert.equal(f.get('sv_sale_delete_relations'),null);assert.equal(f.get('sv_labor_guard'),null);
});
test('JSON and cloned plans cannot manufacture preparation authority',async()=>{for(const plan of [{},structuredClone({})]){const f=await fixture();await assert.rejects(f.run(scope=>scope.installSaleDeleteRelations(plan)),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.equal(f.commits.length,0);}});
test('preparation source checks are installed inside the frozen genuine Guard scope',async()=>{const f=await fixture();await f.run(async scope=>{assert(Object.isFrozen(scope));assert.equal(Reflect.set(scope,'beforeCommit',()=>{}),false);assert.equal(Reflect.set(scope,'get',async()=>null),false);return Preparation.prepare({scope,store:f.runtime.store});});assert.equal(f.commits.length,1);});
test('a source changes during the final preparation pass: no metadata commit and no partial business mutation',async()=>{
 const f=await fixture();let reads=0,changed=false;f.control.beforeRead=p=>{if(p==='sisventas/ventas'&&++reads===2){changed=true;f.set('sisventas/ventas/sale/total',11);}};await assert.rejects(f.run(scope=>Preparation.prepare({scope,store:f.runtime.store})),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert(changed);assert.equal(f.commits.length,0);assert.equal(f.get('sv_sale_delete_relations'),null);assert.equal(f.get('sv_labor_guard'),null);assert.equal(f.get('sisventas/ventas/sale/total'),11);
});
test('partial namespace present initially or appearing before commit never becomes ready',async()=>{
 let f=await fixture();f.set('sv_sale_delete_relations',{unknown:true});await assert.rejects(f.run(scope=>Preparation.prepare({scope,store:f.runtime.store})),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.equal(f.commits.length,0);f=await fixture();let phase=0;f.control.beforeRead=p=>{if(p==='sisventas/ventas'&&++phase===2)f.set('sv_sale_delete_relations',{unknown:true});};await assert.rejects(f.run(scope=>Preparation.prepare({scope,store:f.runtime.store})),{code:'SV_SALE_DELETE_TARGET_INDEX'});assert.equal(f.commits.length,0);
});
test('business writes cannot be mixed before or after metadata preparation',async()=>{
 for(const when of ['before','after']){const f=await fixture(),before=f.get('sisventas');await assert.rejects(f.run(async scope=>{if(when==='before')await scope.update({'sisventas/ventas/sale/total':11});const result=await Preparation.prepare({scope,store:f.runtime.store});if(when==='after')await scope.update({'sisventas/ventas/sale/total':11});return result;}));assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas'),before);assert.equal(f.get('sv_sale_delete_relations'),null);}
});
test('late revocation of migration permission denies prepared metadata before commit',async()=>{
 const f=await fixture();let reads=0;f.control.beforeRead=p=>{if(p==='sisventas/ventas'&&++reads===2)f.set('sv_permisos/admin/acciones/mantenimiento/migrar',false);};await assert.rejects(f.run(scope=>Preparation.prepare({scope,store:f.runtime.store})));assert.equal(f.commits.length,0);assert.equal(f.get('sv_sale_delete_relations'),null);assert.equal(f.get('sv_labor_guard'),null);
});
test('unaffected metadata writes perform no target-index reads and cannot forge the new writer claim',async()=>{
 const f=await fixture();await f.run(scope=>Preparation.prepare({scope,store:f.runtime.store}));f.calls.length=0;f.commits.length=0;
 await f.runtime.guard.run({uid:'sv-job',mode:'server',opId:'unrelated-fixture-operation',operation:'unrelated-metadata',claims:{svSaleDeleteRelationsWriterVersion:1},saleDeleteRelationsWriterVersion:1},async scope=>{await scope.update({'sisventas/ajustes/titulo':'Ficticio'});return {ok:true};});
 assert.equal(f.commits.length,1);assert(!f.calls.some(c=>c.method==='GET'&&(c.path==='sv_sale_delete_relations'||c.path.startsWith('sv_sale_delete_relations/'))));assert.equal(f.commits[0].override.token.svSaleDeleteRelationsWriterVersion,0);
});
