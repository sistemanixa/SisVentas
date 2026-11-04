'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),Reader=require('../js/core/dashboard-budget-sdk-proposal'),Fresh=require('../js/core/dashboard-budget-fresh-rtdb-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget}=require('./helpers/dashboard-budget-reader-fixture.cjs');
function fixture(records,options={}){
 const state=activitySeed(records),tree=state.sv_dashboard_budget_proposal.v1;
 tree.read=Object.fromEntries(Object.entries(DTO.projectReadViews({tree,users:state.sv_usuarios,identities:state.sv_chat_roles,permissions:state.sv_permisos}).patch).map(([p,v])=>[p.split('/').at(-1),v]));
 const auth={currentUser:{uid:'u',getIdToken:async()=> 'fictitious-token'}},ctx={uid:'u',role:'vendedor',permissionRevision:7,sessionEpoch:1,connectionEpoch:1,connected:true,auth,db:{},timeZone:tree.coverage.activityTimeZone,sourceLocale:tree.coverage.activitySourceLocale,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:'own'}},calls=[],memory=memoryDb(state);let hook;
 const readFresh=Fresh.create({databaseURL:'https://fiction-default-rtdb.firebaseio.com',expectedOrigin:'https://fiction-default-rtdb.firebaseio.com',auth,fetchImpl:async(url,init)=>{
  const u=new URL(url),path=decodeURIComponent(u.pathname.slice(1,-5)),query=u.searchParams;assert(path.startsWith(Index.ROOT+'/'));assert.equal(init.cache,'no-store');calls.push({path,query:Object.fromEntries([...query].filter(([k])=>k!=='auth'))});let ref=memory.ref(path);if(query.has('orderBy'))ref=ref.orderByKey();if(query.has('startAt'))ref=ref.startAt(JSON.parse(query.get('startAt')));if(query.has('limitToFirst'))ref=ref.limitToFirst(Number(query.get('limitToFirst')));const value=(await ref.get()).val();if(hook)await hook(path);return {ok:true,json:async()=>value};
 }});
 const reader=Reader.create({readFresh,capture:()=>ctx,valid:()=>true,getAsOfDay:()=> '2026-11-04',maxPages:options.maxPages||100});return {state,tree,ctx,calls,reader,setHook:fn=>{hook=fn;}};
}
test('direct notices use only bounded fresh subset requests and preserve minimal own rows',async()=>{
 const records=Object.fromEntries(Array.from({length:101},(_,i)=>['p'+i,budget()]));records.foreign=budget({responsableUid:'v'});records.done=budget({estado:'convertido'});const f=fixture(records),result=await f.reader.notices();assert.equal(result.notices.rows.length,101);assert.equal(result.notices.complete,true);assert.equal(result.recent,undefined);assert.equal(result.badge,undefined);assert(!JSON.stringify(result).includes('NEVER_TRANSPORT'));assert(!JSON.stringify(result).includes('sourceHash'));assert.equal(f.calls.filter(c=>c.path.includes('/noticeCandidates/')).length,3);assert(f.calls.filter(c=>c.path.includes('/noticeCandidates/')).every(c=>c.query.limitToFirst==='50'));assert(f.calls.every(c=>/\/(?:read|stats|noticeCandidates)\//.test(c.path)));
});
test('ordinary dashboard metrics and activity do not implicitly download the notice center',async()=>{
 const f=fixture();await f.reader.metrics();await f.reader.read();assert(!f.calls.some(c=>c.path.includes('/noticeCandidates/')||c.path.endsWith('/noticeEligible')));
});
test('missing, contradictory count and wrong owner fail instead of certifying an empty or foreign center',async()=>{
 for(const edit of [t=>{delete t.stats.u_u.noticeEligible;},t=>{t.stats.u_u.noticeEligible=0;},t=>{t.noticeCandidates.u_u[Index.noticeSort('p')].ownerUid='v';},t=>{delete t.noticeCandidates.u_u;}]){const f=fixture();edit(f.tree);await assert.rejects(f.reader.notices());}
 const empty=fixture({foreign:budget({responsableUid:'v'})});assert.deepEqual((await empty.reader.notices()).notices.rows,[]);
});
test('retired session, changed revision and exhausted page budget never publish partial notice data',async()=>{
 for(const change of [f=>{f.ctx.sessionEpoch++;},f=>{f.tree.read.u.revision++;}]){const f=fixture();let once=false;f.setHook(path=>{if(!once&&path.includes('/noticeCandidates/')){once=true;change(f);}});await assert.rejects(f.reader.notices());}
 const records=Object.fromEntries(Array.from({length:50},(_,i)=>['p'+i,budget()])),f=fixture(records,{maxPages:1});await assert.rejects(f.reader.notices(),/Incomplete notice index/);
});
test('typed fresh paths reject whole stats roots, arbitrary cursors and unbounded notice queries before fetch',async()=>{
 const auth={currentUser:{uid:'u',getIdToken:async()=>assert.fail('Invalid path must not obtain token')}},read=Fresh.create({databaseURL:'https://fiction-default-rtdb.firebaseio.com',expectedOrigin:'https://fiction-default-rtdb.firebaseio.com',auth,fetchImpl:()=>assert.fail('Invalid query must not fetch')});
 for(const spec of [{path:Index.ROOT+'/stats/u_u'},{path:Index.ROOT+'/noticeCandidates/u_u'},{path:Index.ROOT+'/noticeCandidates/u_u',orderByKey:true,limitToFirst:51},{path:Index.ROOT+'/noticeCandidates/u_u',orderByKey:true,limitToFirst:50,startAt:'../private'}])await assert.rejects(read(spec));
});
