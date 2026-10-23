const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

function setup(){
 const elements={},presence=[],subscriptions=[],writes=[],page={id:'page-dashboard'};
 for(const id of ['dash-micuenta-card','dash-historial-mes-card','dash-historial-mes-body','ctaemp-base'])elements[id]={style:{},textContent:''};
 const element=id=>{
  if(id.startsWith('page-'))return {classList:{contains:name=>name==='active'&&id===page.id}};
  if(id==='ctaemp-migracion-banner')return null;
  if(id.startsWith('ctaemp-')&&!elements[id])elements[id]={style:{},textContent:'',innerHTML:'',value:'',dataset:{}};
  return elements[id]||null;
 };
 const rejectWrite=(...args)=>{writes.push(args);assert.fail('Ver como y consultar la cuenta no escriben');};
 const user={uid:'admin-auth'};
 const c={isAuthenticated:true,currentUserUid:'admin-auth',currentUser:'Admin',currentRole:'admin',currentUserEmail:'admin@fixture.invalid',
  empData:{a:{fbKey:'a'},b:{fbKey:'b'},own:{fbKey:'own'}},ctaEmpActual:null,movsEmpData:[],
  gastosData:[],_gastosUnsubscribe:null,_gastosDataReady:false,_gastosCargaError:'',_gastosPagosCache:null,_gastosFechaImputacionCache:null,
  _dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosGeneracion:0,_dashAvisosOrigen:null,_dashAvisosRetorno:null,_dashHorasPropias:null,
  document:{hidden:false,getElementById:element,querySelector:selector=>selector==='.page.active'?page:null},
  limpiarPresenciaOnline(){presence.push({action:'clear',user:c.currentUser,role:c.currentRole});},registrarPresenciaOnline(){presence.push({action:'start',user:c.currentUser,role:c.currentRole});},
  notify(){},chatCerrar(){},applyRole(){},_actualizarCabeceraSesion(){},_mostrarBannerImpersonacion(){},
  chatActualizarBadges(){},aplicarVisibilidadBotonesFlotantes(){},showPage(name){page.id='page-'+name;},
  _normalizarRolUsuarioSistema:r=>r,_emailUsuarioSistema:u=>u.mail||'',
  permisoModulo:()=>true,svPuedeLeerDominio:()=>false,escapeHTML:String,
  _paginaGastosActiva:()=>false,_actualizarBadgeSolicitudesGastos(){},_programarTareasSecundariasGastos(){},actualizarTarjetaComisionadosVenta(){},marcarDashboardDatosSucios(){},solicitarRenderDashboard(){},
  renderComisionesDelMes(){},renderMovsEmp(){c.renderedAccounts=(c.renderedAccounts||0)+1;},
  window:{fbAuth:{currentUser:user},fbDB:{},tienePermiso:key=>key==='usuarios.impersonar'||key==='dashboard.miCuenta',
   fbRef:(_db,path)=>path,fbOrderByChild:field=>({field}),fbEqualTo:value=>({value}),fbQuery:(path,field,value)=>({path,...field,...value}),
   fbOnValue:(ref,next,error)=>{const item={ref,next,error,path:typeof ref==='string'?ref:ref.path,stops:0};subscriptions.push(item);return()=>{item.stops++;};},
   fbSet:rejectWrite,fbUpdate:rejectWrite,fbPush:rejectWrite,fbRemove:rejectWrite,fbRunTransaction:rejectWrite,
   usuariosData:[{fbKey:'admin',uid:'admin-auth',empleadoFbKey:'own'},{fbKey:'u-a',uid:'auth-a',rol:'tecnico',empleadoFbKey:'a'},
    {fbKey:'u-b',uid:'auth-b',rol:'tecnico',empleadoFbKey:'b'}]},console};
 load(c,['svCapturarContextoOperacion','svContextoAvisosCuenta','svRenderAvisosCuentaPersonal','svLimpiarAvisosCuentaPersonal','svCancelarRetornoAvisoCuentaPersonal','svLimpiarHorasPersonalesDashboard',
  '_svEsPaginaActiva','svCtaEmpVisible','svCapturarContextoLecturaCtaEmp','svMostrarEstadoLecturaCtaEmp','svDetenerLecturaCtaEmp','svCrearOrigenGastosCuenta','svOrigenGastosCompatible','svMarcarSnapshotGastosCuenta',
  'svRepintarCtaEmpDesdeFuentes','svAplicarCtaEmpDesdeSnapshot','_ctaEmpMovimientoLegacyDuplicadoPorGasto','_ctaEmpActualizarBannerDuplicadosLegacy','_svSuscribirGastos','fbCargarGastos',
  'svEmpleadoPropio','limpiarCtaEmpSinSeleccion','svLimpiarVistaCuentaPersonal','iniciarImpersonacionUsuario','finalizarImpersonacionUsuario']);
 function deliverGastos(data){
  for(const row of subscriptions.filter(row=>row.path==='sisventas/gastos')){
   const value=Object.fromEntries(Object.entries(data).filter(([,g])=>g[row.ref.field]===row.ref.value));row.next({val:()=>structuredClone(value)});
  }
 }
 return {c,elements,user,presence,subscriptions,writes,deliverGastos};
}

