'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Reader=require('../cotizador/dashboard-budget-notice-candidates-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Model=require('../cotizador/dashboard-budget-projection-proposal');
const {seed,budget,authFixture,request}=require('./helpers/dashboard-budget-reader-fixture.cjs'),{memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs'),{createLaborGuard}=require('../cotizador/labor-guard');
function fixture(records,options={}){
 const f=createBackend();Object.assign(f.state,seed(records));const auth=authFixture(options.uid||'u'),memory=memoryDb(f.state),calls=[];let hook;
 function wrap(ref,path,query={}){return {orderByChild:v=>wrap(ref.orderByChild(v),path,{...query,field:v}),equalTo:v=>wrap(ref.equalTo(v),path,{...query,equal:v}),orderByKey:()=>wrap(ref.orderByKey(),path,{...query,ordered:true}),startAt:v=>wrap(ref.startAt(v),path,{...query,start:v}),limitToFirst:v=>wrap(ref.limitToFirst(v),path,{...query,limit:v}),async get(){assert(!path.startsWith('sisventas/'),'No original business reads');const snapshot=await ref.get();calls.push({path,...query});if(hook)await hook(path,snapshot);return snapshot;}};}
 const reader=Reader.create({auth,db:{ref:path=>wrap(memory.ref(path),path)},enabled:options.enabled!==false,maxPages:options.maxPages||100});
 const guard=createLaborGuard({store:f.store,delay:async()=>{}});let seq=0;
 async function mutate(patch){return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'notice-test',opId:'notice-test-'+(++seq),input:patch},async scope=>{await scope.update(patch);const p=await Index.plan({patch,raw:path=>f.store.read(path),get:path=>scope.get(path),generation:f.get(Index.ROOT+'/coverage/generation'),revision:f.get(Index.ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});await scope.update(p.patch);return {ok:true};});}
 return {...f,calls,reader,auth,mutate,read:()=>reader.read(request({url:Reader.ROUTE})),setHook:fn=>{hook=fn;}};
}
test('notice subset has bounded pages, complete own counts, no full originals or private payloads',async()=>{
 const records=Object.fromEntries(Array.from({length:101},(_,i)=>['p'+String(i).padStart(3,'0'),budget()]));records.foreign=budget({responsableUid:'v'});records.converted=budget({estado:'convertido'});records.cancelled=budget({anulado:true});
 const f=fixture(records),before=structuredClone(f.state.sisventas),result=await f.read();assert.equal(result.rows.length,101);assert(result.complete);assert.equal(result.scope,'own');const pages=f.calls.filter(c=>c.path.includes('/noticeCandidates/'));assert.equal(pages.length,3);assert(pages.every(c=>c.limit===50&&c.ordered));assert.equal(new Set(result.rows.map(r=>r.key)).size,101);assert(!JSON.stringify(result).includes('NEVER_TRANSPORT'));assert(!JSON.stringify(result).includes('sourceHash'));assert.deepEqual(f.state.sisventas,before);
});
test('disabled, query parameters, stale legacy schema and incomplete index never become empty success',async()=>{
 const disabled=fixture(undefined,{enabled:false});await assert.rejects(disabled.read());assert.equal(disabled.auth.calls.length,0);
 const f=fixture();await assert.rejects(f.reader.read(request({url:Reader.ROUTE+'?scope=all'})));assert.equal(f.auth.calls.length,0);
 for(const edit of [f=>{delete f.state.sv_dashboard_budget_proposal.v1.coverage.noticeCandidateSchema;},f=>{delete f.state.sv_dashboard_budget_proposal.v1.noticeCandidates.u_u[Index.noticeSort('p')];},f=>{delete f.state.sv_dashboard_budget_proposal.v1.stats.u_u.noticeEligible;}]){const local=fixture();edit(local);await assert.rejects(local.read());}
});
test('each candidate is checked against current scope and a fixed minimal DTO',async()=>{
 for(const edit of [r=>{r.ownerUid='v';},r=>{r.privateCosts=[999];},r=>{r.reason={private:'never'};},r=>{r.ts={private:'never'};}]){const f=fixture();edit(f.state.sv_dashboard_budget_proposal.v1.noticeCandidates.u_u[Index.noticeSort('p')]);await assert.rejects(f.read());}
 const admin=fixture({own:budget(),foreign:budget({responsableUid:'v'})},{uid:'a'});assert.equal((await admin.read()).rows.length,2);
});
test('metadata drift, permission revocation and pagination budget exhaustion retire the whole result',async()=>{
 for(const edit of [f=>{f.state.sv_dashboard_budget_proposal.v1.coverage.revision++;},f=>{f.state.sv_permisos.vendedor.indiceModulos.presupuesto=false;}]){const f=fixture();let done=false;f.setHook(path=>{if(!done&&path.includes('/noticeCandidates/')){done=true;edit(f);}});await assert.rejects(f.read());}
 const records=Object.fromEntries(Array.from({length:50},(_,i)=>['p'+i,budget()])),f=fixture(records,{maxPages:1});await assert.rejects(f.read(),/Incomplete notice index/);
});
test('empty certified scope and pruned null scalars are explicit valid states',async()=>{
 const empty=fixture({foreign:budget({responsableUid:'v'})});assert.deepEqual((await empty.read()).rows,[]);
 const f=fixture({p:budget({vence:'',total:'not money',ts:null})}),row=f.state.sv_dashboard_budget_proposal.v1.noticeCandidates.u_u[Index.noticeSort('p')];delete row.dueDay;delete row.sentDay;delete row.amount;delete row.ts;const result=await f.read();assert.equal(result.rows[0].amount,null);assert.equal(result.rows[0].sentDay,null);
});
test('numeric historical record keys use nonnumeric stable index keys rather than RTDB integer ordering',async()=>{
 const f=fixture({'2':budget(),'10':budget()}),index=f.state.sv_dashboard_budget_proposal.v1.noticeCandidates.u_u;
 assert(Object.keys(index).every(k=>/^k_[a-f0-9]+$/.test(k)));assert.deepEqual((await f.read()).rows.map(r=>r.key),['10','2']);
});
test('same guarded original mutations maintain candidates and counts without financial changes',async()=>{
 const f=fixture(),sentinels=structuredClone({ventas:f.state.sisventas.ventas,pagos:f.state.sisventas.pagos});
 await f.mutate({'sisventas/presupuestos/new':budget({estado:'revision'})});assert.equal((await f.read()).rows.length,2);
 await f.mutate({'sisventas/presupuestos/p/estado':'convertido'});assert.deepEqual((await f.read()).rows.map(r=>r.key),['new']);
 await f.mutate({'sisventas/presupuestos/new/responsableUid':'v'});assert.deepEqual((await f.read()).rows,[]);
 await f.mutate({'sisventas/presupuestos/new':null});assert.deepEqual((await f.read()).rows,[]);
 assert.deepEqual({ventas:f.state.sisventas.ventas,pagos:f.state.sisventas.pagos},sentinels);assert.equal(f.get(Index.ROOT+'/stats/all/noticeEligible'),0);
});
