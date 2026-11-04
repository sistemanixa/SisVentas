'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Context=require('../js/core/dashboard-host-context-proposal'),Aggregate=require('../js/core/dashboard-activity-aggregate-proposal'),{functionSource}=require('./helpers/app-functions.cjs');
const Source=require('../js/core/dashboard-budget-source-proposal');
function fixture(){
 const events=new Map(),docEvents=new Map(),modules=new Set(['dashboard','detalle','cobranzas','presupuesto','agenda']);
 const r={currentRole:'admin',currentUserUid:'u',currentUser:'Usuario ficticio',isAuthenticated:true,fbAuth:{currentUser:{uid:'u'}},fbDB:{},fbOnline:true,navigator:{onLine:true},PERMISOS_ROLES:{admin:{indiceVersion:2,indiceRevision:7}},permisoModulo:m=>modules.has(m),tienePermiso:()=>false,document:{hidden:false,addEventListener:(n,f)=>{const a=docEvents.get(n)||[];a.push(f);docEvents.set(n,a);}},addEventListener:(n,f)=>{const a=events.get(n)||[];a.push(f);events.set(n,a);},removeEventListener:(n,f)=>events.set(n,(events.get(n)||[]).filter(v=>v!==f)),emit:n=>{for(const f of events.get(n)||[])f();}};
 r.PERMISOS_ROLES.admin.indiceModulos=Object.fromEntries([...modules].map(m=>[m,true]));
 vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),{window:r,document:r.document,URL,requestAnimationFrame(){}});
 const api=Context.create(r,{now:()=>new Date('2026-11-01T01:00:00Z')});return {r,api,modules};
}
test('capture uses actual readiness generation and explicit business month; aggregate pins remain valid',()=>{
 const {r,api}=fixture(),c=api.capture();assert(c.allowed);assert(api.valid(c));assert.equal(c.asOfDay,'2026-10-31');assert.equal(c.month,'2026-10');assert.equal(c.dataEpoch,r.SVDataReadiness.snapshotEpoch());assert(api.valid(Aggregate.snapshot(c)));r.SVDataReadiness.reset();assert.equal(api.valid(c),false);assert.equal(api.capture().dataEpoch,c.dataEpoch+1);
});
test('transport policy is conservative until raw restriction presence and revision are certified',()=>{
 const {r,api}=fixture();assert.equal(api.decision().kind,'authorized-server');r._svDashboardRawBlockedPresence={admin:{revision:7,present:false}};assert.equal(api.decision().kind,'direct-rtdb');r._svDashboardRawBlockedPresence.admin.revision=6;assert.equal(api.decision().kind,'authorized-server');
});
test('actual role application captures raw falsy blocks before normalizer removes them',()=>{
 for(const value of [false,0,'',[],null]){const s={window:{},PERMISOS_ROLES:null,normalizarPermisosRolesGuardados:data=>({admin:{indiceVersion:2,indiceRevision:data.admin.indiceRevision}})};vm.createContext(s);vm.runInContext(functionSource('aplicarPermisosRolesGuardados'),s);s.aplicarPermisosRolesGuardados({admin:{indiceRevision:7,bloqueados:value}});assert.equal(s.window._svDashboardRawBlockedPresence.admin.present,true);assert.equal(s.window._svDashboardRawBlockedPresence.admin.revision,7);assert(Object.isFrozen(s.window._svDashboardRawBlockedPresence));assert.equal(Object.hasOwn(s.PERMISOS_ROLES.admin,'bloqueados'),false);}
});
test('network transition changes transport epoch without invalidating the same principal snapshot',()=>{
 const {r,api}=fixture(),c=api.capture();r.navigator.onLine=false;r.fbOnline=false;r.emit('offline');assert.equal(api.capture().connected,false);assert.equal(api.capture().connectionEpoch,c.connectionEpoch+1);assert(api.valid(c));r.navigator.onLine=true;r.fbOnline=true;r.emit('sisventas:connection-restored');assert.equal(api.capture().connected,true);assert.equal(api.capture().connectionEpoch,c.connectionEpoch+2);
});
test('actual User replacement, role policy, view, readiness replacement or disposal retire old capture',()=>{
 for(const change of [r=>{r.fbAuth.currentUser={uid:'u'};},r=>{r.PERMISOS_ROLES.admin.indiceRevision++;},r=>{r.PERMISOS_ROLES.admin.extraAction=true;},r=>{r._impersonacionOriginal={};},r=>{r.SVDataReadiness={...r.SVDataReadiness};}]){const {r,api}=fixture(),c=api.capture();change(r);assert.equal(api.valid(c),false);}
 const {api}=fixture(),c=api.capture();api.dispose();assert.equal(api.valid(c),false);assert.equal(api.decision().kind,'denied');
});
test('domain grants follow existing policy and do not turn creator or commission labels into access',()=>{
 const {r,api,modules}=fixture();r.currentRole='vendedor';r.PERMISOS_ROLES.vendedor={indiceVersion:2,indiceRevision:2};const c=api.capture();assert.equal(c.grants.ventas,'own');assert.equal(c.grants.presupuestos,'own');assert.equal(c.grants.ordenes_trabajo,'all');modules.delete('agenda');assert.equal(api.capture().grants.ordenes_trabajo,null);assert.equal(api.valid(c),false);
});
test('real readiness reset retires a pending Source read while Auth and UID stay unchanged',async()=>{
 const {r,api}=fixture();let resolve,calls=0;const held=new Promise(done=>{resolve=done;}),payload={schema:2,uid:'u',role:'admin',permissionRevision:7,generation:'fixture',revision:1,counts:{active:1,converted:0,totalNonCancelled:1,conversionPercent:0}};
 const source=Source.create({capture:api.capture,valid:api.valid,readiness:r.SVDataReadiness,read:()=>++calls===1?held:Promise.resolve(payload)}),old=source.ensure().catch(error=>error);
 await Promise.resolve();assert.equal(calls,1);r.SVDataReadiness.reset();resolve(payload);assert.equal((await old).name,'AbortError');assert.equal(source.peek().data,null);assert.equal(await source.ensure(),payload);assert.equal(calls,2);assert.equal(r.SVDataReadiness.status(['dashboardBudgets']).ready,true);
});
