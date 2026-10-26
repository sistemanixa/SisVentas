'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const Demand=require('../js/core/dashboard-startup-demand.v1.js');
function fixture(){
 const handlers={},reads=[],user={uid:'fixture'},allowed=new Set(['dashboard.miCuenta']);
 const c={window:null,currentUserUid:'fixture',currentRole:'tecnico',isAuthenticated:true,fbAuth:{currentUser:user},
  PERMISOS_ROLES:{tecnico:{indiceRevision:1,acciones:{dashboard:{miCuenta:true}}}},
  document:{hidden:false,querySelector:()=>({id:'page-dashboard'}),addEventListener:(e,fn)=>{(handlers[e]||=[]).push(fn);}},
  SVForegroundSession:{isVisible:()=>!c.document.hidden},_svPaginaDesdeRuta:()=> 'dashboard',
  permisoModulo:()=>true,rolActualNormalizado:()=>c.currentRole,tienePermiso:a=>allowed.has(a),svPuedeLeerDominio:()=>true,
  SVDashboardStartupDemand:Demand};c.window=c;
 for(const name of ['fbCargarUsuarios','fbCargarClientes','fbCargarClientesUnificados','fbCargarProductos','fbCargarVentas','fbCargarEmpleados','fbCargarGastos','fbCargarProveedores','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs'])c[name]=()=>reads.push(name);
 load(c,['svCapturarContextoCargaDashboard','svPlanInicioDashboard','svCargarInicioDashboardDemandado','svInicioNecesitaAuxiliar']);
 return {c,reads,allowed,event:name=>(handlers[name]||[]).forEach(fn=>fn())};
}
test('capture identity is stable without new sources while context is unchanged',()=>{const f=fixture(),a=f.c.svCapturarContextoCargaDashboard();assert.equal(f.c.svCapturarContextoCargaDashboard(),a);assert.deepEqual(f.reads,[]);});
for(const field of ['auth','uid','role','revision','permission','epoch','dataEpoch','view','route','visible'])test('capture retires identity after '+field,()=>{
 const f=fixture(),c=f.c,a=c.svCapturarContextoCargaDashboard();
 if(field==='auth')c.fbAuth.currentUser={uid:'fixture'};
 if(field==='uid')c.currentUserUid='other';
 if(field==='role')c.currentRole='vendedor';
 if(field==='revision')c.PERMISOS_ROLES.tecnico.indiceRevision++;
 if(field==='permission')c.PERMISOS_ROLES.tecnico.acciones.dashboard.miCuenta=false;
 if(field==='epoch')c._svOperacionesSesionEpoch=1;
 if(field==='dataEpoch')c._svDataEpoch=1;
 if(field==='view')c._impersonacionOriginal={usuarioFbKey:'other'};
 if(field==='route')c._svPaginaDesdeRuta=()=> 'productos';
 if(field==='visible')c.document.hidden=true;
 assert.notEqual(c.svCapturarContextoCargaDashboard(),a);assert.deepEqual(f.reads,[]);
});
for(const name of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange'])test('event '+name+' retires scheduler without opening reads',()=>{const f=fixture();f.c.svCapturarContextoCargaDashboard();let retired=0;f.c._svDashboardDemandReader={retire(){retired++;}};f.event(name);assert.equal(retired,1);assert.deepEqual(f.reads,[]);assert.equal(f.c._svDashboardDemandContextCache.scope,null);});
test('real demand helper joins repeated paints and preserves own identity/account sources',()=>{const f=fixture();f.c.svCargarInicioDashboardDemandado();f.c.svCargarInicioDashboardDemandado();assert.deepEqual(f.reads,['fbCargarUsuarios','fbCargarEmpleados','fbCargarGastos']);});
test('metrics and price health are distinct permissions, not hardcoded roles',()=>{const f=fixture();f.allowed.clear();f.allowed.add('dashboard.metricasGlobales');let plan=f.c.svPlanInicioDashboard();assert.ok(!plan.sources.includes('productos'));f.c.PERMISOS_ROLES.tecnico.indiceRevision++;f.allowed.add('dashboard.indicadoresPrecios');plan=f.c.svPlanInicioDashboard();assert.ok(plan.sources.includes('productos'));assert.ok(plan.sources.includes('proveedores'));});
test('recent movements need both actual activity permission and its interface control',()=>{const f=fixture();f.allowed.clear();f.allowed.add('dashboard.actividad');assert.ok(!f.c.svPlanInicioDashboard().selected.consumers.includes('recentActivity'));f.c.PERMISOS_ROLES.tecnico.indiceRevision++;f.allowed.add('interfaz.dashboard_admin_only');const p=f.c.svPlanInicioDashboard();assert.ok(p.selected.consumers.includes('recentActivity'));assert.ok(p.sources.includes('pagos'));});
test('own identity with mismatched Auth never opens sources',()=>{const f=fixture();f.c.fbAuth.currentUser={uid:'other'};f.c.svCargarInicioDashboardDemandado();assert.deepEqual(f.reads,[]);});