test('Ver como selecciona el vínculo explícito de cada usuario y conserva Auth y UID administrador',()=>{
 const {c,user}=setup();
 for(const [key,employee]of [['u-a','a'],['u-b','b'],['u-a','a']]){
  c.iniciarImpersonacionUsuario(key);
  assert.equal(c.svEmpleadoPropio().fbKey,employee);
  assert.equal(c.currentUserUid,'admin-auth');
  assert.equal(c.window.fbAuth.currentUser,user);
 }
 c.finalizarImpersonacionUsuario();
 assert.equal(c.currentRole,'admin');assert.equal(c.svEmpleadoPropio().fbKey,'own');
 assert.equal(c.window._impersonacionOriginal,null);
});

test('Una vista incompleta, ajena al actor o sin vínculo no usa la cuenta del administrador como respaldo',()=>{
 const {c}=setup();
 for(const view of [{role:'tecnico',uid:'admin-auth',usuarioFbKey:'u-a'},
  {role:'admin',uid:'otro',usuarioFbKey:'u-a'},{role:'admin',uid:'admin-auth'},
  {role:'admin',uid:'admin-auth',usuarioFbKey:'inexistente'}]){
  c.window._impersonacionOriginal=view;assert.equal(c.svEmpleadoPropio(),null);
 }
 c.window.usuariosData.push({fbKey:'sin-vinculo',nombre:'Persona',mail:'admin@fixture.invalid'});
 c.window._impersonacionOriginal={role:'admin',uid:'admin-auth',usuarioFbKey:'sin-vinculo'};
 assert.equal(c.svEmpleadoPropio(),null);
 c.window.usuariosData.push({fbKey:'u-a',empleadoFbKey:'b'});
 c.window._impersonacionOriginal.usuarioFbKey='u-a';assert.equal(c.svEmpleadoPropio(),null);
});

test('Cada cambio de vista renueva su contexto y limpia listener, movimientos e historial previo',()=>{
 const {c,elements}=setup();let closed=0;
 c.window._ctaEmpUnsubscribe=()=>closed++;c.movsEmpData=[{monto:1}];c.ctaEmpActual='own';
 elements['dash-historial-mes-body'].textContent='cuenta anterior';
 c.iniciarImpersonacionUsuario('u-a');const first=c.window._impersonacionOriginal;
 assert.equal(closed,1);assert.equal(c.ctaEmpActual,null);assert.equal(c.movsEmpData.length,0);
 assert.equal(elements['dash-historial-mes-body'].textContent,'');
 assert.equal(elements['dash-micuenta-card'].style.display,'none');
 c.iniciarImpersonacionUsuario('u-b');c.iniciarImpersonacionUsuario('u-a');
 assert.notEqual(c.window._impersonacionOriginal,first);
 c.finalizarImpersonacionUsuario();assert.equal(elements['dash-historial-mes-card'].style.display,'none');
});

