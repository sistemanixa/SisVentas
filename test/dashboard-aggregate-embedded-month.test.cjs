'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../js/core/dashboard-activity-aggregate-proposal'),HTTP=require('../js/core/dashboard-http-ports-proposal'),DATA=require('./fixtures/dashboard-http-readers-e24.json');
const {fixture}=require('./helpers/dashboard-activity-aggregate-fixture.cjs'),SDK=require('../js/core/dashboard-budget-sdk-proposal'),DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),ROOT=require('../cotizador/dashboard-budget-incremental-plan-proposal').ROOT;
const B=HTTP.ROUTES.presupuestos,base='https://embedded-month.fixture.invalid';
function httpFixture(){
 const ctx={...structuredClone(DATA.context),auth:{},db:{}},responses=structuredClone(DATA.responses),calls=[],operations=[],host={SISVENTAS_FUNCTIONS:{cotizadorProveedor:base}};ctx.auth.currentUser={uid:ctx.uid,getIdToken:async()=> 'fixture-token'};let hook;
 const client=HTTP.create({enabled:true,host,baseURL:base,capture:()=>ctx,valid:()=>true,fetchImpl:async(url,spec)=>{const p=new URL(url).pathname;assert.equal(new URL(url).origin,base);assert.equal(spec.method,'GET');assert.equal(spec.cache,'no-store');assert(!p.includes('avisos'));calls.push(p);if(hook)await hook(p);return new Response(JSON.stringify(responses[p]));}}),ports=Object.fromEntries(Object.entries(client.ports).map(([kind,port])=>[kind,{async read(q){operations.push(kind+(q.domain?':'+q.domain:''));return port.read(q);}}]));
 return {ctx,responses,calls,operations,ports,hook:fn=>{hook=fn;},read:()=>A.create({enabled:true,capture:()=>ctx,valid:()=>true,ports,requireNotices:false}).read()};
}
test('actual HTTP ports use five GETs B0/commercial/B1 and reuse both verified monthly values',async()=>{
 const f=httpFixture(),r=await f.read();assert.equal(r.activity.complete,true);assert.deepEqual(f.calls,[B,HTTP.ROUTES.ventas,HTTP.ROUTES.pagos,HTTP.ROUTES.ordenes_trabajo,B]);assert.deepEqual(f.operations,['budget','commercial:ventas','commercial:pagos','commercial:ordenes_trabajo','budget']);assert.deepEqual(r.monthly,f.responses[B].monthly);assert.equal(r.notices,null);assert.equal(r.originalCollectionComplete,false);
});
async function sdkFixture(){
 const f=await fixture(15),tree=f.read(ROOT),views=DTO.projectReadViews({tree,users:f.read('sv_usuarios'),identities:f.read('sv_chat_roles'),permissions:f.read('sv_permisos')});f.apply(views.patch);
 const direct=SDK.create({capture:f.capture,valid:f.valid,getAsOfDay:()=>f.ctx.asOfDay,readFresh:async spec=>{let ref=f.db.ref(spec.path);if(spec.orderByKey)ref=ref.orderByKey();if(spec.limitToFirst)ref=ref.limitToFirst(spec.limitToFirst);if(spec.startAt!==undefined)ref=ref.startAt(spec.startAt);return ref.get();}}),operations=[],original={...f.ports,budget:A.port({capture:f.capture,valid:f.valid,read:()=>direct.read()})};
 const ports=Object.fromEntries(Object.entries(original).map(([kind,port])=>[kind,{async read(q){operations.push(kind+(q.domain?':'+q.domain:''));return port.read(q);}}]));
 return {...f,operations,ports,create:()=>A.create({enabled:true,capture:f.capture,valid:f.valid,ports,requireNotices:false})};
}
test('actual SDK without monthly keeps seven typed reads and strict M1 before B1 order',async()=>{
 const f=await sdkFixture(),r=await f.create().read();assert(r.activity.complete);assert(r.monthly.complete);assert.deepEqual(f.operations,['budget','month','commercial:ventas','commercial:pagos','commercial:ordenes_trabajo','month','budget']);assert(f.trace.every(x=>!x.path.startsWith('sisventas/')));
});
test('old SDK separate month disagreement still rejects, with both monthly reads executed',async()=>{
 const f=await sdkFixture(),original=f.ports.month;let reads=0;f.ports.month={async read(q){const result=await original.read(q);if(++reads===2){result.value.records++;result.value.conversionPercent=Math.round(100*result.value.converted/result.value.records);}return result;}};await assert.rejects(f.create().read(),/Monthly metric/);assert.equal(reads,2);assert.equal(f.operations.at(-1),'budget');
});
test('old SDK swapped commercial domain still rejects after M0 and before M1/B1',async()=>{
 const f=await sdkFixture(),original=f.ports.commercial;f.ports.commercial={async read(q){const r=await original.read(q);if(q.domain==='ventas')r.value.recent.domain='pagos';return r;}};await assert.rejects(f.create().read(),/Unexpected commercial domain/);assert.equal(f.operations.filter(k=>k==='month').length,1);assert.equal(f.operations.filter(k=>k==='budget').length,1);
});
const corrupt={null:()=>null,undefined:()=>undefined,uid:m=>({...m,uid:'v'}),role:m=>({...m,role:'admin'}),permission:m=>({...m,permissionRevision:8}),generation:m=>({...m,generation:'other'}),revision:m=>({...m,revision:m.revision+1}),scope:m=>({...m,scope:'all'}),month:m=>({...m,month:'2026-12'}),label:m=>({...m,employeeLabel:'other'}),policy:m=>({...m,policyHash:'bad'}),records:m=>({...m,records:-1}),converted:m=>({...m,converted:m.records+1}),percent:m=>({...m,conversionPercent:999}),complete:m=>({...m,complete:false}),bucket:m=>({...m,bucketRevision:m.revision+1}),absence:m=>({...m,absenceCertified:true})};
for(const [name,edit]of Object.entries(corrupt))test('present invalid B0 monthly rejects without fallback: '+name,async()=>{
 const f=httpFixture(),original=f.ports.budget;f.ports.budget={async read(q){const r=await original.read(q);r.value.monthly=edit(r.value.monthly);return r;}};await assert.rejects(f.read(),/Monthly metric|Missing source revision/);assert.equal(f.calls.length,1);assert.deepEqual(f.operations,['budget']);
});
for(const kind of ['missing','policy','records'])test('B1 embedded monthly '+kind+' is rejected without any separate month request',async()=>{
 const f=httpFixture(),original=f.ports.budget;let n=0;f.ports.budget={async read(q){const r=await original.read(q);if(++n===2){if(kind==='missing')delete r.value.monthly;if(kind==='policy')r.value.monthly.policyHash='a'.repeat(64);if(kind==='records'){r.value.monthly.records++;r.value.monthly.conversionPercent=Math.round(100*r.value.monthly.converted/r.value.monthly.records);}}return r;}};await assert.rejects(f.read(),/Monthly metric|Budget changed/);assert.equal(f.calls.length,5);assert(!f.operations.includes('month'));
});
for(const field of ['dataEpoch','sessionEpoch','permissionSignature','connectionEpoch','user','grants'])test('authority change during embedded commercial interval rejects: '+field,async()=>{
 const f=httpFixture();let changed=false;f.hook(p=>{if(p===HTTP.ROUTES.ventas&&!changed){changed=true;if(field==='user')f.ctx.auth.currentUser={...f.ctx.auth.currentUser};else if(field==='grants')f.ctx.grants={...f.ctx.grants,presupuestos:'all'};else if(field==='permissionSignature')f.ctx.permissionSignature='changed';else f.ctx[field]++;}});await assert.rejects(f.read(),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert(changed);assert(!f.operations.includes('month'));assert.equal(f.calls.filter(p=>p===B).length,1);
});
test('read-local bracket values never cache across a new aggregate capture',async()=>{
 const f=httpFixture();await f.read();f.ctx.dataEpoch++;const r=await f.read();assert.equal(r.dataEpoch,f.ctx.dataEpoch);assert.equal(f.calls.length,10);assert.equal(f.operations.filter(k=>k==='budget').length,4);
});
