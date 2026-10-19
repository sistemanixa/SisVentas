const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

function setup(){
 const elements={},presence=[];
 for(const id of ['dash-micuenta-card','dash-historial-mes-card','dash-historial-mes-body','ctaemp-base'])elements[id]={style:{},textContent:''};
 const user={uid:'admin-auth'};
 const c={currentUserUid:'admin-auth',currentUser:'Admin',currentRole:'admin',currentUserEmail:'admin@fixture.invalid',
  empData:{a:{fbKey:'a'},b:{fbKey:'b'},own:{fbKey:'own'}},ctaEmpActual:null,movsEmpData:[],
  document:{getElementById:id=>elements[id]||null,querySelector:()=>null},
  limpiarPresenciaOnline(){presence.push({action:'clear',user:c.currentUser,role:c.currentRole});},registrarPresenciaOnline(){presence.push({action:'start',user:c.currentUser,role:c.currentRole});},
  notify(){},chatCerrar(){},applyRole(){},_actualizarCabeceraSesion(){},_mostrarBannerImpersonacion(){},
  chatActualizarBadges(){},aplicarVisibilidadBotonesFlotantes(){},showPage(){},
  _normalizarRolUsuarioSistema:r=>r,_emailUsuarioSistema:u=>u.mail||'',
  window:{fbAuth:{currentUser:user},fbDB:{},tienePermiso:key=>key==='usuarios.impersonar'||key==='dashboard.miCuenta',
   usuariosData:[{fbKey:'admin',uid:'admin-auth',empleadoFbKey:'own'},{fbKey:'u-a',uid:'auth-a',rol:'tecnico',empleadoFbKey:'a'},
    {fbKey:'u-b',uid:'auth-b',rol:'tecnico',empleadoFbKey:'b'}]},console};
 load(c,['svEmpleadoPropio','limpiarCtaEmpSinSeleccion','svLimpiarVistaCuentaPersonal','iniciarImpersonacionUsuario','finalizarImpersonacionUsuario']);
 return {c,elements,user,presence};
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
 const {c}=setup();let listener,requested;
 c.window.fbRef=(_,path)=>path;c.window.fbOnValue=(path,next)=>{requested=path;listener=next;return ()=>{};};
 load(c,['cargarCtaEmp']);c.iniciarImpersonacionUsuario('u-a');
 // No hace falta cargo para comprobar el destino y la protección de la lectura.
 c.empData.a={fbKey:'a'};c.CARGOS_DATA={};c.ctaEmpPesos=String;c.renderComisionesDelMes=()=>{};
 c.cargarCtaEmp('a');assert.equal(requested,'sisventas/ctaemp/a');
 c.iniciarImpersonacionUsuario('u-b');
 listener({val(){assert.fail('Snapshot cancelado de otra vista');}});
 assert.equal(c.movsEmpData.length,0);assert.equal(c.currentUserUid,'admin-auth');
});

test('Ver como retira presencia antes de cambiar actor y la restaura después de recuperar Admin',()=>{const {c,presence}=setup();c.iniciarImpersonacionUsuario('u-a');assert.deepEqual(presence,[{action:'clear',user:'Admin',role:'admin'}]);c.finalizarImpersonacionUsuario();assert.deepEqual(presence.at(-1),{action:'start',user:'Admin',role:'admin'});});