for(const mode of ['otra vista','volver al administrador','otra sesión']){
 test('Dashboard descarta respuesta tardía después de '+mode,async()=>{
  const {c,elements}=setup();let release,requested;
  c.window.fbRef=(_,path)=>path;c.window.fbGet=path=>{requested=path;return new Promise(resolve=>release=resolve);};
  load(c,['renderDashMiCuenta']);c.iniciarImpersonacionUsuario('u-a');c.renderDashMiCuenta();
  assert.equal(requested,'sisventas/ctaemp/a');
  if(mode==='otra vista')c.iniciarImpersonacionUsuario('u-b');
  if(mode==='volver al administrador')c.finalizarImpersonacionUsuario();
  if(mode==='otra sesión')c.currentUserUid='otra-sesion';
  elements['dash-historial-mes-body'].textContent='vista nueva';
  release({val(){assert.fail('No procesar la cuenta anterior');}});
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(elements['dash-historial-mes-body'].textContent,'vista nueva');
 });
}

test('Un fallo tardío de Dashboard no oculta la cuenta de la vista siguiente',async()=>{
 const {c,elements}=setup();let reject;
 c.window.fbRef=(_,path)=>path;c.window.fbGet=()=>new Promise((_,fail)=>reject=fail);
 load(c,['renderDashMiCuenta']);c.iniciarImpersonacionUsuario('u-a');c.renderDashMiCuenta();
 c.iniciarImpersonacionUsuario('u-b');elements['dash-micuenta-card'].style.display='';
 reject(Error('offline'));for(let i=0;i<5;i++)await Promise.resolve();
 assert.equal(elements['dash-micuenta-card'].style.display,'');
});

test('Mi cuenta consulta el empleado seleccionado y rechaza snapshots de otra vista con el mismo Auth',()=>{
 const {c,subscriptions,writes,deliverGastos}=setup();let listener,requested;
 const register=c.window.fbOnValue;
 c.window.fbOnValue=(ref,next,error)=>{if(typeof ref==='string'&&ref.startsWith('sisventas/ctaemp/')){requested=ref;listener=next;}return register(ref,next,error);};
 load(c,['cargarCtaEmp']);c.iniciarImpersonacionUsuario('u-a');
 c.showPage('ctaemp');c.fbCargarGastos();deliverGastos({});
 // Se entrega una fuente Gastos autorizada antes de comprobar la proyección CTA.
 c.empData.a={fbKey:'a'};c.CARGOS_DATA={};c.ctaEmpPesos=String;c.renderComisionesDelMes=()=>{};
 c.cargarCtaEmp('a');assert.equal(requested,'sisventas/ctaemp/a');
 const legacy={tipo:'comision',monto:123.45,estado:'pagado_parcial',montoPagado:50,pagos:{p:{monto:50,fecha:'2026-10-12'}}};
 listener({val:()=>({old:structuredClone(legacy)})});
 assert.equal(c.window._ctaEmpLectura.status,'ready');assert.equal(c.window._ctaEmpGastosSnapshot.valid(),true);assert.equal(c.renderedAccounts,1);
 assert.deepEqual(JSON.parse(JSON.stringify(c.movsEmpData)),[{fbKey:'old',_fuente:'ctaemp',...legacy}]);
 const reads=subscriptions.filter(row=>row.path.startsWith('sisventas/ctaemp/'));assert.equal(reads.length,1);
 c.cargarCtaEmp('b');assert.equal(subscriptions.filter(row=>row.path.startsWith('sisventas/ctaemp/')).length,1);
 c.iniciarImpersonacionUsuario('u-b');
 listener({val(){assert.fail('Snapshot cancelado de otra vista');}});
 assert.equal(c.movsEmpData.length,0);assert.equal(c.currentUserUid,'admin-auth');assert.equal(reads[0].stops,1);assert.deepEqual(writes,[]);
});

test('Ver como retira presencia antes de cambiar actor y la restaura después de recuperar Admin',()=>{const {c,presence}=setup();c.iniciarImpersonacionUsuario('u-a');assert.deepEqual(presence,[{action:'clear',user:'Admin',role:'admin'}]);c.finalizarImpersonacionUsuario();assert.deepEqual(presence.at(-1),{action:'start',user:'Admin',role:'admin'});});
