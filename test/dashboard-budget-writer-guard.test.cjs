'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Writer=require('../cotizador/dashboard-budget-writer-proposal'),DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {createLaborGuard}=require('../cotizador/labor-guard'),{createBackend,apply}=require('./helpers/labor-ui-flow.cjs'),{activitySeed}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget}=require('./helpers/dashboard-budget-reader-fixture.cjs');
function fixture(options={}){
 const f=createBackend();Object.assign(f.state,activitySeed());const authority=()=>({users:f.get('sv_usuarios'),identities:f.get('sv_chat_roles'),permissions:f.get('sv_permisos')});apply(f.state,DTO.projectReadViews({tree:f.get(Index.ROOT),...authority()}).patch);
 const plugin=Writer.create({enabled:true,allowPolicyRenewal:true}),guard=createLaborGuard({store:f.store,delay:async()=>{},...(options.disabled?{}:{dashboardBudgets:plugin})});let sequence=0;
 async function run(patch,{id='guard-budget-'+(++sequence),race}={}){return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'dashboard-budget-writer-test',opId:id,input:patch},async scope=>{await scope.update(patch);if(race)scope.beforeCommit(race);return {ok:true};});}
 const verify=()=>{const tree=f.get(Index.ROOT),expected=Object.fromEntries(Object.entries(DTO.projectReadViews({tree,...authority()}).patch).map(([p,v])=>[p.split('/').at(-1),v]));assert.deepEqual(tree.read,expected);return tree;};return {...f,plugin,guard,run,verify};
}
test('normal guard updates original, counts, notices and all UID headers in a single commit',async()=>{
 const f=fixture(),sentinels=structuredClone({ventas:f.get('sisventas/ventas'),pagos:f.get('sisventas/pagos')});await f.run({'sisventas/presupuestos/new':budget({responsableUid:'v'})});const tree=f.verify();assert.equal(tree.coverage.revision,2);assert.equal(tree.stats.all.noticeEligible,2);assert.equal(tree.read.v.records,1);assert.equal(f.commits.length,1);assert(Object.hasOwn(f.commits[0],Index.ROOT+'/read/u'));assert(Object.hasOwn(f.commits[0],Index.ROOT+'/noticeCandidates/u_v/'+Index.noticeSort('new')));assert.deepEqual({ventas:f.get('sisventas/ventas'),pagos:f.get('sisventas/pagos')},sentinels);
});
test('replay does not create a second original, index entry, revision or receipt',async()=>{
 const f=fixture(),patch={'sisventas/presupuestos/new':budget()};await f.run(patch,{id:'same-budget-command'});const before=f.get(Index.ROOT);await f.run(patch,{id:'same-budget-command'});assert.equal(f.commits.length,1);assert.deepEqual(f.get(Index.ROOT),before);f.verify();
});
test('enabled guard rejects caller-provided derived fields and parent replacements without any commit',async()=>{
 for(const patch of [{[Index.ROOT+'/read/u/records']:0},{[Index.ROOT+'/coverage/ready']:true},{'sisventas/presupuestos':{new:budget()}}]){const f=fixture(),before=structuredClone(f.state.sisventas);await assert.rejects(f.run(patch));assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);}
});
test('normal permission renewal retires disallowed UID headers without a history rebuild',async()=>{
 const f=fixture(),before=f.get('sisventas/presupuestos');await f.run({'sv_permisos/vendedor/indiceModulos/presupuesto':false,'sv_permisos/vendedor/indiceRevision':8});assert.equal(f.get(Index.ROOT+'/coverage/ready'),true);assert.equal(f.get(Index.ROOT+'/read/u'),null);assert.equal(f.get(Index.ROOT+'/read/v'),null);assert.equal(f.get(Index.ROOT+'/read/a/revision'),2);assert.deepEqual(f.get('sisventas/presupuestos'),before);f.verify();
});
test('incomplete preparation and concurrent source changes abort before any financial or derived commit',async()=>{
 const f=fixture();apply(f.state,{[Index.ROOT+'/scopeProof/all']:null});await assert.rejects(f.run({'sisventas/presupuestos/p/estado':'convertido'}));assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/presupuestos/p/estado'),'enviado');
 const h=fixture();await assert.rejects(h.run({'sisventas/presupuestos/p/estado':'convertido'},{race:async()=>apply(h.state,{'sisventas/presupuestos/p/cliente':'Concurrente'})}));assert.equal(h.commits.length,0);assert.equal(h.get('sisventas/presupuestos/p/estado'),'enviado');assert.equal(h.get(Index.ROOT+'/coverage/revision'),1);
});
test('inactive plugin leaves the established guard path unchanged and injected disabled instances are refused',async()=>{
 const f=fixture({disabled:true}),before=f.get(Index.ROOT);await f.run({'sisventas/presupuestos/p/estado':'convertido'});assert.deepEqual(f.get(Index.ROOT),before);assert.throws(()=>createLaborGuard({store:f.store,dashboardBudgets:Writer.create()}));assert(f.guard.affects('sisventas/ventas/v'));assert(Writer.affects('sv_usuarios/u/ultimoAcceso'));
});
