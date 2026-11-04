'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Index=require('../cotizador/dashboard-budget-incremental-plan-proposal'),Model=require('../cotizador/dashboard-budget-projection-proposal'),DTO=require('../cotizador/dashboard-budget-sdk-dto-proposal'),Headers=require('../cotizador/dashboard-budget-read-view-augment-proposal');
const {createLaborGuard,digest}=require('../cotizador/labor-guard'),{normalizeRtdb}=require('../cotizador/payment-membership-index');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs'),{activitySeed}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const ROOT=Index.ROOT,READ=ROOT+'/read',AUTH=['sv_usuarios','sv_chat_roles','sv_permisos'];
function fixture(size=1){
 const records=Object.fromEntries(Array.from({length:size},(_,i)=>['p'+i,budget()])),f=createBackend();Object.assign(f.state,activitySeed(records));
 apply(f.state,{'sisventas/productos':{s:{costo:19}},'sisventas/inventario_operativo':{s:{general:7,reservado:2,consumido:1}},'sisventas/comisiones':{s:{monto:13}},'sisventas/ctaemp/e/s':{monto:17}});
 const authority=()=>({users:f.get(AUTH[0]),identities:f.get(AUTH[1]),permissions:f.get(AUTH[2])});
 const offline=()=>DTO.projectReadViews({tree:f.get(ROOT),...authority()});apply(f.state,offline().patch);
 const sentinels=Object.fromEntries(['ventas','pagos','productos','inventario_operativo','comisiones','ctaemp'].map(k=>[k,f.get('sisventas/'+k)])),headerReads=[],indexReads=[],guard=createLaborGuard({store:f.store,delay:async()=>{}});let seq=0;
 const commit=f.store.commit;
 f.store.commit=async(patch,...args)=>{
  if(Object.hasOwn(patch,ROOT+'/coverage')){
   const next=structuredClone(f.state);apply(next,patch);const c=next.sv_dashboard_budget_proposal.v1.coverage,views=next.sv_dashboard_budget_proposal.v1.read||{};
   if(c.ready)for(const header of Object.values(views)){assert.equal(header.revision,c.revision,'no coverage/header window');assert.equal(header.generation,c.generation);assert.equal(header.policyHash,c.policyHash);assert.equal(Object.keys(header).length,23);}
   else assert.equal(Object.keys(views).length,0,'no ready UID header on retired coverage');
  }
  return commit(patch,...args);
 };
 async function run(patch,{enabled=true,race,alterPlan}={}){
  headerReads.length=0;indexReads.length=0;
  return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'uid-header-proposal',opId:'uid-header-fixture-'+(++seq),input:patch},async scope=>{
   await scope.update(patch);if(race)scope.beforeCommit(race);
   const planned=await Index.plan({patch,allowPolicyRenewal:true,raw:async p=>{indexReads.push(p);assert(![ROOT,ROOT+'/sources','sisventas','sisventas/presupuestos'].includes(p));return f.store.read(p);},get:p=>scope.get(p),generation:f.get(ROOT+'/coverage/generation'),revision:f.get(ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});
   if(alterPlan)alterPlan(planned);
   const result=await Headers.augment({enabled,planned,raw:async p=>{headerReads.push(p);assert(!p.startsWith('sisventas/')&&p!==ROOT&&!p.startsWith(ROOT+'/sources'),'no originals/history tree for UID headers');return f.store.read(p);},get:p=>scope.get(p),beforeCommit:fn=>scope.beforeCommit(fn)});
   await scope.update(result.patch);return {ok:true,committed:true,readViewRefreshComplete:result.readViewRefreshComplete===true,requiresReadViewRefresh:result.requiresReadViewRefresh===true,uidHeaderCount:result.uidHeaderCount??0,retiredUidCount:result.retiredUidCount??0};
  });
 }
 const preserve=()=>{for(const [k,v]of Object.entries(sentinels))assert.deepEqual(f.get('sisventas/'+k),v);};
 const assertViews=()=>{const expected=Object.fromEntries(Object.entries(offline().patch).map(([p,v])=>[p.slice(READ.length+1),v]));assert.deepEqual(f.get(READ),expected);};
 return {...f,authority,offline,headerReads,indexReads,run,preserve,assertViews};
}
for(const [name,patch]of [
 ['create',{'sisventas/presupuestos/new':budget({responsableUid:'v',estado:'convertido'})}],
 ['edit',{'sisventas/presupuestos/p0/estado':'convertido'}],
 ['reassign',{'sisventas/presupuestos/p0/responsableUid':'v'}],
 ['delete',{'sisventas/presupuestos/p0':null}]
])test('same guarded '+name+' publishes complete UID headers from overlay metadata',async()=>{
 const f=fixture(),before=f.get(ROOT+'/coverage'),result=await f.run(patch);assert.equal(f.commits.length,1);assert.equal(result.readViewRefreshComplete,true);assert.equal(result.requiresReadViewRefresh,false);assert.equal(f.get(ROOT+'/coverage/revision'),before.revision+1);f.assertViews();f.preserve();
 for(const id of ['a','u','v'])assert(Object.hasOwn(f.commits[0],READ+'/'+id));
});
test('permission renewal updates every enabled UID header including unaffected roles with the global hash',async()=>{
 const f=fixture(),before=f.get(READ);const result=await f.run({'sv_permisos/vendedor/indiceRevision':8});assert.equal(result.readViewRefreshComplete,true);assert.equal(result.requiresReadViewRefresh,false);assert.notEqual(f.get(READ+'/a/policyHash'),before.a.policyHash);assert.equal(f.get(READ+'/u/permissionRevision'),8);assert.equal(f.get(READ+'/a/permissionRevision'),7);f.assertViews();f.preserve();
});
test('permission revocation removes losing UID headers in the coverage renewal commit',async()=>{
 const f=fixture(),r=await f.run({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});assert.equal(f.get(ROOT+'/coverage/ready'),true);assert.equal(f.get(READ+'/u'),null);assert.equal(f.get(READ+'/v'),null);assert.equal(r.retiredUidCount,2);assert.equal(f.commits[0][READ+'/u'],null);f.assertViews();f.preserve();
});
test('ownership invalidation retires all previous headers without reassigning sources',async()=>{
 const f=fixture(),sources=f.get(ROOT+'/sources');await f.run({'sv_usuarios/u/activo':false,'sv_chat_roles/u/activo':false});assert.equal(f.get(ROOT+'/coverage/ready'),false);assert.deepEqual(f.get(ROOT+'/sources'),sources);assert.equal(Object.keys(f.get(READ)||{}).length,0);assert.equal(f.commits.length,1);f.preserve();
});
test('granting a previously denied zero scope creates its UID header without source inventory',async()=>{
 const f=fixture();await f.run({'sv_permisos/vendedor/indiceRevision':8,'sv_permisos/vendedor/indiceModulos/dashboard':false});await f.run({'sv_permisos/vendedor/indiceRevision':9,'sv_permisos/vendedor/indiceModulos/dashboard':true});assert.equal(f.get(READ+'/v/records'),0);assert.equal(f.get(READ+'/u/records'),1);f.assertViews();f.preserve();
});
test('role edit keeps the effective owner and refreshes role/revision in the same UID header',async()=>{
 const f=fixture();await f.run({'sv_usuarios/u/rol':'administrativo','sv_chat_roles/u/rol':'administrativo','sv_permisos/administrativo':{indiceVersion:2,indiceRevision:9,indiceModulos:{dashboard:true,presupuesto:true}}});assert.equal(f.get(READ+'/u/role'),'administrativo');assert.equal(f.get(READ+'/u/permissionRevision'),9);f.assertViews();f.preserve();
});
test('required refresh and ordinary derived coverage changes fail closed when augment is disabled',async()=>{
 for(const patch of [{'sv_permisos/vendedor/indiceRevision':8},{'sisventas/presupuestos/p0/estado':'convertido'}]){const f=fixture(),before=f.get(ROOT);await assert.rejects(f.run(patch,{enabled:false}),/disabled/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(ROOT),before);f.preserve();}
});
for(const [name,path,value]of [
 ['users','sv_usuarios/u/nombre','Concurrente'],['identity','sv_chat_roles/u/activo',false],['permission','sv_permisos/vendedor/indiceRevision',99],['stats',ROOT+'/stats/u_u/active',0],['proof',ROOT+'/scopeProof/u_u','0'.repeat(64)],['headers',READ+'/u/records',99]
])test('concurrent '+name+' drift aborts the entire pending header operation',async()=>{
 const f=fixture(),coverage=f.get(ROOT+'/coverage');await assert.rejects(f.run({'sisventas/presupuestos/p0/estado':'convertido'},{race:async()=>apply(f.state,{[path]:value})}));assert.equal(f.commits.length,0);assert.deepEqual(f.get(ROOT+'/coverage'),coverage);assert.equal(f.get('sisventas/presupuestos/p0/estado'),'enviado');f.preserve();
});
test('malformed proof refuses all headers rather than publishing a partially refreshed set',async()=>{
 const f=fixture(),before=f.get(READ);apply(f.state,{[ROOT+'/scopeProof/u_u']:'0'.repeat(64)});await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8}),/proof/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);assert.equal(f.get('sv_permisos/vendedor/indiceRevision'),7);f.preserve();
});
test('unknown extra stats fields remain proof-covered and never expand the 23-field DTO',async()=>{
 const f=fixture();for(const scope of ['all','u_u']){const stats={...f.get(ROOT+'/stats/'+scope),noticeEligible:1,futureCounter:7};apply(f.state,{[ROOT+'/stats/'+scope]:stats,[ROOT+'/scopeProof/'+scope]:digest(normalizeRtdb(stats))});}
 await f.run({'sv_permisos/vendedor/indiceRevision':8});f.assertViews();assert.equal(f.get(ROOT+'/stats/u_u/noticeEligible'),1);assert.equal(Object.keys(f.get(READ+'/u')).length,23);f.preserve();
});
test('header refresh work is independent of one or 1001 unrelated originals',async t=>{
 const measurements=[];for(const size of [1,1001]){const f=fixture(size);await f.run({'sv_permisos/vendedor/indiceRevision':8});measurements.push({headerReads:f.headerReads.length,commitPaths:Object.keys(f.commits[0]).length});f.assertViews();f.preserve();}assert.deepEqual(measurements[0],measurements[1]);t.diagnostic('Fixture only '+JSON.stringify(measurements[0]));
});
test('telemetry alone preserves existing headers and does not trigger directory/history reads',async()=>{
 const f=fixture(),before=f.get(READ);await f.run({'sv_usuarios/u/ultimoAcceso':123,'sv_usuarios/u/ultimoAccesoEn':'Ficticio'});assert.deepEqual(f.get(READ),before);assert.deepEqual(f.headerReads,[]);f.preserve();
});
test('obsolete UID headers outside the current directory are removed in the same commit',async()=>{
 const f=fixture();apply(f.state,{[READ+'/obsolete']:{...f.get(READ+'/u'),uid:'obsolete'}});const result=await f.run({'sv_permisos/vendedor/indiceRevision':8});assert.equal(result.retiredUidCount,1);assert.equal(f.commits[0][READ+'/obsolete'],null);f.assertViews();f.preserve();
});
test('previously populated scope cannot silently become zero after losing both stats and proof',async()=>{
 const f=fixture(),before=f.get(READ);apply(f.state,{[ROOT+'/stats/u_u']:null,[ROOT+'/scopeProof/u_u']:null});await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8}),/lost its metadata/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);f.preserve();
});
test('proof-matching inconsistent counters cannot produce an operative UID patch',async()=>{
 const f=fixture(),before=f.get(READ),stats={...f.get(ROOT+'/stats/u_u'),converted:99};apply(f.state,{[ROOT+'/stats/u_u']:stats,[ROOT+'/scopeProof/u_u']:digest(normalizeRtdb(stats))});await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8}),/counters/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);f.preserve();
});
for(const [name,path,value]of [['coverage',ROOT+'/coverage/revision',99],['policy',ROOT+'/policy/hash','0'.repeat(64)]])test('concurrent '+name+' metadata cannot publish fresh-looking UID headers',async()=>{
 const f=fixture(),before=f.get(READ);await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8},{race:async()=>apply(f.state,{[path]:value})}));assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);f.preserve();
});
test('caller cannot bypass projection with precomputed UID headers in the planned patch',async()=>{
 const f=fixture(),before=f.get(READ);await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8},{alterPlan:plan=>{plan.patch[READ+'/u']={uid:'u',ready:true};}}),/precomputed/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);f.preserve();
});
test('default is disabled and cannot return an operative patch that requires UID refresh',async()=>{
 await assert.rejects(Headers.augment({planned:{patch:{[ROOT+'/coverage']:{ready:true}},requiresReadViewRefresh:true}}),/disabled/);
});
test('dropping planned coverage cannot clear a required-refresh signal',async()=>{
 const f=fixture(),before=f.get(READ);await assert.rejects(f.run({'sv_permisos/vendedor/indiceRevision':8},{alterPlan:plan=>{delete plan.patch[ROOT+'/coverage'];}}),/no planned coverage/);assert.equal(f.commits.length,0);assert.deepEqual(f.get(READ),before);f.preserve();
});
