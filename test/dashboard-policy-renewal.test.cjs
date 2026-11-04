'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../cotizador/dashboard-budget-projection-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Policy=require('../cotizador/dashboard-authority-policy-proposal');
const {createLaborGuard}=require('../cotizador/labor-guard'),{createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const {activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget,authFixture,request,traceDb}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const Reader=require('../cotizador/dashboard-budget-activity-reader-proposal');
const ROOT=Index.ROOT,AUTH=['sv_usuarios','sv_chat_roles','sv_permisos'];
function fixture(size=1){
 const f=createBackend(),records=Object.fromEntries(Array.from({length:size},(_,i)=>['p'+i,budget()]));
 const legacy=budget({usuario:'Uno'});delete legacy.responsableUid;records.legacy=legacy;Object.assign(f.state,activitySeed(records));
 apply(f.state,{'sisventas/productos':{s:{costo:19}},'sisventas/inventario_operativo':{s:{general:7,reservado:2,consumido:1}},'sisventas/comisiones':{s:{monto:13}},'sisventas/ctaemp/e/s':{monto:17}});
 const guard=createLaborGuard({store:f.store,delay:async()=>{}}),reads=[],sentinels=Object.fromEntries(['ventas','pagos','productos','inventario_operativo','comisiones','ctaemp'].map(k=>[k,f.get('sisventas/'+k)]));let seq=0;
 async function run(patch,{race}={}){reads.length=0;return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'policy-renewal-proposal',opId:'policy-renewal-'+(++seq),input:patch},async scope=>{
  await scope.update(patch);if(race)scope.beforeCommit(race);
  const plan=await Index.plan({allowPolicyRenewal:true,patch,raw:async p=>{reads.push(p);assert(!p.startsWith('sisventas/'),'no financial or budget originals during policy renewal');assert(![ROOT,ROOT+'/sources'].includes(p));return f.store.read(p);},get:p=>scope.get(p),generation:f.get(ROOT+'/coverage/generation'),revision:f.get(ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});
  await scope.update(plan.patch);return {ok:true,committed:true,policyRenewed:plan.policyRenewed===true,requiresReadViewRefresh:plan.requiresReadViewRefresh===true,requiresReconciliation:plan.requiresReconciliation===true};
 });}
 const authority=()=>({users:f.get(AUTH[0]),identities:f.get(AUTH[1]),permissions:f.get(AUTH[2])});
 const read=()=>Reader.createActivityReader({auth:authFixture('u'),db:memoryDb(f.state),enabled:true,getAsOfDay:()=> '2026-11-04'}).read(request({url:Reader.ROUTE}));
 const preserve=()=>{for(const [k,value]of Object.entries(sentinels))assert.deepEqual(f.get('sisventas/'+k),value);};
 return {...f,run,reads,authority,read,preserve};
}
for(const [name,patch]of [
 ['revision',{'sv_permisos/vendedor/indiceRevision':8}],
 ['actions',{'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/acciones/presupuestos/aprobar':false}],
 ['other module',{'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/chat':false}]
])test('legitimate permission save '+name+' renews policy without retiring global budget coverage',async()=>{
 const f=fixture(),tree=f.get(ROOT),sources=f.get('sisventas/presupuestos'),before=await f.read(),result=await f.run(patch),coverage=f.get(ROOT+'/coverage');
 assert.equal(coverage.ready,true);assert.equal(coverage.activityReady,true);assert.equal(coverage.revision,tree.coverage.revision+1);assert.equal(coverage.policyHash,Policy.hash(f.authority()));assert.notEqual(coverage.policyHash,tree.policy.hash);assert.equal(f.get(ROOT+'/policy/hash'),coverage.policyHash);assert.equal(coverage.sourceAccumulator,tree.coverage.sourceAccumulator);
 assert.equal(result.policyRenewed,true);assert.equal(result.requiresReadViewRefresh,true);assert.equal(result.requiresReconciliation,false);
 for(const [key,value]of Object.entries(tree))if(!['coverage','policy'].includes(key))assert.deepEqual(f.get(ROOT+'/'+key),value,key+' must not be recalculated');assert.deepEqual(f.get('sisventas/presupuestos'),sources);assert.deepEqual((await f.read()).counts,before.counts);f.preserve();
});
test('actor who loses dashboard module is denied immediately despite global ready coverage',async()=>{
 const f=fixture();await f.read();await f.run({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});assert.equal(f.get(ROOT+'/coverage/ready'),true);await assert.rejects(f.read(),/Dashboard|habilitado/);f.preserve();
});
for(const [name,patch]of [
 ['uid',{'sv_usuarios/u/uid':'different'}],['name',{'sv_usuarios/u/nombre':'Otra persona'}],['active',{'sv_usuarios/u/activo':false}],['identity active',{'sv_chat_roles/u/activo':false}],['duplicate uid',{'sv_usuarios/duplicate':{uid:'u',nombre:'Duplicado',rol:'vendedor',activo:true}}],['ambiguous aliases',{'sv_usuarios/v/nombre':'Uno'}],['inconsistent role',{'sv_usuarios/u/rol':'administrativo'}]
])test('ownership drift '+name+' still retires coverage without reassigning legacy originals',async()=>{
 const f=fixture(),sources=f.get(ROOT+'/sources'),budgets=f.get('sisventas/presupuestos'),result=await f.run(patch);
 assert.equal(f.get(ROOT+'/coverage/ready'),false);assert.equal(f.get(ROOT+'/coverage/requiresReconciliation'),true);assert.equal(result.policyRenewed,false);assert.equal(result.requiresReconciliation,true);assert.deepEqual(f.get(ROOT+'/sources'),sources);assert.deepEqual(f.get('sisventas/presupuestos'),budgets);await assert.rejects(f.read());f.preserve();
});
test('fresh authority drift aborts renewal and never publishes a mixed policy hash',async()=>{
 const f=fixture(),coverage=f.get(ROOT+'/coverage'),policy=f.get(ROOT+'/policy');await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8},{race:async()=>apply(f.state,{'sv_usuarios/u/nombre':'Concurrente'})}));assert.equal(f.commits.length,0);assert.deepEqual(f.get(ROOT+'/coverage'),coverage);assert.deepEqual(f.get(ROOT+'/policy'),policy);assert.equal(f.get('sv_permisos/vendedor/indiceRevision'),7);f.preserve();
});
for(const [name,path,value]of [['identity','sv_chat_roles/u/activo',false],['permission','sv_permisos/vendedor/indiceRevision',99]])test('fresh '+name+' drift also aborts renewal before any metadata write',async()=>{
 const f=fixture(),tree=f.get(ROOT);await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8},{race:async()=>apply(f.state,{[path]:value})}));assert.equal(f.commits.length,0);assert.deepEqual(f.get(ROOT),tree);assert.equal(f.get(path),value);f.preserve();
});
test('policy renewal has constant bounded authority reads and no budget/finance reads at 1 and 1001 originals',async t=>{
 const measures=[];for(const size of [1,1001]){const f=fixture(size);await f.run({'sv_permisos/vendedor/indiceRevision':8});assert.equal(f.get(ROOT+'/coverage/ready'),true);assert.deepEqual(f.reads,[ROOT+'/coverage',ROOT+'/policy',...AUTH]);measures.push({reads:f.reads.length,paths:Object.keys(f.commits[0]).length});f.preserve();}assert.deepEqual(measures[0],measures[1]);assert.deepEqual(measures[0],{reads:5,paths:5});t.diagnostic('Fixture counts: '+JSON.stringify(measures[0]));
});
test('coordinated role change renews policy only when effective UID/alias resolution is unchanged',async()=>{
 const f=fixture(),tree=f.get(ROOT),before=f.authority();await f.run({'sv_usuarios/u/rol':'administrativo','sv_chat_roles/u/rol':'administrativo','sv_permisos/administrativo':{indiceVersion:2,indiceRevision:9,indiceModulos:{dashboard:true,presupuesto:true}}});
 assert.equal(f.get(ROOT+'/coverage/ready'),true);assert.equal(Policy.ownershipHash(before),Policy.ownershipHash(f.authority()));assert.notEqual(Policy.hash(before),Policy.hash(f.authority()));assert.deepEqual(f.get(ROOT+'/sources'),tree.sources);const response=await f.read();assert.equal(response.role,'administrativo');assert.equal(response.permissionRevision,9);f.preserve();
});
test('ownership projection compares effective aliases and ambiguities, not object order or role labels',()=>{
 const f=fixture(),before=f.authority(),copy=structuredClone(before);copy.users=Object.fromEntries(Object.entries(copy.users).reverse());copy.users.u.rol='administrativo';copy.identities.u.rol='administrativo';copy.permissions.extra={indiceRevision:999};assert.deepEqual(Policy.ownershipProjection(before),Policy.ownershipProjection(copy));
 copy.users.u.email='nuevo@example.invalid';assert.notEqual(Policy.ownershipHash(before),Policy.ownershipHash(copy));assert.equal(Policy.ownershipProjection(before).find(p=>p.uid==='u').aliases.includes('uno'),true);
});
test('uncovered authority before-image fails closed instead of certifying preexisting drift',async()=>{
 const f=fixture(),coverage=f.get(ROOT+'/coverage');apply(f.state,{'sv_usuarios/u/nombre':'Fuera del protocolo'});await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8}),/not covered/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(ROOT+'/coverage'),coverage);assert.equal(f.get('sv_permisos/vendedor/indiceRevision'),7);f.preserve();
});
test('permission renewal never rehabilitates an ownership-invalidated generation',async()=>{
 const f=fixture();await f.run({'sv_usuarios/u/nombre':'Cambio de propietario potencial'});assert.equal(f.get(ROOT+'/coverage/ready'),false);await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8}),/not covered/);assert.equal(f.get(ROOT+'/coverage/ready'),false);assert.equal(f.get(ROOT+'/coverage/requiresReconciliation'),true);f.preserve();
});
test('concurrent harmless telemetry is excluded from the fresh authority policy comparison',async()=>{
 const f=fixture(),r=await f.run({'sv_permisos/vendedor/indiceRevision':8},{race:async()=>apply(f.state,{'sv_usuarios/u/ultimoAcceso':123,'sv_usuarios/u/ultimoAccesoEn':'Ficticio'})});assert.equal(r.policyRenewed,true);assert.equal(f.get(ROOT+'/coverage/ready'),true);assert.equal(f.get(ROOT+'/policy/hash'),Policy.hash(f.authority()));assert.equal(f.get('sv_usuarios/u/ultimoAcceso'),123);f.preserve();
});
test('reader rejects a revision/grant changed during its read even when both renewals keep global coverage ready',async()=>{
 const f=fixture();let changed=false;const traced=traceDb(memoryDb(f.state),{onRead:async({path})=>{if(!changed&&path===ROOT+'/coverage'){changed=true;await f.run({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});}}});
 const reader=Reader.createActivityReader({auth:authFixture('u'),db:traced.db,enabled:true,getAsOfDay:()=> '2026-11-04'});await assert.rejects(reader.read(request({url:Reader.ROUTE})));assert.equal(f.get(ROOT+'/coverage/ready'),true);f.preserve();
});
