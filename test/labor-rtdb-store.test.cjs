'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const lease={fence:'fence-fixture',opId:'operation-fixture',digest:'a'.repeat(64),expiresAt:2000,actorUid:'user',mode:'command'};
function setup(responses=[]){const calls=[];const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'private-test-token',now:()=>1000,fetchImpl:async(url,options)=>{calls.push({url:new URL(url),options});const data=responses.shift()||{ok:true,value:null};return {ok:data.ok,status:data.status||200,body:{cancel:async()=>{}},json:async()=>data.value};}});return {store,calls};}
test('acquire, commit y abort tienen override fenced; ningún commit usa un GET/PUT raíz Admin',async()=>{
 const f=setup();await f.store.acquire(lease);await f.store.commit({'sisventas/gastos/g':{monto:3},sv_labor_guard:null},lease,{mode:'command',uid:'user',claims:{svAccessVersion:'version'},role:'admin',permissionRevision:5});await f.store.abort(lease);
 assert.deepEqual(f.calls.map(c=>c.options.method),['PUT','PATCH','DELETE']);assert.deepEqual(f.calls.map(c=>c.url.pathname),['/sv_labor_guard.json','/.json','/sv_labor_guard.json']);
 for(const call of f.calls){assert.equal(call.url.searchParams.has('auth'),false);assert.equal(call.options.headers.Authorization,'Bearer private-test-token');assert.ok(call.options.signal);const override=JSON.parse(call.url.searchParams.get('auth_variable_override'));assert.equal(override.uid,'sv-labor-service');assert.equal(override.token.fence,lease.fence);assert.equal(override.token.digest,lease.digest);assert.equal(override.token.actorUid,'user');assert.equal(override.token.svLaborService,true);}
 const actor=JSON.parse(f.calls[1].url.searchParams.get('auth_variable_override'));assert.equal(actor.token.actorRole,'admin');assert.equal(actor.token.actorPermissionRevision,5);assert.equal(actor.token.actorAccessVersion,'version');assert.equal(f.calls[1].url.searchParams.get('print'),'silent');
});
test('gateway conserva UID/claims originales y no acepta valores suplantados para el fence',async()=>{
 const f=setup();const actor={uid:'user',mode:'user',claims:{uid:'user',svAccessVersion:'version',svLaborService:false,mode:'fake',actorUid:'other'}};
 await f.store.commit({},lease,actor);const override=JSON.parse(f.calls[0].url.searchParams.get('auth_variable_override'));assert.equal(override.uid,'user');assert.equal(override.token.svAccessVersion,'version');assert.equal(override.token.svLaborService,true);assert.equal(override.token.mode,'commit');assert.equal(override.token.actorUid,'user');
 await f.store.readAsUser('sisventas/gastos/g',actor);const read=JSON.parse(f.calls[1].url.searchParams.get('auth_variable_override'));assert.equal(read.uid,'user');assert.equal(read.token.mode,'fake');assert.equal(read.token.svLaborService,false);
});
test('sólo lecturas exactas y consultas indexadas separadas; error de commit nunca confirma ni expone credenciales',async()=>{
 const f=setup([{ok:true,value:{monto:1}},{ok:true,value:{}},{ok:false,status:403}]);await f.store.read('sisventas/gastos/g');await f.store.query('sisventas/pagos','ventaFbKey','s');
 assert.equal(f.calls[0].url.pathname,'/sisventas/gastos/g.json');assert.equal(f.calls[1].url.searchParams.get('orderBy'),'"ventaFbKey"');assert.equal(f.calls[1].url.searchParams.get('equalTo'),'"s"');
 await assert.rejects(f.store.commit({},lease,{mode:'server'}),e=>e.code==='SV_LABOR_COMMIT_UNCONFIRMED'&&!e.message.includes('private-test-token'));
});
test('lease ocupado distingue contención con una lectura pequeña, sin leer datos comerciales',async()=>{
 const f=setup([{ok:false,status:403},{ok:true,value:{expiresAt:1500}}]);await assert.rejects(f.store.acquire(lease),{statusCode:423});assert.deepEqual(f.calls.map(c=>c.url.pathname),['/sv_labor_guard.json','/sv_labor_guard.json']);
});
test('fallo de acceso no se presenta como contención ni habilita un commit Admin alternativo',async()=>{
 const f=setup([{ok:false,status:403},{ok:true,value:null}]);await assert.rejects(f.store.acquire(lease),{statusCode:403});assert.equal(f.calls.length,2);
 assert.throws(()=>createLaborRtdbStore({databaseURL:'http://remote.invalid',accessToken:async()=>''}));
});
