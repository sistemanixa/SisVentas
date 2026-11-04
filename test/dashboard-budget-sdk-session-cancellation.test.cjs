'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Reader=require('../js/core/dashboard-budget-sdk-proposal'),Core=require('../js/core/dashboard-activity-model.v2');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const ctx={uid:'u',role:'vendedor',permissionRevision:7,sessionEpoch:1,connectionEpoch:1,connected:true,auth:{currentUser:{uid:'u'}},db:{},timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es',grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:'own'}};
 const header={schema:1,uid:'u',role:'vendedor',profileKey:'profile',profileRole:'vendedor',permissionRevision:7,scope:'u_u',generation:'fictional-generation',revision:1,policyHash:'a'.repeat(64),ready:true,activityReady:true,order:Core.SOURCE_ORDER,timeZone:ctx.timeZone,sourceLocale:ctx.sourceLocale,directCompatible:true,records:50,active:50,converted:0,totalNonCancelled:50,totalDueEligible:50,eventEligible:50,eventExcluded:0};
 const events=Array.from({length:5},(_,i)=>({key:'p'+i,date:'2026-11-04',ms:1793800000000-i,sort:Core.eventSort(1793800000000-i,'p'+i),number:'PP-'+i,client:'Cliente ficticio',status:'pendiente',ownerUid:'u',amountCents:null}));
 const rawSort=s=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i).toString(16).padStart(4,'0')).join('');
 const badge=Array.from({length:50},(_,i)=>{const key='p'+i,dueRaw='2027-01-01';return {sort:rawSort(dueRaw)+'!'+crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex'),value:{key,dueRaw}};}).sort((a,b)=>a.sort.localeCompare(b.sort));
 const calls=[],decoded={header:0,events:0,badge:0};let hook,day=()=> '2026-11-04';
 function snapshot(spec){
  if(spec.path.endsWith('/read/u'))return {val(){decoded.header++;return structuredClone(header);}};
  const kind=spec.path.includes('/document/')?'events':'badge',rows=kind==='events'?events.map(value=>({sort:value.sort,value})):badge.filter(row=>spec.start===undefined||row.sort>=spec.start).slice(0,spec.limit);
  return {forEach(fn){decoded[kind]++;for(const row of rows)fn({key:row.sort,val:()=>structuredClone(row.value)});}};
 }
 const sdk={ref:(_db,path)=>({path}),query:(ref,...parts)=>Object.assign({},ref,...parts),orderByKey:()=>({ordered:true}),limitToFirst:limit=>({limit}),startAt:start=>({start}),async get(spec){calls.push({...spec});const snap=snapshot(spec);return hook?hook(spec,snap):snap;}};
 const readFresh=spec=>sdk.get({path:spec.path,ordered:spec.orderByKey,start:spec.startAt,limit:spec.limitToFirst});
 const reader=Reader.create({readFresh,capture:()=>ctx,valid:()=>ctx.active!==false,getAsOfDay:()=>day(),maxPages:3});
 return {ctx,header,events,calls,decoded,reader,setHook:fn=>{hook=fn;},setDay:fn=>{day=fn;}};
}
test('same-UID login replaces User on same Auth container and retires pending response before decode',async()=>{
 const f=fixture(),entered=deferred(),release=deferred();f.setHook(async(_spec,snap)=>{entered.resolve();await release.promise;return snap;});const pending=f.reader.metrics();await entered.promise;f.ctx.auth.currentUser={uid:'u'};release.resolve();await assert.rejects(pending,{code:'SV_BUDGET_SDK_RETIRED'});assert.equal(f.decoded.header,0);assert.equal(f.calls.length,1);
});
test('host session epoch retires logout/login even if the original User reference returns',async()=>{
 const f=fixture(),entered=deferred(),release=deferred(),user=f.ctx.auth.currentUser;f.setHook(async(_spec,snap)=>{entered.resolve();await release.promise;return snap;});const pending=f.reader.metrics();await entered.promise;f.ctx.auth.currentUser=null;f.ctx.sessionEpoch++;f.ctx.auth.currentUser=user;release.resolve();await assert.rejects(pending,{code:'SV_BUDGET_SDK_RETIRED'});assert.equal(f.decoded.header,0);
});
test('missing or invalid host session epoch fails closed without issuing an SDK get',async()=>{
 for(const epoch of [undefined,null,-1,0.5,'1',NaN]){const f=fixture();f.ctx.sessionEpoch=epoch;await assert.rejects(f.reader.metrics(),{code:'SV_BUDGET_SDK_RETIRED'});assert.equal(f.calls.length,0);}
});
test('failed events retire a badge get already in flight: transport settles but no decode or next page occurs',async()=>{
 const f=fixture(),entered=deferred(),release=deferred();let transportFinished=0;f.events[0].number=123;
 f.setHook(async(spec,snap)=>{if(spec.path.includes('/noticeBadge/')){entered.resolve();await release.promise;transportFinished++;}return snap;});const pending=f.reader.read().then(value=>({value}),error=>({error}));await entered.promise;await tick();release.resolve();const result=await pending;
 assert.match(result.error.message,/Invalid event DTO/);assert.equal(result.value,undefined);assert.equal(transportFinished,1,'The SDK request itself was not cancelled');assert.equal(f.decoded.badge,0);assert.equal(f.calls.filter(s=>s.path.includes('/noticeBadge/')).length,1);assert.equal(f.calls.filter(s=>s.path.endsWith('/read/u')).length,1);
});
test('failed events prevent first badge page when its as-of day is still pending',async()=>{
 const f=fixture(),release=deferred();f.events[0].number=123;f.setDay(()=>release.promise);const pending=f.reader.read().then(value=>({value}),error=>({error}));await tick();release.resolve('2026-11-04');const result=await pending;assert.match(result.error.message,/Invalid event DTO/);assert.equal(result.value,undefined);assert.equal(f.calls.filter(s=>s.path.includes('/noticeBadge/')).length,0);
});
test('badge failure prevents late activity decoding and preserves the original error',async()=>{
 const f=fixture(),entered=deferred(),release=deferred(),denied=Object.assign(Error('Fictitious badge denial'),{code:'PERMISSION_DENIED'});f.setHook(async(spec,snap)=>{if(spec.path.includes('/document/')){entered.resolve();await release.promise;}if(spec.path.includes('/noticeBadge/'))throw denied;return snap;});const pending=f.reader.read().then(value=>({value}),error=>({error}));await entered.promise;await tick();release.resolve();const result=await pending;assert.equal(result.error,denied);assert.equal(result.value,undefined);assert.equal(f.decoded.events,0);
});
test('successful bounded read remains unchanged and a failed read does not cancel another invocation',async()=>{
 const f=fixture(),result=await f.reader.read();assert.equal(result.counts.active,50);assert.equal(result.recent.rows.length,5);assert.equal(result.badge.badgeCount,0);assert.equal(f.calls.length,5);assert(f.calls.filter(s=>s.path.includes('/noticeBadge/')).every(s=>s.limit===50));assert.equal(f.calls.filter(s=>s.path.includes('/document/'))[0].limit,5);
 f.events[0].number=123;await assert.rejects(f.reader.read());assert.equal((await f.reader.metrics()).counts.active,50);
});
test('failure returns before pending sibling transport, and its later rejection stays handled',async()=>{
 const f=fixture(),entered=deferred(),release=deferred(),late=Error('Late SDK rejection');f.events[0].number=123;let outcome,finished=0;
 f.setHook(async(spec,snap)=>{if(spec.path.includes('/noticeBadge/')){entered.resolve();await release.promise;finished++;throw late;}return snap;});
 const pending=f.reader.read().then(value=>{outcome={value};},error=>{outcome={error};});await entered.promise;await tick();
 try{assert.match(outcome?.error?.message||'',/Invalid event DTO/);assert.equal(finished,0);assert.equal((await f.reader.metrics()).counts.active,50,'Independent invocation remains valid while sibling transport is pending');}
 finally{release.resolve();await pending;await tick();}
 assert.equal(finished,1);assert.match(outcome.error.message,/Invalid event DTO/);assert.equal(f.decoded.badge,0);
});
