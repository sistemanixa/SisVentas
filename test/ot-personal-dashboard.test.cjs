'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const scope=require('../js/core/ot-personal-scope.js');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const nodes={},timers=[],calls={listeners:0,kpi:0,writes:0};let active='page-dashboard',success,failure;
 const node=id=>nodes[id]||(nodes[id]={id,innerHTML:'',textContent:'',style:{},classList:{contains:cls=>cls==='active'&&active===id}});
 node('dash-mis-ots');node('page-dashboard');node('page-ordentrabajo');
 const employee={fbKey:'employee-demo',nombre:'Técnico Ficticio'},c={window:null,console:{error(){}},Date,isAuthenticated:true,currentUserUid:'user-demo',currentUser:'login-tecnico',currentRole:'tecnico',fbAuth:{currentUser:{uid:'user-demo'}},PERMISOS_ROLES:{tecnico:{indiceRevision:2}},usuariosData:[{uid:'user-demo',empleadoFbKey:'employee-demo'}],empData:{e:employee},otData:[],fbDB:{},FB_PATHS:{ordenesTrabajo:'sisventas/ordenesTrabajo'},SVOTPersonalScope:scope,
  DASHBOARD_DATOS_REVISION:0,DASHBOARD_ULTIMA_REVISION:-1,DASHBOARD_RENDER_PROGRAMADO:false,document:{getElementById:id=>nodes[id]||null,querySelector:()=>nodes[active]||null},setTimeout:fn=>{timers.push(fn);return timers.length;},svFechaLocalISO:date=>date?[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'):'2026-10-20',svMesLocalISO:()=> '2026-10',tienePermiso:key=>key==='dashboard.misOT',svPuedeLeerDominio:()=>true,_chequearCambioHistCliente(){},fbRef:(_,p)=>p,fbOnValue:(_,ok,bad)=>{calls.listeners++;success=ok;failure=bad;},fbGet:()=>assert.fail('No agregar lecturas'),fbUpdate:()=>{calls.writes++;assert.fail('No modificar OT ni horas');},renderKPIsDashboard:()=>calls.kpi++,escapeHTML:value=>String(value||''),nombreClienteVigente:(o,fallback)=>o.cliente||fallback,_svResolverClienteRegistro:()=>null,notify(){},_gastosUnsubscribe:()=>{},invalidarCacheClientes(){},_otTarjeta:o=>'<article>'+o.id+'</article>'};
 c.window=c;load(c,['svEmpleadoPropio','_hsexEmpleadoActual','otOrdenesEmpleado','otEstadoNormalizado','otEstaCerrada','otEstadoParaMostrar','otBadge','otFechaEstadisticaISO','otFechaOperativaEstadistica','_hsexOTPendientesVencidas','renderDashMisOTs','marcarDashboardDatosSucios','solicitarRenderDashboard','svCapturarContextoOperacion','svReiniciarBanderasLectura','svActualizarCuentaTrasDatos','fbCargarOTs','_renderOTVistaTenico','renderOTTabla','dashFechaISO','dashDatosOTResumen']);
 return {c,calls,nodes,timers,node,employee,hide:()=>{active='page-ordentrabajo';},show:()=>{active='page-dashboard';},flush(){while(timers.length)timers.shift()();},deliver(records){success({val:()=>records});},fail(){failure(Error('Falla ficticia'));},get html(){return nodes['dash-mis-ots'].innerHTML;}};
}
const order=(id,extra={})=>({id,estado:'en_progreso',tecnicoFbKey:'employee-demo',tecnico:'Nombre antiguo',cliente:'Cliente ficticio '+id,fecha:'2026-10-01',...extra});

test('la entrega OT tardía actualiza la tarjeta personal desde el ciclo existente sin navegar ni consultar otra vez',()=>{
 const f=setup();f.c.renderDashMisOTs();assert.match(f.html,/Cargando tus órdenes/);assert.doesNotMatch(f.html,/No tenés/);
 f.c.fbCargarOTs();f.deliver({first:order('OT-DEMO-A'),second:order('OT-DEMO-B')});assert.match(f.html,/Cargando/);f.flush();
 assert.match(f.html,/OT-DEMO-A/);assert.match(f.html,/OT-DEMO-B/);assert.equal(f.calls.kpi,1);assert.equal(f.calls.listeners,1);assert.equal(f.calls.writes,0);
});

test('cierre con observaciones y reasignación retiran tarjetas con la segunda entrega del mismo listener',()=>{
 const f=setup();f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A'),b:order('OT-DEMO-B')});f.flush();
 f.deliver({a:order('OT-DEMO-A',{estado:'con_observaciones'}),b:order('OT-DEMO-B',{tecnicoFbKey:'other-employee',tecnico:'Técnico Ficticio'})});f.flush();
 assert.match(f.html,/No tenés OTs pendientes/);assert.doesNotMatch(f.html,/OT-DEMO-A|OT-DEMO-B/);assert.equal(f.calls.listeners,1);assert.equal(f.calls.writes,0);
});

test('snapshot vacío confirmado se distingue de carga pendiente y de un error',()=>{
 const f=setup();f.c.fbCargarOTs();f.deliver(null);f.flush();assert.match(f.html,/No tenés OTs pendientes/);
 f.fail();f.flush();assert.match(f.html,/No se pudieron cargar tus órdenes/);assert.doesNotMatch(f.html,/No tenés/);
 f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});f.flush();assert.match(f.html,/OT-DEMO-A/);
});

