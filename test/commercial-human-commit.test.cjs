'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborRuntime}=require('../cotizador/labor-runtime'),{createCommercialOwnership}=require('../cotizador/commercial-ownership');
const Permissions=require('../js/core/permission-index');
const clone=v=>v==null?null:structuredClone(v),at=(v,p)=>p.split('/').filter(Boolean).reduce((n,k)=>n?.[k],v)??null;
function put(root,path,value){const keys=path.split('/').filter(Boolean),last=keys.pop();let n=root;for(const k of keys)n=n[k]||={};if(value===null)delete n[last];else n[last]=clone(value);}
function fixture(extra={}){
 const sale={id:'V-FICTICIA',creadaPor:'Admin histórico',fecha:'2026-10-01',total:100,totalPagado:100,comisionesGeneradas:true,...extra};
 const state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{activo:true,rol:'admin'},seller:{activo:true,rol:'vendedor'}},sv_chat_directorio:{admin:{nombre:'Admin actual'},seller:{nombre:'Vendedor actual'}},sv_usuarios:{a:{uid:'admin',activo:true,rol:'admin',nombre:'Admin histórico'},s:{uid:'seller',activo:true,rol:'vendedor',nombre:'Vendedor histórico'}},sv_permisos:Permissions.build({admin:{bloqueados:[],acciones:{}},vendedor:{bloqueados:[],acciones:{}}}),sisventas:{ventas:{sale},pagos:{keep:{ventaFbKey:'sale',monto:100}},gastos:{keep:{monto:10,tipoPagable:'comision',estado:'pagado'}}}};
 const calls=[],direct=[],profileReads={},rawReads=[];let hook,denyCommit=false;
 const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>clone(data),body:{cancel:async()=>{}}});
 const raw={ref(path=''){const r={key:path.split('/').at(-1),toString:()=> 'https://fixture.invalid/'+path,get:async()=>{rawReads.push(path);const value=clone(at(state,path));return {val:()=>clone(value),ref:r};},on(event,success,failure){r.get().then(success,failure);return success;},off(){},child:p=>raw.ref([path,p].filter(Boolean).join('/')),transaction(){direct.push('transaction');throw Error('Unscoped transaction');}};return r;}};
 const runtime=createLaborRuntime({db:raw,databaseURL:'https://fixture.invalid',accessToken:async()=>'fictitious-loopback-token',enabled:true,fetchImpl:async(url,init)=>{
  const target=new URL(url);assert.equal(target.origin,'https://fixture.invalid');const path=decodeURIComponent(target.pathname).replace(/^\/|\.json$/g,''),auth=JSON.parse(target.searchParams.get('auth_variable_override')||'null');calls.push({method:init.method,path,auth});
  if(init.method==='GET'){profileReads[path]=(profileReads[path]||0)+1;await hook?.(path,profileReads[path]);return response(at(state,path));}
  if(init.method==='PUT'){put(state,path,JSON.parse(init.body));return response(null);}
  if(init.method==='DELETE'){put(state,path,null);return response(null);}
  assert.equal(init.method,'PATCH');if(denyCommit)return response({error:'Synthetic final rejection'},403);for(const [p,v]of Object.entries(JSON.parse(init.body)))put(state,p,v);return response(null);
 }});
 const commercial=createCommercialOwnership({auth:{verifyIdToken:async uid=>({uid})},db:runtime.db,enabled:true,now:()=>1792620000000});
 const authorize=(uid='admin',domain='ventas')=>commercial.authorize({headers:{authorization:'Bearer '+uid}},domain);
 return {state,sale,runtime,commercial,calls,direct,rawReads,authorize,setHook:fn=>{hook=fn;},denyCommit:()=>{denyCommit=true;},async prepare(uid='admin'){const actor=await authorize(uid),body={id:'sale'};return runtime.run(actor,'commercial-prepare',body,()=>commercial.prepare(actor,body));}};
}

test('commercial preparation commits as the authenticated human and retains only acknowledgement in the receipt',async()=>{
 const f=fixture(),payments=clone(f.state.sisventas.pagos),commissions=clone(f.state.sisventas.gastos),result=await f.prepare();assert.equal(result.record.responsableUid,'admin');assert.equal(result.record.creadaPor,'Admin histórico');assert.equal(result.record.creadorOriginalNombre,'Admin actual');
 const commit=f.calls.find(c=>c.method==='PATCH');assert.equal(commit.auth.uid,'admin');assert.equal(commit.auth.token.svLaborService,true);assert.equal(commit.auth.token.actorUid,'admin');
 assert.deepEqual(Object.values(f.state.sv_labor_receipts)[0].result,{ok:true,committed:true});assert.deepEqual(f.state.sisventas.pagos,payments);assert.deepEqual(f.state.sisventas.gastos,commissions);assert.deepEqual(f.direct,[]);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);
 assert.ok(!f.rawReads.includes('sv_chat_directorio'));assert.deepEqual(f.calls.filter(c=>c.path.startsWith('sv_chat_directorio')).map(c=>c.path),['sv_chat_directorio/admin']);
});

