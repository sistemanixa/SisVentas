'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

const deferred=['fbCargarEquipos','fbCargarInformes','fbCargarGarantias','fbCargarTickets','fbCargarRemitos','fbCargarAgenda','fbCargarServicios','fbCargarCaja'];
const names=['fbCargarUsuarios','fbCargarClientes','fbCargarProductos','fbCargarVentas','fbCargarClientesUnificados','fbCargarEmpleados','fbCargarCategorias','fbCargarGastos','fbCargarProveedores','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs','fbCargarOrdenes','cargarKits','spCargar',...deferred];
function environment(page='dashboard'){
 const calls=[],jobs=[];
 const c={window:null,currentUserUid:'sesion-ficticia',isAuthenticated:true,rolActualNormalizado:()=> 'admin',
  permisoModulo:()=>true,svPuedeLeerDominio:()=>true,_svPaginaDesdeRuta:()=>page,
  document:{querySelector:()=>({id:'page-'+page})},fbDB:{},svProgramarTrabajoFondo:fn=>jobs.push(fn)};
 c.window=c;
 for(const name of names)c[name]=()=>calls.push(name);
 // Vacaciones es una dependencia de su ruta, no una carga global del ingreso.
 c.fbCargarVacaciones=()=>calls.push('fbCargarVacaciones');
 load(c,['fbCargarTodo','svCargarDatosDePaginaActual','svActualizarLecturasPorAccion']);
 return {c,calls,jobs,runJobs(){while(jobs.length)jobs.shift()();}};
}

test('el ingreso no conecta ocho colecciones de pantallas sin visitar',()=>{
 const e=environment();assert.equal(e.c.fbCargarTodo(),true);e.runJobs();
 for(const name of deferred)assert.ok(!e.calls.includes(name),'No iniciar '+name+' desde Dashboard');
 assert.ok(!e.calls.includes('fbCargarVacaciones'),'No tratar la fuente de la ruta Vacaciones como dependencia global');
 for(const name of names.filter(n=>!deferred.includes(n)&&!['cargarKits','spCargar'].includes(n)))assert.ok(e.calls.includes(name),'Conservar dependencia global '+name);
 const count=e.calls.length;assert.equal(e.c.fbCargarTodo(),false);e.runJobs();assert.equal(e.calls.length,count);
});

test('cada pantalla inicia sus fuentes al navegar después del ingreso',()=>{
 const cases={equipos:['fbCargarEquipos','fbCargarClientes','fbCargarEmpleados'],informes:['fbCargarInformes','fbCargarClientes','fbCargarEmpleados'],
  garantias:['fbCargarGarantias','fbCargarEquipos','fbCargarClientes','fbCargarVentas','fbCargarProductos'],soporte:['spCargar','fbCargarClientes','fbCargarOTs','fbCargarVentas','fbCargarEmpleados'],
  remitos:['fbCargarRemitos','fbCargarClientes'],agenda:['fbCargarAgenda','fbCargarOTs'],
  servicios:['fbCargarServicios','fbCargarClientes'],caja:['fbCargarCaja'],vacaciones:['fbCargarEmpleados','fbCargarVacaciones']};
 for(const [page,expected] of Object.entries(cases)){
  const e=environment();e.c._fbCargaTodoActiva=true;e.c.svActualizarLecturasPorAccion(page);
  for(const name of expected)assert.ok(e.calls.includes(name),page+' requiere '+name);
  for(const name of deferred.filter(n=>!expected.includes(n)))assert.ok(!e.calls.includes(name),page+' no requiere '+name);
 }
});

test('la ruta directa prioriza su colección antes de ejecutar trabajos diferidos',()=>{
 const e=environment('informes');e.c.fbCargarTodo();
 assert.ok(e.calls.includes('fbCargarInformes'));assert.ok(!e.calls.includes('fbCargarEquipos'));
});

