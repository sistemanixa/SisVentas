'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{functionSource}=require('./helpers/app-functions.cjs');
function fixture(){let creates=0,reads=0,paint=0,notices=0,page='dashboard',changed;const host={claimed:k=>k==='notices',ensure:k=>{assert.equal(k,'notices');reads++;return Promise.resolve();}};
 const r={SV_DASHBOARD_READS_LOCAL:true,SV_BUDGET_NOTICES_LOCAL:true,SVDashboardBudgetHost:{create:(root,options)=>{assert.equal(root,r);creates++;changed=options.changed;return host;}}};
 const s={window:r,_svEsPaginaActiva:p=>p===page,svPintarPresupuestosDashboard:()=>paint++,verificarVencimientosPptos:()=>{},generarNotificaciones:()=>notices++};vm.createContext(s);for(const fn of ['svHostPresupuestosDashboard','svCargarAvisosPresupuestosDemandados'])vm.runInContext(functionSource(fn),s);
 return {r,s,stats:()=>({creates,reads,paint,notices}),change:k=>changed(k),page:p=>page=p};}
test('actual host callpoint remains OFF without construction or demand',()=>{const f=fixture();f.r.SV_DASHBOARD_READS_LOCAL=false;assert.equal(f.s.svHostPresupuestosDashboard(),null);assert.equal(f.s.svCargarAvisosPresupuestosDemandados(),false);assert.equal(f.stats().creates,0);});
test('actual explicit notice demand reuses host and changed callbacks only repaint the visible consumer',async()=>{const f=fixture();f.s.svHostPresupuestosDashboard();f.s.svHostPresupuestosDashboard();assert.equal(f.stats().creates,1);assert.equal(f.stats().reads,0);await f.s.svCargarAvisosPresupuestosDemandados();assert.equal(f.stats().reads,1);f.change('dashboard');assert.equal(f.stats().paint,1);f.change('notices');assert.equal(f.stats().notices,0);f.page('notificaciones');f.change('notices');assert.equal(f.stats().notices,1);f.change('dashboard');assert.equal(f.stats().paint,1);assert.equal(f.stats().reads,1);});
test('actual startup explicitly demands the summary outside rendering and keeps normal sources separate',()=>{
 let requested=0,starts=0;const f=fixture();f.r.SVDashboardBudgetHost.create=()=>({claimed:k=>k==='dashboard',ensure:k=>{assert.equal(k,'dashboard');requested++;return Promise.resolve();}});
 f.s.svPlanInicioDashboard=()=>({sources:[]});f.s.svCapturarContextoCargaDashboard=()=>({});f.r.SVDashboardStartupDemand={create:()=>({start:()=>{starts++;return [];}})};
 for(const name of ['fbCargarUsuarios','fbCargarClientes','fbCargarClientesUnificados','fbCargarProductos','fbCargarVentas','fbCargarEmpleados','fbCargarGastos','fbCargarProveedores','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs'])f.s[name]=()=>assert.fail('unselected source');
 vm.runInContext(functionSource('svCargarInicioDashboardDemandado'),f.s);f.s.svCargarInicioDashboardDemandado();assert.equal(requested,1);assert.equal(starts,1);
 f.r.SV_DASHBOARD_READS_LOCAL=false;f.s.svCargarInicioDashboardDemandado();assert.equal(requested,1);assert.equal(starts,2);
});
test('actual activity host callpoint is lazy, reuses its slot and paints only the visible Dashboard',()=>{
 const f=fixture();let creates=0,paint=0,changed;const host={};f.r.SVDashboardActivityHostFactory={create:(root,options)=>{assert.equal(root,f.r);creates++;changed=options.changed;return host;}};f.r.dashRenderActividadReciente=()=>paint++;
 vm.runInContext(functionSource('svHostActividadDashboard'),f.s);f.r.SV_DASHBOARD_READS_LOCAL=false;assert.equal(f.s.svHostActividadDashboard(),null);assert.equal(creates,0);f.r.SV_DASHBOARD_READS_LOCAL=true;assert.equal(f.s.svHostActividadDashboard(),host);assert.equal(f.s.svHostActividadDashboard(),host);assert.equal(creates,1);changed();assert.equal(paint,1);f.page('venta');changed();assert.equal(paint,1);
});
test('actual startup demands the personal host for miActividad without granting global activity actions',()=>{
 const f=fixture();let reads=0;f.r.tienePermiso=a=>a==='dashboard.miActividad';f.s.svHostActividadDashboard=()=>({ensure:()=>{reads++;return Promise.resolve();}});f.s.svPlanInicioDashboard=()=>({sources:[]});f.s.svCapturarContextoCargaDashboard=()=>({});f.r.SVDashboardStartupDemand={create:()=>({start:()=>[]})};
 for(const name of ['fbCargarUsuarios','fbCargarClientes','fbCargarClientesUnificados','fbCargarProductos','fbCargarVentas','fbCargarEmpleados','fbCargarGastos','fbCargarProveedores','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs'])f.s[name]=()=>assert.fail('unselected source');
 vm.runInContext(functionSource('svCargarInicioDashboardDemandado'),f.s);f.s.svCargarInicioDashboardDemandado();assert.equal(reads,1);assert.equal(f.r.tienePermiso('dashboard.actividad'),false);assert.equal(f.r.tienePermiso('interfaz.dashboard_admin_only'),false);f.r.tienePermiso=()=>false;f.s.svCargarInicioDashboardDemandado();assert.equal(reads,1);
});
