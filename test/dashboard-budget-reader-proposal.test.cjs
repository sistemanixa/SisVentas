'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Reader=require('../cotizador/dashboard-budget-reader-proposal'),I=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {budget,seed,authFixture,request,traceDb}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const {createBackend}=require('./helpers/labor-ui-flow.cjs');
function fixture(records,{actorUid='u',onRead,enabled=true}={}){
 const state=seed(records),backend=createBackend();Object.assign(backend.state,state);
 function ref(path,spec={}){return {
  orderByChild:field=>ref(path,{...spec,field}),equalTo:equalTo=>ref(path,{...spec,equalTo}),orderByKey:()=>ref(path,{...spec,orderBy:'key'}),startAt:startAt=>ref(path,{...spec,startAt}),startAfter:startAfter=>ref(path,{...spec,startAfter}),limitToFirst:limit=>ref(path,{...spec,limit}),
  async get(){let value=structuredClone(backend.get(path));if(spec.limit){let rows=Object.entries(value||{}).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([key,row])=>(!spec.field||row[spec.field]===spec.equalTo)&&(!spec.startAt||key>=spec.startAt)&&(!spec.startAfter||key>spec.startAfter)).slice(0,spec.limit);value=rows.length?Object.fromEntries(rows):null;}return {val:()=>value,forEach:fn=>{for(const [key,row]of Object.entries(value||{}))fn({key,val:()=>row});}};}
 };}
 const traced=traceDb({ref},{onRead}),auth=authFixture(actorUid),reader=Reader.createDashboardBudgetReader({auth,db:traced.db,enabled,getAsOfDay:()=> '2026-11-04'});
 return {...backend,auth,reads:traced.reads,reader};
}
test('verified commercial actor derives own scope; transport contains only complete KPI, five daily rows and exact badge',async()=>{
 const records=Object.fromEntries(Array.from({length:7},(_,i)=>['p'+i,budget({id:'PP-'+i,fecha:'2026-11-0'+(i+1)})]));records.foreign=budget({responsableUid:'v'});const f=fixture(records),before=structuredClone(f.state),result=await f.reader.read(request());
 assert.equal(result.uid,'u');assert.equal(result.scope,'own');assert.equal(result.permissionRevision,7);assert.equal(result.counts.active,7);assert.equal(result.recent.rows.length,5);assert.equal(result.recent.rows[0].key,'p6');assert.equal(result.recent.exhausted,false);assert.equal(result.badge.badgeCount,7);assert.equal(result.notificationCenterComplete,false);assert(!JSON.stringify(result).includes('NEVER_TRANSPORT'));assert.deepEqual(f.state,before);assert.equal(f.auth.calls.length,4);
 assert(f.reads.filter(r=>r.path.includes('/document/')).every(r=>r.path.endsWith('/u_u')&&r.limit===5));
});
test('administrator scope includes foreign rows; empty certified admin scope is zero',async()=>{
 const f=fixture({own:budget(),foreign:budget({responsableUid:'v',estado:'convertido'})},{actorUid:'a'}),r=await f.reader.read(request());assert.equal(r.scope,'all');assert.equal(r.counts.converted,1);assert.equal(r.recent.rows.length,2);assert.equal(r.badge.badgeCount,1);
 const empty=fixture({},{actorUid:'a'});assert.equal((await empty.reader.read(request())).counts.active,0);
 const absent=fixture({});await assert.rejects(absent.reader.read(request()),/Metadata/);
});
test('GET contract rejects caller scope, UID, view, filters, bodies and mutations before any I/O',async()=>{
 for(const req of [request({method:'POST'}),request({url:Reader.ROUTE+'?scope=all'}),request({url:Reader.ROUTE+'?uid=v'}),request({url:Reader.ROUTE+'?viewProfile=a'}),request({body:{}}),request({viewing:true}),request({headers:{'x-sv-view-as':'a'}})]){const f=fixture();await assert.rejects(f.reader.read(req));assert.equal(f.reads.length,0);assert.equal(f.auth.calls.length,0);}
 const disabled=fixture(undefined,{enabled:false});await assert.rejects(disabled.reader.read(request()),/no habilitado/);assert.equal(disabled.auth.calls.length,0);
});
test('fresh existing Auth/reset, canonical identity, dashboard/budget permissions and revision gate every read',async()=>{
 for(const edit of [f=>{f.auth.setHook(()=>{throw Error('revoked');});},f=>{f.state.sv_access_resets={u:{required:true,version:2}};},f=>{f.state.sv_chat_roles.u.activo=false;},f=>{f.state.sv_usuarios.duplicate={...f.state.sv_usuarios.u};},f=>{f.state.sv_permisos.vendedor.indiceModulos.presupuesto=false;},f=>{f.state.sv_permisos.vendedor.indiceModulos.dashboard=false;},f=>{delete f.state.sv_permisos.vendedor.indiceRevision;}]){const f=fixture();edit(f);await assert.rejects(f.reader.read(request()));assert(!f.reads.some(r=>r.path.startsWith(I.ROOT)));}
});
test('missing/stale coverage, unknown dates, malformed prefix and metadata drift never yield successful totals',async()=>{
 for(const edit of [f=>{f.state.sv_dashboard_budget_proposal.v1.coverage.ready=false;},f=>{delete f.state.sv_dashboard_budget_proposal.v1.coverage.documentOrder;},f=>{f.state.sv_dashboard_budget_proposal.v1.coverage.documentOrder='document-date-desc/source-order-v1';},f=>{delete f.state.sv_dashboard_budget_proposal.v1.scopeProof.u_u;},f=>{f.state.sv_dashboard_budget_proposal.v1.coverage.generation='other';},f=>{const index=f.state.sv_dashboard_budget_proposal.v1.document.u_u;delete index[Object.keys(index)[0]];},f=>{Object.values(f.state.sv_dashboard_budget_proposal.v1.document.u_u)[0].ownerUid='v';}]){const f=fixture();edit(f);await assert.rejects(f.reader.read(request()));}
 const unknown=fixture({p:budget({fecha:'unknown'})});await assert.rejects(unknown.reader.read(request()),/Fechas desconocidas/);
 let f;f=fixture(undefined,{onRead:({path})=>{if(path.includes('/document/'))f.state.sv_dashboard_budget_proposal.v1.coverage.revision++;}});await assert.rejects(f.reader.read(request()),/cambió|changed/);
});
test('late role, permission revision, claim reset or policy changes retire response after native query',async()=>{
 for(const mutate of [f=>{f.state.sv_chat_roles.u.rol='admin';},f=>{f.state.sv_permisos.vendedor.indiceRevision++;},f=>{f.auth.claims.svPasswordChangeRequired=true;},f=>{f.state.sv_dashboard_budget_proposal.v1.policy.hash='0'.repeat(64);}]){let f;f=fixture(undefined,{onRead:({path})=>{if(path.includes('/document/'))mutate(f);}});await assert.rejects(f.reader.read(request()));}
});
test('inactive HTTP transport emits no-store bounded JSON and sanitized errors without partial data',async()=>{
 const f=fixture(),capture=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}}),success=capture();await f.reader.handle(request(),success);assert.equal(success.statusCode,200);assert.equal(success.headers['Cache-Control'],'no-store');assert.equal(JSON.parse(success.body).recent.rows.length,1);
 const invalid=capture();await f.reader.handle(request({url:Reader.ROUTE+'?scope=all'}),invalid);assert.equal(invalid.statusCode,400);assert(!invalid.body.includes('counts'));assert(!invalid.body.includes('fixture-token'));
});
