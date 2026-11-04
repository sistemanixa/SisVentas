'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.TZ='America/Argentina/Buenos_Aires';
const Reader=require('../cotizador/dashboard-budget-activity-reader-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Model=require('../cotizador/dashboard-budget-projection-proposal'),Core=require('../js/core/dashboard-activity-model.v2');
const {budget,authFixture,request,traceDb}=require('./helpers/dashboard-budget-reader-fixture.cjs'),{activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{createBackend}=require('./helpers/labor-ui-flow.cjs');
const req=extra=>request({url:Reader.ROUTE,...extra});
function fixture(records,{actorUid='u',onRead,getLegacyContext}={}){const backend=createBackend();Object.assign(backend.state,activitySeed(records));const auth=authFixture(actorUid),traced=traceDb(memoryDb(backend.state),{onRead}),reader=Reader.createActivityReader({auth,db:traced.db,enabled:true,getAsOfDay:()=> '2026-11-04',...(getLegacyContext?{getLegacyContext}:{})});return {...backend,auth,reader,reads:traced.reads};}
async function mutate(f,patch,id='activity-fixture-commit'){
 await f.guard.run({uid:'u',claims:{uid:'u'},role:'admin',mode:'user',operation:'activity-fixture',opId:id,input:patch},async scope=>{await scope.update(patch);const plan=await Index.plan({patch,raw:p=>f.store.read(p),get:p=>scope.get(p),generation:f.get(Index.ROOT+'/coverage/generation'),revision:f.get(Index.ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});await scope.update(plan.patch);return {ok:true,committed:true};});
}
test('62 source records recover the highest legacy instant omitted by the old sixty-window without switching to document dates',async()=>{
 const records={hot:budget({id:'PP-0001',fecha:'2000-01-01',ts:10000})};for(let i=0;i<61;i++)records['old'+i]=budget({id:'PP-'+String(100+i).padStart(4,'0'),fecha:'2026-11-04',ts:100+i});
 const f=fixture(records),result=await f.reader.read(req());assert.equal(result.recent.rows[0].key,'hot');assert.equal(result.recent.rows[0].date,'2000-01-01');assert.equal(result.recent.rows[0].ms,10000);assert.equal(result.counts.active,62);assert.equal(result.recent.order,Core.SOURCE_ORDER);assert.equal(f.get(Index.ROOT+'/coverage/documentOrder'),Core.SOURCE_ORDER);
 const context={uid:'u',role:'vendedor',auth:{},db:{},permissionRevision:7,timeZone:result.recent.timeZone,sourceLocale:result.recent.sourceLocale,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:'own'}},prefix=Core.budgetPrefix({result,captured:{...context},context}),merged=Core.merge({context,sources:{presupuestos:prefix},expected:{presupuestos:{generation:result.generation,revision:result.revision}}});assert.equal(merged.complete,true);assert.equal(merged.items[0].key,'hot');
});
test('5051 records yield bounded own/admin instant prefixes, source ties and metadata-only KPI/badge',async()=>{
 const records=Object.fromEntries(Array.from({length:5051},(_,i)=>['p'+i,budget({id:'PP-FICTICIO',vence:i<5001?'2020-01-01':'2027-01-01',ts:i+1})]));records.foreign=budget({responsableUid:'v',ts:999999});const f=fixture(records),own=await f.reader.read(req());assert.equal(own.recent.rows[0].key,'p5050');assert.equal(own.recent.rows.length,5);assert.equal(own.counts.active,5051);assert.equal(own.badge.badgeCount,5001);assert.equal(f.reads.filter(r=>r.path.includes('/document/')).length,1);assert.equal(f.reads.filter(r=>r.path.includes('/noticeBadge/')).length,2);assert(!JSON.stringify(own).includes('NEVER_TRANSPORT'));
 const traced=traceDb(memoryDb(f.state)),admin=Reader.createActivityReader({auth:authFixture('a'),db:traced.db,enabled:true,getAsOfDay:()=> '2026-11-04'}),all=await admin.read(req());assert.equal(all.recent.rows[0].key,'foreign');assert.equal(all.counts.active,5052);
});
test('known zero/NaN legacy instants are excluded without turning nonempty KPI into zero; truthy Infinity fails closed',async()=>{
 const f=fixture({zero:budget({ts:'0'}),bad:budget({ts:'bad'}),unknown:budget({ts:0,fecha:'unknown'})}),result=await f.reader.read(req());assert.equal(result.recent.rows.length,0);assert.equal(result.recent.exhausted,true);assert.equal(result.counts.active,3);assert.equal(f.get(Index.ROOT+'/stats/u_u/eventExcluded'),3);assert.throws(()=>fixture({unsupported:budget({ts:'Infinity'})}),/nonfinite/);
});
test('label/state edits preserve key ties; sort/create/delete/reassignment maintain certified activity',async()=>{
 const f=fixture(),before=await f.reader.read(req());await mutate(f,{'sisventas/presupuestos/p/estado':'convertido'});const after=await f.reader.read(req());assert.equal(after.recent.rows[0].sort,before.recent.rows[0].sort);assert.equal(after.recent.rows[0].ms,before.recent.rows[0].ms);assert.equal(after.recent.rows[0].status,'convertido');assert.equal(after.counts.converted,1);assert.equal(after.badge.badgeCount,0);
 for(const patch of [{'sisventas/presupuestos/p/fecha':'2000-01-01'},{'sisventas/presupuestos/new':budget()},{'sisventas/presupuestos/p':null},{'sisventas/presupuestos/p/responsableUid':'v'}]){const local=fixture();await mutate(local,patch);assert.equal(local.get(Index.ROOT+'/coverage/ready'),true);assert.equal(local.get(Index.ROOT+'/coverage/activityReady'),true);assert.equal(local.get(Index.ROOT+'/coverage/requiresActivityReconciliation'),false);await local.reader.read(req());}
});
test('missing metadata, different timezone/locale, source ordinal corruption and permission drift never certify activity',async()=>{
 for(const edit of [f=>{delete f.state.sv_dashboard_budget_proposal.v1.coverage.activityReady;},f=>{delete f.state.sv_dashboard_budget_proposal.v1.stats.u_u.eventEligible;},f=>{Object.values(f.state.sv_dashboard_budget_proposal.v1.document.u_u)[0].sourceOrdinal=9;},f=>{Object.values(f.state.sv_dashboard_budget_proposal.v1.document.u_u)[0].items=[{private:true}];},f=>{f.state.sv_dashboard_budget_proposal.v1.coverage.activitySourceLocale='other';}]){const f=fixture();edit(f);await assert.rejects(f.reader.read(req()));}
 const wrongZone=fixture(undefined,{getLegacyContext:()=>({timeZone:'UTC',sourceLocale:Intl.Collator().resolvedOptions().locale})});await assert.rejects(wrongZone.reader.read(req()),/timezone|metadata/);
 let f;f=fixture(undefined,{onRead:({path})=>{if(path.includes('/document/'))f.state.sv_permisos.vendedor.indiceRevision++;}});await assert.rejects(f.reader.read(req()));
 const badScope=fixture();await assert.rejects(badScope.reader.read(req({url:Reader.ROUTE+'?scope=all'})));assert.equal(badScope.reads.length,0);
});

test('a UTC reader/writer can preserve precomputed BA instants without parsing dates or changing the certified context',async()=>{
 const f=fixture(),legacy=Reader.runtimeContext(),before=await f.reader.read(req()),previous=process.env.TZ;
 try{process.env.TZ='UTC';const traced=traceDb(memoryDb(f.state)),reader=Reader.createActivityReader({auth:f.auth,db:traced.db,enabled:true,getAsOfDay:()=> '2026-11-04',getLegacyContext:()=>legacy});assert.equal((await reader.read(req())).recent.rows[0].ms,before.recent.rows[0].ms);await mutate(f,{'sisventas/presupuestos/p/estado':'convertido'},'activity-utc-label');assert.equal((await reader.read(req())).recent.rows[0].ms,before.recent.rows[0].ms);}
 finally{process.env.TZ=previous;}
});