test('la ruta directa de Vacaciones inicia su fuente antes de los trabajos diferidos',()=>{
 const e=environment('vacaciones');assert.equal(e.c.fbCargarTodo(),true);
 assert.ok(e.calls.includes('fbCargarVacaciones'));assert.ok(e.calls.includes('fbCargarEmpleados'));
 assert.equal(e.calls.filter(name=>name==='fbCargarVacaciones').length,1);
 assert.ok(!e.calls.includes('fbCargarEquipos'));assert.ok(!e.calls.includes('fbCargarInformes'));
 e.runJobs();assert.equal(e.calls.filter(name=>name==='fbCargarVacaciones').length,1);
});

test('la página activa cubre el arranque sin hash',()=>{
 const e=environment('equipos');e.c._svPaginaDesdeRuta=()=>'';e.c.fbCargarTodo();
 assert.ok(e.calls.includes('fbCargarEquipos'));
});

test('el historial del cliente conserva sus fuentes cruzadas al entrar directamente',()=>{
 const e=environment('historialcliente');e.c.fbCargarTodo();
 for(const name of ['fbCargarClientes','fbCargarVentas','fbCargarPagos','fbCargarPresupuestos','fbCargarOTs','fbCargarEquipos','fbCargarTickets'])assert.ok(e.calls.includes(name),name);
 assert.ok(!e.calls.includes('fbCargarInformes'));assert.ok(!e.calls.includes('fbCargarCaja'));
});

test('la navegación no adelanta cargas antes de resolver el arranque ni abre páginas bloqueadas',()=>{
 const e=environment();e.c.svActualizarLecturasPorAccion('equipos');assert.deepEqual(e.calls,[]);
 e.c._fbCargaTodoActiva=true;e.c.permisoModulo=()=>false;e.c.svActualizarLecturasPorAccion('equipos');assert.deepEqual(e.calls,[]);
 e.c.permisoModulo=()=>true;e.c.isAuthenticated=false;e.c.svActualizarLecturasPorAccion('equipos');assert.deepEqual(e.calls,[]);
});

test('Compras y OT conservan cargadores distintos y sus referencias comerciales',()=>{
 const e=environment('ordenes');e.c.svCargarDatosDePaginaActual();
 assert.ok(e.calls.includes('fbCargarOrdenes'));assert.ok(!e.calls.includes('fbCargarOTs'));
 const o=environment('ordentrabajo');o.c.svCargarDatosDePaginaActual();
 assert.ok(o.calls.includes('fbCargarOTs'));assert.ok(!o.calls.includes('fbCargarOrdenes'));
});

test('roles externos o desconocidos no inician cargas aunque exista conexión',()=>{
 for(const role of ['', 'inventado','compras_paraguay','distribuidora']){
  const e=environment();e.c.rolActualNormalizado=()=>role;
  assert.equal(e.c.fbCargarTodo(),false);e.runJobs();assert.deepEqual(e.calls,[]);
 }
});

test('la navegación mantiene la vía existente de Usuarios sin reiniciar su directorio',()=>{
 const e=environment('usuarios');e.c._fbCargaTodoActiva=true;e.c.svActualizarLecturasPorAccion('usuarios');
 assert.deepEqual(e.calls,[]);
});

test('las cargas compartidas conservan los avisos operativos sin abrir las colecciones diferidas',()=>{
 const e=environment(),events=[];
 Object.assign(e.c,{pptoData:[],otData:[],gastosData:[],todasNotifs:[],console,
  tienePermiso:()=>true,NOTIF_CONFIG:{ppto_vence_2:{activo:true},ppto_sin_resp:{activo:true},deuda_30:{activo:true},deuda_15:{activo:true},ot_sin_tecnico:{activo:true},ot_hoy:{activo:true}},
  _pptoAdmiteAvisosNotificacion:()=>true,_pptoPerteneceAlUsuarioActual:()=>false,
  _fechaCalendarioLocal:()=>null,_fechaEsDia:()=>false,
  normalizarEstadoGasto:g=>g.estado,gastoVisibleEnModuloGastos:()=>true,
  renderNotificaciones(){},actualizarBadgeNotif(){},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  _notificacionesHsExtraPendientes:[{id:'HE-FICTICIA',empNombre:'Persona ficticia',horas:2,mes:'2026-10'}]});
 e.c.document.dispatchEvent=event=>events.push(event);
 e.c.fbCargarPresupuestos=()=>{e.calls.push('fbCargarPresupuestos');e.c.pptoData=[{id:'PP-FICTICIO',estado:'revision',cliente:'Cliente ficticio'}];};
 e.c.fbCargarOTs=()=>{e.calls.push('fbCargarOTs');e.c.otData=[{id:'OT-FICTICIA',estado:'pendiente',cliente:'Cliente ficticio',tecnico:'Sin asignar'}];};
 e.c.fbCargarGastos=()=>{e.calls.push('fbCargarGastos');e.c.gastosData=[{fbKey:'GASTO-FICTICIO',estado:'pendiente_aprobacion',empleadoNombre:'Persona ficticia'}];};
 load(e.c,['generarNotificaciones']);e.c.fbCargarTodo();e.runJobs();e.c.generarNotificaciones();
 assert.deepEqual(Array.from(e.c.todasNotifs,n=>n.tipo).sort(),['gasto','hsextra','ot','presupuesto']);
 assert.equal(events.at(-1).detail.total,4);
 for(const name of deferred)assert.ok(!e.calls.includes(name));
});