for(const mode of ['claim','preview','realUid'])test('runtime rejects '+mode+' identity mismatch before acquiring a lease',async()=>{
 const f=fixture(),authorized=await f.authorize(),actor={...authorized,claims:mode==='claim'?{uid:'other'}:authorized.claims,permissionRevision:authorized.permissionRevision,permissionDigest:authorized.permissionDigest};if(mode==='preview')actor.viewing=true;if(mode==='realUid')actor.realUid='other';
 await assert.rejects(async()=>f.runtime.run(actor,'commercial-prepare',{},()=>({secret:true})),{statusCode:403});assert.equal(f.calls.length,0);
});

test('a commit rejection cannot return an already calculated successful record to HTTP',async()=>{
 const f=fixture(),before=clone(f.state.sisventas);f.denyCommit();await assert.rejects(f.prepare(),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});assert.deepEqual(f.state.sisventas,before);assert.equal(f.state.sv_labor_receipts,undefined);
});

for(const mode of ['role','inactive','revision','digest','module'])test('store revalidates current '+mode+' before transmitting the final PATCH',async()=>{
 const f=fixture(),before=clone(f.state.sisventas);f.setHook((path,n)=>{if(n!==2)return;if(path==='sv_chat_roles/admin'){if(mode==='role')f.state.sv_chat_roles.admin.rol='administrativo';if(mode==='inactive')f.state.sv_chat_roles.admin.activo=false;}if(path==='sv_permisos/admin'){if(mode==='revision')f.state.sv_permisos.admin.indiceRevision++;if(mode==='digest')f.state.sv_permisos.admin.acciones.ventas={editar:false};if(mode==='module')f.state.sv_permisos.admin.indiceModulos.venta=false;}});
 await assert.rejects(f.prepare());assert.deepEqual(f.state.sisventas,before);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);assert.equal(f.state.sv_labor_guard,undefined);
});

test('Detalle-only access fails clearly before attempting a Sales mutation',async()=>{
 const f=fixture();f.state.sv_permisos.admin.indiceModulos.venta=false;f.state.sv_permisos.admin.indiceModulos.detalle=true;await assert.rejects(f.prepare(),e=>e.statusCode===403&&/módulo/.test(e.message));assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);
});

test('Presupuestos keeps its former command transport even if an internal caller reuses the operation name',async()=>{
 const f=fixture(),actor=await f.authorize('admin','presupuestos'),result=await f.runtime.run(actor,'commercial-prepare',{},()=>({unchanged:true}));assert.deepEqual(result,{unchanged:true});const commit=f.calls.find(c=>c.method==='PATCH');assert.equal(commit.auth.uid,'sv-labor-service');assert.equal(commit.auth.token.actorRole,'admin');
});

for(const [mode,extra]of [['matching',{creadorOriginalNombre:'Admin actual',creadaPorUid:'admin'}],['mismatch',{creadorOriginalNombre:'Nombre fijo',creadaPorUid:'admin'}],['unknown',{creadorOriginalNombre:'Nombre fijo'}],['invalid-uid',{creadaPorUid:'invalid/path'}],['zero-timestamp',{creadoEn:0,ts:20}],['existing-empty-uid',{creadorOriginalUid:''}]])test('original authorship metadata is preserved: '+mode,async()=>{
 const f=fixture(extra),result=await f.prepare(),saved=f.state.sisventas.ventas.sale;assert.equal(saved.creadaPor,'Admin histórico');if(Object.hasOwn(extra,'creadorOriginalNombre'))assert.equal(saved.creadorOriginalNombre,extra.creadorOriginalNombre);
 if(mode==='matching')assert.equal(saved.creadorOriginalUid,'admin');if(['mismatch','unknown'].includes(mode)){assert.equal(saved.creadorOriginalUid,undefined);assert.equal(result.warnings[0].code,'SV_COMMERCIAL_AUTHOR_REVIEW');}if(mode==='invalid-uid'){assert.equal(saved.creadorOriginalUid,undefined);assert.ok(!f.rawReads.some(p=>p.includes('invalid/path'))&&!f.calls.some(c=>c.path.includes('invalid/path')));}if(mode==='zero-timestamp')assert.equal(saved.creadoEn,0);if(mode==='existing-empty-uid')assert.equal(saved.creadorOriginalUid,'');
});

test('a canonical nonadmin record prepares without changing ownership or adding historical authorship',async()=>{
 const original={creadaPor:'Vendedor histórico',responsableUid:'seller',responsableNombre:'Vendedor actual',responsableRol:'vendedor',responsableRevision:1,creadorOriginalUid:'seller',creadorOriginalNombre:'Vendedor actual'},f=fixture(original),before=clone(f.state.sisventas.ventas.sale),result=await f.prepare('seller');assert.deepEqual(result.record,before);assert.deepEqual(f.state.sisventas.ventas.sale,before);assert.equal(f.calls.find(c=>c.method==='PATCH').auth.uid,'seller');
});

test('nonadmin historical owner receives a clear prerequisite and cannot self-assign through preparation',async()=>{
 const f=fixture({creadaPor:'Vendedor histórico'}),before=clone(f.state.sisventas);await assert.rejects(f.prepare('seller'),e=>e.statusCode===403&&/administrador/.test(e.message));assert.deepEqual(f.state.sisventas,before);assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);
});
