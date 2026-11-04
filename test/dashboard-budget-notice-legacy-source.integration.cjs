'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const enabled=process.env.SV_BUDGET_NOTICE_LEGACY_SOURCE==='1',opt={skip:!enabled};
function fixture(extra={}){
 const root=path.resolve(process.env.SV_BUDGET_CONTRACT_ROOT||path.join(__dirname,'..')),load=createRequire(path.join(root,'test/notice-legacy-proof.cjs'));
 const Index=load('../cotizador/dashboard-budget-incremental-plan-proposal'),Model=load('../cotizador/dashboard-budget-projection-proposal'),Notice=load('../js/core/dashboard-budget-notice-model-proposal'),DTO=load('../cotizador/dashboard-budget-sdk-dto-proposal');
 const {seed,budget}=load('./helpers/dashboard-budget-reader-fixture.cjs'),{createBackend}=load('./helpers/labor-ui-flow.cjs'),{createLaborGuard}=load('../cotizador/labor-guard'),backend=createBackend();Object.assign(backend.state,seed({p:budget({id:'PP-0001',enviadoEn:'31/09/2026',audit:[{accion:'Enviado al cliente',fecha:'29/10/2026',private:'DO_NOT_TRANSPORT'}],...extra})}));
 const state=backend.state,records=state.sisventas.presupuestos,model=Model.build({records,complete:true,users:state.sv_usuarios,identities:state.sv_chat_roles,permissions:state.sv_permisos,generation:'notice-legacy-fixture',revision:1,offsetMinutes:-180});
 state.sv_dashboard_budget_proposal.v1=load('../cotizador/dashboard-budget-activity-bootstrap-proposal').buildActivitySnapshot({model,records,timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es-AR'}).patch[Index.ROOT];
 const guard=createLaborGuard({store:backend.store,delay:async()=>{}});let seq=0;
 async function mutate(patch){return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'notice-legacy-test',opId:'notice-legacy-test-'+(++seq),input:patch},async scope=>{await scope.update(patch);const p=await Index.plan({patch,raw:p=>backend.store.read(p),get:p=>scope.get(p),generation:backend.get(Index.ROOT+'/coverage/generation'),revision:backend.get(Index.ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});await scope.update(p.patch);return {ok:true};});}
 return {...backend,Index,Model,Notice,DTO,mutate};
}
test('point-merged root bootstrap keeps Source.row17, candidate legacy evidence and header23',opt,()=>{
 const f=fixture(),tree=f.get(f.Index.ROOT),record=tree.sources.p,candidate=tree.noticeCandidates.u_u[f.Index.noticeSort('p')];assert.equal(Object.keys(record.row).length,17);assert(!Object.hasOwn(record.row,'noticeLegacy'));assert.equal(record.noticeLegacy.sentRaw,'31/09/2026');assert.deepEqual(candidate.noticeLegacy,record.noticeLegacy);assert(!JSON.stringify(candidate).includes('DO_NOT_TRANSPORT'));
 const patch=f.DTO.projectReadViews({tree,users:f.state.sv_usuarios,identities:f.state.sv_chat_roles,permissions:f.state.sv_permisos}).patch;for(const header of Object.values(patch))assert.equal(Object.keys(header).length,23);
});
test('same guarded point commit refreshes minimum originals without changing financial values or source row shape',opt,async()=>{
 const f=fixture(),before=structuredClone(f.state.sisventas.presupuestos.p);await f.mutate({'sisventas/presupuestos/p/enviadoEn':'29/10/26','sisventas/presupuestos/p/id':null});const record=f.get(f.Index.ROOT+'/sources/p'),candidate=f.get(f.Index.ROOT+'/noticeCandidates/u_u/'+f.Index.noticeSort('p'));assert.equal(record.noticeLegacy.idPresent,false);assert(!Object.hasOwn(record.noticeLegacy,'idValue'));assert.equal(candidate.noticeLegacy.sentRaw,'29/10/26');assert.equal(Object.keys(record.row).length,17);assert.equal(f.state.sisventas.presupuestos.p.total,before.total);assert.deepEqual(f.state.sisventas.presupuestos.p.audit,before.audit);
});
test('missing or forged previous technical legacy evidence rejects the whole business commit',opt,async()=>{
 for(const edit of [r=>{delete r.noticeLegacy;},r=>{r.noticeLegacy={...r.noticeLegacy,sentRaw:'2026-01-01'};}]){const f=fixture();edit(f.state.sv_dashboard_budget_proposal.v1.sources.p);const before=structuredClone(f.state.sisventas);await assert.rejects(f.mutate({'sisventas/presupuestos/p/enviadoEn':'2026-11-01'}));assert.deepEqual(f.state.sisventas,before);}
});
test('shared direct/server candidate validator requires typed minimum evidence and normalizes pruned null',opt,()=>{
 const f=fixture(),key=f.Index.noticeSort('p'),candidate=f.get(f.Index.ROOT+'/noticeCandidates/u_u/'+key),actor={uid:'u',role:'vendedor'};delete candidate.noticeLegacy.sentTs;assert.equal(f.Notice.project(candidate,key,actor).noticeLegacy.sentTs,null);
 for(const edit of [r=>{delete r.noticeLegacy;},r=>{r.noticeLegacy.private=[];},r=>{r.noticeLegacy.idValue={private:'DO_NOT_TRANSPORT'};},r=>{r.noticeLegacy.auditSentRaw='x'.repeat(33);}]){const r=structuredClone(candidate);edit(r);assert.throws(()=>f.Notice.project(r,key,actor));}
});
test('excluded history never captures irrelevant long identity or numeric dates and retains Source.row17/header23',opt,async()=>{
 for(const extra of [{estado:'convertido'},{estado:'anulado'},{eliminado:true}]){const f=fixture({...extra,id:'x'.repeat(1000),enviadoEn:-1,audit:[{accion:'Enviado al cliente',fecha:-1}]}),tree=f.get(f.Index.ROOT);assert.equal(tree.sources.p.noticeLegacy??null,null);assert.equal(Object.keys(tree.sources.p.row).length,17);assert.equal(tree.noticeCandidates?.u_u?.[f.Index.noticeSort('p')],undefined);
  const headers=f.DTO.projectReadViews({tree,users:f.state.sv_usuarios,identities:f.state.sv_chat_roles,permissions:f.state.sv_permisos}).patch;for(const h of Object.values(headers))assert.equal(Object.keys(h).length,23);
  delete f.state.sv_dashboard_budget_proposal.v1.sources.p.noticeLegacy;await f.mutate({'sisventas/presupuestos/p/enviadoEn':-2});assert.equal(f.get(f.Index.ROOT+'/sources/p').noticeLegacy??null,null);
 }
});
test('converted-to-admitted transition captures the new original and later exclusion removes candidate and legacy evidence',opt,async()=>{
 const f=fixture({estado:'convertido',id:'x'.repeat(1000),enviadoEn:-1});await f.mutate({'sisventas/presupuestos/p/estado':'enviado','sisventas/presupuestos/p/id':'PP-0009','sisventas/presupuestos/p/enviadoEn':-123});const record=f.get(f.Index.ROOT+'/sources/p'),candidate=f.get(f.Index.ROOT+'/noticeCandidates/u_u/'+f.Index.noticeSort('p'));assert.equal(record.noticeLegacy.idValue,'PP-0009');assert.equal(candidate.noticeLegacy.sentRaw,-123);assert.equal(record.noticeLegacy.sentTs,null);
 await f.mutate({'sisventas/presupuestos/p/estado':'convertido','sisventas/presupuestos/p/id':'z'.repeat(1000)});assert.equal(f.get(f.Index.ROOT+'/sources/p').noticeLegacy??null,null);assert.equal(f.get(f.Index.ROOT+'/noticeCandidates/u_u/'+f.Index.noticeSort('p')),null);
});