function listeningEnvironment(){
 const callbacks={},errors={},opens=[],rendered=[];
 const c=environment().c;
 Object.assign(c,{console:{error(){}},equiposData:[],garantiasRegistradasData:[],
  fbRef:(_,path)=>path,fbOnValue:(path,fn,error)=>{opens.push(path);callbacks[path]=fn;errors[path]=error;return ()=>{};},
  renderEquiposCards(){},actualizarMetricasEquipos(){},refrescarHistorialClienteLectura(){},
  renderGarantiasUnificadas(){rendered.push(c._listaGarantiasUnificada().map(row=>row.serie).sort());}});
 c._dashHorasPropias=null;
 load(c,['_suscribirModuloUnaVez','svDetenerEscuchasModulo','svLimpiarHorasPersonalesDashboard','fbCargarEquipos','fbCargarGarantias',
  '_garantiaFechaLocal','_garantiaVencimientoEquipo','_garantiaFechaISO','_garantiaClaveComparable','_garantiasDesdeEquipos','_listaGarantiasUnificada']);
 return {c,opens,rendered,send(path,data){callbacks['sisventas/'+path]({val:()=>data});},fail(path){errors['sisventas/'+path](new Error('Fallo ficticio'));}};
}

for(const order of [['equipos','garantias'],['garantias','equipos']])test('Garantías integra callbacks diferidos en orden '+order.join(' → '),()=>{
 const e=listeningEnvironment();e.c.svCargarDatosDePaginaActual('garantias');
 const data={equipos:{e1:{descripcion:'Cámara ficticia',serie:'SERIE-E',fechaInstalacion:'2026-10-01',garantiaMeses:12}},
  garantias:{g1:{equipo:'Router ficticio',serie:'SERIE-G',fechaInst:'2026-10-01',fechaVenc:'2027-10-01'}}};
 for(const name of order)e.send(name,data[name]);
 assert.deepEqual(Array.from(e.rendered.at(-1)),['SERIE-E','SERIE-G']);
 const count=e.opens.length;e.c.svCargarDatosDePaginaActual('garantias');assert.equal(e.opens.length,count,'No duplicar suscripciones al volver');
});

test('un error de suscripción se recupera al reintentar la pantalla sin duplicar la otra fuente',()=>{
 const e=listeningEnvironment();e.c.svCargarDatosDePaginaActual('garantias');e.fail('equipos');
 e.c.svCargarDatosDePaginaActual('garantias');
 assert.equal(e.opens.filter(p=>p==='sisventas/equipos').length,2);assert.equal(e.opens.filter(p=>p==='sisventas/garantias').length,1);
});

test('cerrar sesión cancela las callbacks tardías de las nuevas pantallas a demanda',()=>{
 const e=listeningEnvironment();e.c.svCargarDatosDePaginaActual('garantias');e.c.svDetenerEscuchasModulo();
 e.send('equipos',{e1:{serie:'No debe llegar'}});e.send('garantias',{g1:{serie:'No debe llegar'}});
 assert.equal(e.c.equiposData.length,0);assert.equal(e.c.garantiasRegistradasData.length,0);assert.equal(e.rendered.length,0);
});
