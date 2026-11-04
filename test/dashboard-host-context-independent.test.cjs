'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Context=require('../js/core/dashboard-host-context-proposal'),Aggregate=require('../js/core/dashboard-activity-aggregate-proposal'),Source=require('../js/core/dashboard-budget-source-proposal');
const text=fs.readFileSync(require.resolve('./dashboard-host-context.test.cjs'),'utf8');
const fixture=new Function('Context','fs','vm',text.slice(text.indexOf('function fixture()'),text.indexOf("test('capture uses"))+'\nreturn fixture;')(Context,fs,vm);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function source(f,read){return Source.create({capture:f.api.capture,valid:f.api.valid,readiness:f.r.SVDataReadiness,read});}
function payload(){return {uid:'u',role:'admin',permissionRevision:7,generation:'independent-fixture',revision:1,counts:{active:1,converted:0,totalNonCancelled:1,conversionPercent:0}};}

test('actual engine reset retires a ready Source even with identical User and session',async()=>{
 const f=fixture(),user=f.r.fbAuth.currentUser;let reads=0;const s=source(f,async()=>{reads++;return payload();});
 const old=await s.ensure(),before=f.api.capture();f.r.SVDataReadiness.reset();assert.equal(s.peek().data,null);
 assert.equal(f.r.SVDataReadiness.status(['dashboardBudgets']).ready,false);assert.notEqual(await s.ensure(),old);assert.equal(reads,2);
 assert.equal(f.r.fbAuth.currentUser,user);assert.equal(f.api.capture().sessionEpoch,before.sessionEpoch);
});

test('actual Aggregate port retires its pending response on engine reset with same User',async()=>{
 const f=fixture(),d=deferred(),ctx=Aggregate.snapshot(f.api.capture()),user=f.r.fbAuth.currentUser;
 const port=Aggregate.port({capture:f.api.capture,valid:f.api.valid,read:()=>d.promise}),pending=port.read({schema:1,context:ctx});
 f.r.SVDataReadiness.reset();d.resolve({old:true});await assert.rejects(pending,{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(f.r.fbAuth.currentUser,user);
});

for(const change of ['grant','signature','session'])test('authority change '+change+' retires Source and Aggregate without granting cached access',async()=>{
 const f=fixture(),s=source(f,async()=>payload());await s.ensure();const ctx=Aggregate.snapshot(f.api.capture());
 if(change==='grant'){f.modules.delete('agenda');}else if(change==='signature'){f.r.PERMISOS_ROLES.admin.extra=false;}else f.r._svOperacionesSesionEpoch=1;
 assert.equal(f.api.valid(ctx),false);assert.equal(s.peek().data,null);let calls=0;
 const p=Aggregate.port({capture:f.api.capture,valid:f.api.valid,read:async()=>{calls++;return payload();}});
 await assert.rejects(p.read({schema:1,context:ctx}),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});assert.equal(calls,0);
 if(change==='grant'){
  assert.equal(f.api.capture().grants.ordenes_trabajo,null);
  const ports=Object.fromEntries(['budget','commercial','month'].map(k=>[k,{read:async()=>{calls++;throw Error('No call allowed');}}]));
  await assert.rejects(Aggregate.create({enabled:true,capture:f.api.capture,valid:f.api.valid,ports}).read(),/not authorized/);assert.equal(calls,0);
 }
});

test('network preserves authority and Source data but retires an Aggregate transport response',async()=>{
 const f=fixture(),s=source(f,async()=>payload()),old=await s.ensure(),ctx=Aggregate.snapshot(f.api.capture()),d=deferred();
 const p=Aggregate.port({capture:f.api.capture,valid:f.api.valid,read:()=>d.promise}),pending=p.read({schema:1,context:ctx});
 f.r.fbOnline=false;f.r.navigator.onLine=false;f.r.emit('offline');
 assert(f.api.valid(ctx));assert.equal(s.peek().data,old);d.resolve({old:true});await assert.rejects(pending,e=>['SV_ACTIVITY_CONTEXT_RETIRED','SV_ACTIVITY_AGGREGATE_INCOMPLETE'].includes(e.code));
 f.r.fbOnline=true;f.r.navigator.onLine=true;f.r.emit('online');assert(f.api.valid(ctx));assert.equal(s.peek().data,old);
 assert.notEqual(f.api.capture().connectionEpoch,ctx.connectionEpoch);
});

test('unknown or stale raw metadata selects authorized server without broadening grants',()=>{
 const f=fixture();for(const provenance of [undefined,{admin:{revision:6,present:false}},{admin:{revision:7}},{admin:{revision:7,present:true}}]){
  f.r._svDashboardRawBlockedPresence=provenance;assert.equal(f.api.decision().kind,'authorized-server');
 }
 f.r._svDashboardRawBlockedPresence={admin:{revision:7,present:false}};assert.equal(f.api.decision().kind,'direct-rtdb');
 f.modules.delete('dashboard');assert.equal(f.api.decision().kind,'denied');assert(Object.values(f.api.capture().grants).every(v=>v===null));
});

test('replacing readiness engine at same generation cannot reuse Source or aggregate authority',async()=>{
 const f=fixture(),s=source(f,async()=>payload());await s.ensure();const c=f.api.capture();
 f.r.SVDataReadiness={...f.r.SVDataReadiness,snapshotEpoch:()=>c.dataEpoch};
 assert.equal(f.api.capture().allowed,false);assert.equal(s.peek().data,null);assert.equal(f.api.valid(c),false);
 await assert.rejects(s.ensure(),{code:'SV_BUDGET_SOURCE_RETIRED'});
});
