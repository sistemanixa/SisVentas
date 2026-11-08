'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('./helpers/delete-mounted-source-independent.cjs');
const marker='sv_deployment_attestations/commercial_delete';
for(const operation of ['saleDelete','orderDelete','otDelete']){
 test('mounted '+operation+' captures proof after access, carries reference and replays once',async()=>{
  const f=await F.create(operation);f.setClaims({svCommercialDeleteVersion:1,svCommercialDeleteSignature:'stale-jwt',svCommercialDeleteUnknownFuture:true});await f.run();assert.equal(f.commits.length,1);assert.equal(f.patches.length,1);assert.equal(f.get(f.path),null);assert.equal(f.tokens[0].svCommercialDeleteVersion,1);assert.equal(f.tokens[0].svCommercialDeleteOperation,operation);assert.equal(f.tokens[0].svCommercialDeleteUnknownFuture,null);assert.equal(f.tokens[0].svCommercialDeleteSignature,f.get(marker+'/signature'));
  const capture=f.calls.indexOf('capture:'+operation);assert(capture>f.calls.indexOf('auth'));assert(f.calls.filter(call=>call==='current').length>=2);assert.equal(f.calls.filter(call=>call==='commit').length,1);
  await f.run();assert.equal(f.commits.length,1);assert.equal(f.patches.length,1);
 });
 test('mounted '+operation+' rejects runtime read-only revocation after capture',async()=>{
  const f=await F.create(operation),before=structuredClone(f.state.sisventas);f.setCaptureHook(proof=>{f.runtime.readOnly=true;return proof;});await assert.rejects(f.run());assert.equal(f.commits.length,0);assert.equal(f.patches.length,0);assert.deepEqual(f.state.sisventas,before);
 });
 for(const boundary of ['capture','guard','final','transport'])test('mounted '+operation+' rejects marker revocation at '+boundary,async()=>{
  const f=await F.create(operation),before=structuredClone(f.state.sisventas),revoke=()=>F.apply(f.state,{[marker]:null});
  if(boundary==='capture')f.setCaptureHook(proof=>{revoke();return proof;});if(boundary==='guard')f.setCurrentHook(count=>{if(count===1)revoke();});if(boundary==='final')f.setCurrentHook(count=>{if(count===2)revoke();});if(boundary==='transport')f.setCommitHook(revoke);
  await assert.rejects(f.run());assert.equal(f.commits.length,0);assert.equal(f.patches.length,0);assert.deepEqual(f.state.sisventas,before);
 });
 for(const kind of ['clone','other-instance','identity','auth'])test('mounted '+operation+' rejects '+kind+' after capture',async()=>{
  const f=await F.create(operation),before=structuredClone(f.state.sisventas);
  if(kind==='clone')f.setCaptureHook(proof=>({...proof}));
  if(kind==='other-instance'){const other=await F.create(operation);f.setCaptureHook(()=>other.readiness.capture(operation));}
  if(kind==='identity')f.setCaptureHook(proof=>{f.changeIdentity();return proof;});if(kind==='auth')f.setCaptureHook(proof=>{f.revokeAuth();return proof;});
  await assert.rejects(f.run());assert.equal(f.commits.length,0);assert.equal(f.patches.length,0);assert.deepEqual(f.state.sisventas,before);
 });
}
test('actual labor runtime always installs default-OFF readiness and exposes no legacy fence',async()=>{
 let reads=0;const runtime=F.fromSource('cotizador/labor-runtime.js').createLaborRuntime({db:{ref(){throw Error('No SDK read');}},databaseURL:'https://fixture.invalid',accessToken:async()=>'FICTIONAL',enabled:true,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true,dashboardBudgets:false,dashboardActivity:false,dashboardPolicyRenewal:false,deleteEnvironment:{},deliveryEnvironment:{},fetchImpl:async()=>{reads++;throw Error('No request expected');}});
 assert(runtime.store.commercialDeleteReadiness);assert.equal(runtime.store.commercialDeleteReadiness.configured,false);assert.equal(await runtime.store.commercialDeleteReadiness.available(),false);
 for(const key of ['saleDeleteFenceReady','saleDeleteActivityFenceReady','operationalFenceReady','otDeleteFenceReady'])assert.equal(runtime.store[key],false,key);
 let authCalls=0;const authorize=async()=>{authCalls++;throw Error('No authorization expected while OFF');};
 const sale=F.fromSource('cotizador/sale-delete-http-adapter.js').createSaleDeleteHttpAdapter({authorize,store:runtime.store,guard:runtime.guard,enabled:true});
 const order=F.fromSource('cotizador/purchase-order-delete.js').createPurchaseOrderDelete({authorize,store:runtime.store,guard:runtime.guard,enabled:true});
 const ot=F.fromSource('cotizador/ot-delete-http-adapter.js').createOTDeleteHttpAdapter({authorize,store:runtime.store,guard:runtime.guard,enabled:true});
 for(const [service,route,field]of [[sale,'/comerciales/ventas/eliminar','ventaKey'],[order,'/compras/ordenes/eliminar','orderKey'],[ot,'/operaciones/ot/eliminar','otKey']]){assert.equal(service.capability(),false);await assert.rejects(service.handle({method:'POST',url:route},{id:'off-real-runtime',expectedHash:'a'.repeat(64),[field]:'s'}));}
 assert.equal(authCalls,0);
 await assert.rejects(runtime.store.commercialDeleteReadiness.capture('saleDelete'));assert.equal(reads,0);
});
test('actual REST store neutralizes all inherited deletion JWT claims without a provider',async()=>{
 let token;const store=F.fromSource('cotizador/labor-rtdb-store.js').createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'FICTIONAL',fetchImpl:async(input,init)=>{assert.equal(init.method,'PATCH');token=JSON.parse(new URL(input).searchParams.get('auth_variable_override')).token;return {ok:true,status:200,body:{cancel:async()=>{}}};}});
 await store.commit({'sisventas/gastos/ordinary':{monto:1}},{actorUid:'u',fence:'fence-fixture',opId:'ordinary-fixture',digest:'a'.repeat(64)},{uid:'u',mode:'user',claims:{uid:'u',svCommercialDeleteVersion:1,svCommercialDeleteSignature:'stale',svCommercialDeleteUnknown:true}});
 assert.equal(token.svCommercialDeleteVersion,0);assert.equal(token.svCommercialDeleteSignature,null);assert.equal(token.svCommercialDeleteUnknown,null);
});
test('source bytes used by independent mounted checks remained stable',()=>{assert.deepEqual(F.currentHashes(),F.initialHashes);console.log(JSON.stringify({sourceRoot:F.sourceRoot,sourceHashes:F.initialHashes}));});