test('directorio y vínculo laboral pueden llegar después de las OT sin dejar la tarjeta vacía',()=>{
 const f=setup();f.c.usuariosData=[];f.c.empData={};f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});f.flush();assert.match(f.html,/Cargando/);
 f.c.usuariosData=[{uid:'user-demo',empleadoFbKey:'employee-demo'}];f.c.empData={e:f.employee};f.c._empleadosDatosListos=true;const previousKpi=f.calls.kpi;f.c.svActualizarCuentaTrasDatos();f.flush();assert.match(f.html,/OT-DEMO-A/);assert.equal(f.calls.listeners,1);assert.equal(f.calls.kpi,previousKpi);
});

test('un error de un KPI ajeno no impide actualizar primero las órdenes del técnico',()=>{
 const f=setup();f.c.renderKPIsDashboard=()=>{throw Error('KPI ficticio ajeno');};f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});assert.throws(()=>f.flush(),/KPI ficticio/);assert.match(f.html,/OT-DEMO-A/);assert.equal(f.calls.listeners,1);
});

for(const first of ['directory','profile'])test('OT cargadas esperan sin aviso falso cuando llega primero '+first,()=>{
 const f=setup();f.c.usuariosData=[];f.c.empData={};f.c._usuariosDatosListos=false;f.c._empleadosDatosListos=false;f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});f.flush();
 const receiveProfile=()=>{f.c.usuariosData=[{uid:'user-demo',empleadoFbKey:'employee-demo'}];f.c._usuariosDatosListos=true;},receiveDirectory=()=>{f.c.empData={e:f.employee};f.c._empleadosDatosListos=true;};
 (first==='directory'?receiveDirectory:receiveProfile)();f.c.svActualizarCuentaTrasDatos();assert.match(f.html,/Cargando/);assert.doesNotMatch(f.html,/No se encontró|No tenés/);
 (first==='directory'?receiveProfile:receiveDirectory)();f.c.svActualizarCuentaTrasDatos();assert.match(f.html,/OT-DEMO-A/);assert.equal(f.calls.listeners,1);
});

test('el administrador conserva el alcance global de métricas y resumen',()=>{
 const f=setup();f.c.currentRole='admin';f.c.tienePermiso=()=>true;f.c.otData=[order('OWN'),order('OTHER',{tecnicoFbKey:'other-employee'}),order('CLOSED',{estado:'con_observaciones'})];
 for(const id of ['ot-met-abiertas','ot-met-comp','ot-met-hoy','ot-vista-tecnico','ot-vista-admin'])f.node(id);
 let administrative=0;f.c._renderOTVistaAdmin=()=>administrative++;f.c.renderOTEstadisticas=()=>{};f.c.renderOTTabla();assert.equal(f.nodes['ot-met-abiertas'].textContent,2);assert.equal(f.nodes['ot-met-comp'].textContent,1);assert.equal(administrative,1);
 assert.deepEqual(Array.from(f.c.dashDatosOTResumen().abiertas,o=>o.id),['OWN','OTHER']);assert.equal(f.calls.writes,0);
});

test('el bloqueo conserva la frontera local: diez días no bloquean y once sí',()=>{
 const f=setup();f.c.otData=[order('TEN',{fecha:'2026-10-10'}),order('ELEVEN',{fecha:'2026-10-09'}),order('CLOSED',{fecha:'2026-10-01',estado:'con_observaciones'}),order('UNSCHEDULED',{fecha:'',createdAt:'2026-10-01'})];
 assert.deepEqual(Array.from(f.c._hsexOTPendientesVencidas(f.employee),o=>o.id).sort(),['ELEVEN','UNSCHEDULED']);assert.equal(f.calls.writes,0);
});

