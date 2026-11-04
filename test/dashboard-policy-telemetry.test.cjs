'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../cotizador/dashboard-budget-projection-proposal'),Index=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {createLaborGuard,digest}=require('../cotizador/labor-guard');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const {activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs');
const {budget,authFixture,request}=require('./helpers/dashboard-budget-reader-fixture.cjs');
const Reader=require('../cotizador/dashboard-budget-activity-reader-proposal');
function fixture(size=1){
 const records=Object.fromEntries(Array.from({length:size},(_,i)=>['p'+i,budget()])),f=createBackend();Object.assign(f.state,activitySeed(records));
 apply(f.state,{'sisventas/ventas/sentinel/costoTotalCompra':19,'sisventas/productos':{sentinel:{codigo:'FICTICIO',compraARS:19}},'sisventas/inventario_operativo':{sentinel:{general:7,reservado:2,consumido:1}},'sisventas/comisiones':{sentinel:{monto:13}},'sisventas/ctaemp/e/sentinel':{monto:17}});
 const guard=createLaborGuard({store:f.store,delay:async()=>{}}),reads=[],sentinels=Object.fromEntries(['ventas','pagos','productos','inventario_operativo','comisiones','ctaemp'].map(k=>[k,f.get('sisventas/'+k)]));
 let sequence=0;
 async function run(patch,{race}={}){
  reads.length=0;
  return guard.run({uid:'a',claims:{uid:'a'},role:'admin',mode:'user',operation:'policy-telemetry',opId:'policy-telemetry-'+(++sequence),input:patch},async scope=>{
   await scope.update(patch);if(race)scope.beforeCommit(race);
   const plan=await Index.plan({patch,raw:async p=>{reads.push(p);assert(!['sv_usuarios','sv_chat_roles','sv_permisos','sisventas','sisventas/presupuestos',Index.ROOT,Index.ROOT+'/sources'].includes(p),'no directory/history root read');return f.store.read(p);},get:p=>scope.get(p),generation:f.get(Index.ROOT+'/coverage/generation'),revision:f.get(Index.ROOT+'/coverage/revision'),beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:Model.projectRecord});
   await scope.update(plan.patch);return {ok:true,committed:true};
  });
 }
 const authority=()=>({users:f.get('sv_usuarios'),identities:f.get('sv_chat_roles'),permissions:f.get('sv_permisos')});
 const model=()=>Model.build({records:f.get('sisventas/presupuestos'),complete:true,...authority(),generation:'activity-fixture-generation',revision:1,offsetMinutes:-180});
 const read=()=>Reader.createActivityReader({auth:authFixture('u'),db:memoryDb(f.state),enabled:true,getAsOfDay:()=> '2026-11-04'}).read(request({url:Reader.ROUTE}));
 const preserve=()=>{for(const [k,value]of Object.entries(sentinels))assert.deepEqual(f.get('sisventas/'+k),value,'preserve '+k);};
 return {...f,storeReads:f.reads,reads,run,model,authority,read,preserve};
}
test('normal two-leaf login preserves policy hash, original sources and ready activity without rebuild',async()=>{
 const f=fixture(),before=f.model(),coverage=f.get(Index.ROOT+'/coverage'),tree=f.get(Index.ROOT),response=await f.read();
 await f.run({'sv_usuarios/u/ultimoAcceso':1793800000001,'sv_usuarios/u/ultimoAccesoEn':'04/11/2026 10:00'});
 assert.equal(f.model().policyHash,before.policyHash);assert.deepEqual(f.get(Index.ROOT+'/coverage'),coverage);assert.deepEqual(f.get(Index.ROOT),tree);assert.deepEqual(await f.read(),response);
 assert.equal(Model.metrics(before,{uid:'u',...f.authority()}).counts.active,1);f.preserve();
});
test('complete profile PUT with only telemetry differences preserves coverage and policy',async()=>{
 const f=fixture(),profile=f.get('sv_usuarios/u'),hash=f.model().policyHash;
 await f.run({'sv_usuarios/u':{...profile,ultimoAcceso:123,ultimoAccesoEn:'Ficticio'}});
 assert.equal(f.get(Index.ROOT+'/coverage/ready'),true);assert.equal(f.model().policyHash,hash);await f.read();f.preserve();
});
for(const [field,value]of [['uid','other'],['rol','administrativo'],['activo',false],['nombre','Otro'],['extra',true]])test('profile '+field+' remains authority-changing in leaf and full PUT',async()=>{
 for(const full of [false,true]){const f=fixture(),before=f.model();await f.run(full?{'sv_usuarios/u':{...f.get('sv_usuarios/u'),[field]:value,ultimoAcceso:1}}:{['sv_usuarios/u/'+field]:value});assert.equal(f.get(Index.ROOT+'/coverage/ready'),false);assert.equal(f.get(Index.ROOT+'/coverage/requiresReconciliation'),true);assert.notEqual(f.model().policyHash,before.policyHash);await assert.rejects(f.read());f.preserve();}
});
test('fresh guard rejects full PUT if profile authority changes after semantic comparison',async()=>{
 const f=fixture(),profile=f.get('sv_usuarios/u'),coverage=f.get(Index.ROOT+'/coverage');
 await assert.rejects(f.run({'sv_usuarios/u':{...profile,ultimoAcceso:1}},{race:async()=>apply(f.state,{'sv_usuarios/u/nombre':'Concurrente'})}));
 assert.equal(f.commits.length,0);assert.equal(f.get('sv_usuarios/u/nombre'),'Concurrente');assert.equal(f.get('sv_usuarios/u/ultimoAcceso'),null);assert.deepEqual(f.get(Index.ROOT+'/coverage'),coverage);f.preserve();
});
test('telemetry and one budget change maintain both sources in the same guarded commit',async()=>{
 const f=fixture();await f.run({'sv_usuarios/u/ultimoAcceso':1,'sv_usuarios/u/ultimoAccesoEn':'Ficticio','sisventas/presupuestos/p0/estado':'convertido'});
 assert.equal(f.get(Index.ROOT+'/coverage/ready'),true);assert.equal(f.get(Index.ROOT+'/coverage/activityReady'),true);assert.equal(f.get(Index.ROOT+'/stats/all/converted'),1);assert.equal((await f.read()).counts.converted,1);f.preserve();
});
test('telemetry profile point work is constant with one or 1001 originals and never downloads a directory',async t=>{
 const measures=[];for(const size of [1,1001]){const f=fixture(size);await f.run({'sv_usuarios/u':{...f.get('sv_usuarios/u'),ultimoAcceso:1}});assert.equal(f.get(Index.ROOT+'/coverage/ready'),true);assert.deepEqual(f.reads,['sv_usuarios/u']);assert.equal(f.commits.length,1);measures.push({plannerReads:f.reads.length,profileStoreReads:f.storeReads.filter(r=>r[0]==='server'&&r[1]==='sv_usuarios/u').length,commitPaths:Object.keys(f.commits[0]).length});f.preserve();}assert.deepEqual(measures[0],measures[1]);assert.deepEqual(measures[0],{plannerReads:1,profileStoreReads:3,commitPaths:3});t.diagnostic('Fixture only, both 1/1001 originals: '+JSON.stringify(measures[0]));
});
test('shared policy projection excludes only own top-level telemetry fields without mutating originals',()=>{
 const Policy=require('../cotizador/dashboard-authority-policy-proposal'),f=fixture(),authority=f.authority();
 authority.users.u.ultimoAcceso=1;authority.users.u.ultimoAccesoEn='Ficticio';authority.users.u.extra={ultimoAcceso:2,ultimoAccesoEn:'Keep'};authority.identities.u.ultimoAcceso=3;
 const before=structuredClone(authority),projected=Policy.projection(authority);
 assert.deepEqual(authority,before);assert(!Object.hasOwn(projected.users.u,'ultimoAcceso'));assert(!Object.hasOwn(projected.users.u,'ultimoAccesoEn'));assert.deepEqual(projected.users.u.extra,authority.users.u.extra);assert.equal(projected.identities.u.ultimoAcceso,3);
 projected.users.u.extra.ultimoAcceso=9;assert.deepEqual(authority,before);
 const baseline=Policy.hash(authority),changed=structuredClone(authority);changed.users.u.ultimoAcceso=999;delete changed.users.u.ultimoAccesoEn;assert.equal(Policy.hash(changed),baseline);
 for(const mutate of [a=>a.users.u.extra.ultimoAcceso++,a=>a.identities.u.ultimoAcceso++,a=>a.permissions.vendedor.indiceRevision++]){const next=structuredClone(authority);mutate(next);assert.notEqual(Policy.hash(next),baseline);}
 const clean=f.authority();assert.equal(Policy.hash(clean),digest(clean),'telemetry-free existing hash is stable');
});
test('root, nested lookalike, identity and permission writes still invalidate readiness',async()=>{
 for(const makePatch of [f=>({'sv_usuarios':f.get('sv_usuarios')}),()=>({'sv_usuarios/u/extra/ultimoAcceso':1}),()=>({'sv_usuarios/u/ultimoAcceso/nested':1}),()=>({'sv_chat_roles/u/ultimoAcceso':1}),()=>({'sv_permisos/vendedor/indiceRevision':8})]){
  const f=fixture();await f.run(makePatch(f));assert.equal(f.get(Index.ROOT+'/coverage/ready'),false);assert.equal(f.get(Index.ROOT+'/coverage/requiresReconciliation'),true);f.preserve();
 }
});
test('missing profile is not a telemetry-only no-op and profile removal always invalidates',async()=>{
 for(const patch of [{'sv_usuarios/new/ultimoAcceso':1},{'sv_usuarios/new':{ultimoAcceso:1}},{'sv_usuarios/u':null}]){const f=fixture();await f.run(patch);assert.equal(f.get(Index.ROOT+'/coverage/ready'),false);f.preserve();}
});
test('telemetry deletions and multiple-profile access preserve ready hash with bounded individual reads',async()=>{
 const f=fixture();await f.run({'sv_usuarios/u/ultimoAcceso':1,'sv_usuarios/u/ultimoAccesoEn':'Ficticio','sv_usuarios/v/ultimoAcceso':2});const hash=f.model().policyHash;
 await f.run({'sv_usuarios/u/ultimoAcceso':null,'sv_usuarios/u/ultimoAccesoEn':null,'sv_usuarios/v':{...f.get('sv_usuarios/v'),ultimoAcceso:3}});
 assert.equal(f.model().policyHash,hash);assert.equal(f.get(Index.ROOT+'/coverage/ready'),true);assert.deepEqual(f.reads,['sv_usuarios/u','sv_usuarios/v']);f.preserve();
});
test('fresh guard also aborts leaf telemetry when another writer changes profile authority',async()=>{
 const f=fixture();await assert.rejects(f.run({'sv_usuarios/u/ultimoAcceso':1},{race:async()=>apply(f.state,{'sv_usuarios/u/activo':false})}));assert.equal(f.commits.length,0);assert.equal(f.get('sv_usuarios/u/ultimoAcceso'),null);assert.equal(f.get('sv_usuarios/u/activo'),false);f.preserve();
});
test('telemetry cannot rehabilitate an already invalidated coverage',async()=>{
 const f=fixture();await f.run({'sv_permisos/vendedor/indiceRevision':8});const coverage=f.get(Index.ROOT+'/coverage');await f.run({'sv_usuarios/u/ultimoAcceso':1});assert.deepEqual(f.get(Index.ROOT+'/coverage'),coverage);await assert.rejects(f.read());f.preserve();
});