test('Dashboard, vista técnica, indicadores y bloqueo usan el mismo empleado y estados cerrados canónicos',()=>{
 const f=setup();f.c.otData=[order('OT-DEMO-A',{fbKey:'a'}),order('OT-DEMO-B',{fbKey:'b',fecha:'' ,createdAt:'2026-10-01'}),order('CLOSED',{estado:'Con observaciones',fechaCierre:'2026-10-19'}),order('FOREIGN',{tecnicoFbKey:'other-employee',tecnico:'Técnico Ficticio'})];f.c._otsDatosCargados=true;
 f.c.renderDashMisOTs();assert.match(f.html,/OT-DEMO-A/);assert.match(f.html,/OT-DEMO-B/);assert.doesNotMatch(f.html,/CLOSED|FOREIGN|con_observaciones/);
 assert.deepEqual(Array.from(f.c.dashDatosOTResumen().abiertas,o=>o.id),['OT-DEMO-A','OT-DEMO-B']);assert.deepEqual(Array.from(f.c._hsexOTPendientesVencidas(f.employee),o=>o.id).sort(),['OT-DEMO-A','OT-DEMO-B']);
 for(const id of ['ot-tec-atrasadas','ot-tec-atrasadas-box','ot-tec-hoy','ot-tec-hoy-box','ot-tec-pendientes','ot-tec-pendientes-box','ot-tec-vacia','ot-vista-tecnico','ot-vista-admin','ot-met-abiertas','ot-met-comp','ot-met-hoy'])f.node(id);
 f.c.renderOTTabla();assert.equal(f.nodes['ot-met-abiertas'].textContent,2);assert.equal(f.nodes['ot-met-comp'].textContent,1);assert.match(f.nodes['ot-tec-atrasadas'].innerHTML,/OT-DEMO-A/);assert.match(f.nodes['ot-tec-pendientes'].innerHTML,/OT-DEMO-B/);assert.equal(f.calls.writes,0);
});

test('nombre de acceso distinto y claves vacías legacy reconocen la asignación sin mostrar homónimos',()=>{
 const f=setup();f.c.otData=[order('EXPLICIT'),order('LEGACY',{tecnicoFbKey:'',tecnico:'  TECNICO  FICTICIO '})];f.c._otsDatosCargados=true;f.c.renderDashMisOTs();assert.match(f.html,/EXPLICIT/);assert.match(f.html,/LEGACY/);
 f.c.empData.other={fbKey:'other-employee',nombre:'Técnico Ficticio'};f.c.renderDashMisOTs();assert.match(f.html,/EXPLICIT/);assert.doesNotMatch(f.html,/LEGACY/);
});

test('una página oculta no se repinta; al volver usa los datos ya recibidos sin otra suscripción',()=>{
 const f=setup();f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});f.hide();f.flush();assert.equal(f.html,'');assert.equal(f.calls.kpi,0);
 f.show();f.c.solicitarRenderDashboard(true);f.flush();assert.match(f.html,/OT-DEMO-A/);assert.equal(f.calls.listeners,1);
});

for(const [label,change]of [['Auth',c=>{c.fbAuth.currentUser={uid:'user-demo'};}],['UID',c=>{c.currentUserUid='other-user';}],['rol',c=>{c.currentRole='admin';}],['permisos',c=>{c.PERMISOS_ROLES.tecnico.indiceRevision++;}],['sesión',c=>{c._svOperacionesSesionEpoch=1;}]])test('entrega programada no repinta al cambiar '+label,()=>{
 const f=setup();f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});change(f.c);f.flush();assert.equal(f.html,'');assert.equal(f.calls.kpi,0);
});

test('un trabajo antiguo no cancela el refresco de una sesión nueva con el mismo nombre',()=>{
 const f=setup();f.c.solicitarRenderDashboard(false);f.c.svReiniciarBanderasLectura();assert.equal(f.c._otsDatosCargados,false);assert.equal(f.c._otsCargaError,false);
 f.c.fbAuth.currentUser={uid:'user-demo'};f.c.fbCargarOTs();f.deliver({a:order('OT-DEMO-A')});f.flush();assert.match(f.html,/OT-DEMO-A/);assert.equal(f.calls.kpi,1);
});

test('vínculo ausente o permiso revocado no muestra un falso catálogo vacío ni OT ajenas',()=>{
 const f=setup();f.c._otsDatosCargados=true;f.c._empleadosDatosListos=true;f.c._usuariosDatosListos=true;f.c.usuariosData=[];f.c.renderDashMisOTs();assert.match(f.html,/empleado vinculado/);assert.doesNotMatch(f.html,/No tenés/);
 f.c.tienePermiso=()=>false;f.c.renderDashMisOTs();assert.equal(f.html,'');assert.equal(f.calls.listeners,0);assert.equal(f.calls.writes,0);
});

test('la selección y render conservan registros y horas existentes sin modificaciones',()=>{
 const f=setup();f.c.otData=[order('OT-DEMO-A'),order('CLOSED',{estado:'cerrada'})];f.c._otsDatosCargados=true;const before=JSON.stringify(f.c.otData);
 f.c.renderDashMisOTs();f.c._hsexOTPendientesVencidas(f.employee);f.c.dashDatosOTResumen();assert.equal(JSON.stringify(f.c.otData),before);assert.deepEqual(plain(f.c.otData),JSON.parse(before));assert.equal(f.calls.writes,0);
});
