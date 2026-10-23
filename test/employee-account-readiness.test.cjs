const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function setup(page='page-ctaemp'){
 const select={innerHTML:'',value:'',disabled:false,style:{}},calls=[];
 const c={isAuthenticated:true,currentUserUid:'auth-tech',currentRole:'tecnico',empData:{},_gastosUnsubscribe:null,
  document:{hidden:false,getElementById:id=>id==='ctaemp-sel'?select:id.startsWith('page-')?{classList:{contains:name=>name==='active'&&id===page}}:null,querySelector:()=>({id:page})},
  window:{fbAuth:{currentUser:{uid:'auth-tech'}},usuariosData:[],_usuariosDatosListos:false,_empleadosDatosListos:false,tienePermiso:k=>k==='dashboard.miCuenta'},
  permisoModulo:()=>true,svPuedeLeerDominio:()=>false,limpiarCtaEmpSinSeleccion:()=>calls.push('clear'),
  fbCargarGastos(){calls.push('own-expenses');c._gastosUnsubscribe=()=>{};},fbCargarVacaciones:()=>calls.push('own-leave'),
  cargarCtaEmp:key=>calls.push('account:'+key),renderDashMiCuenta:()=>calls.push('dashboard'),escapeHTML:String};
 load(c,['_svEsPaginaActiva','svCtaEmpVisible','svEmpleadoPropio','iniciarCtaEmp','svActualizarCuentaTrasDatos']);
 function profile(){c.window.usuariosData=[{uid:'auth-tech',empleadoFbKey:'employee-one'}];c.window._usuariosDatosListos=true;}
 function directory(){c.empData={e:{fbKey:'employee-one',nombre:'Empleado ficticio'}};c.window._empleadosDatosListos=true;}
 return {c,select,calls,profile,directory};
}
for(const order of ['profile-first','directory-first'])test('la cuenta propia se recupera sin navegar con '+order,()=>{
 const s=setup();s.c.iniciarCtaEmp();assert.match(s.select.innerHTML,/Cargando perfil/);
 (order==='profile-first'?s.profile:s.directory)();s.c.svActualizarCuentaTrasDatos();
 assert.equal(s.calls.some(x=>x.startsWith('account:')),false);
 (order==='profile-first'?s.directory:s.profile)();s.c.svActualizarCuentaTrasDatos();
 assert.equal(s.select.value,'employee-one');assert.equal(s.select.disabled,true);
 assert.ok(s.calls.includes('account:employee-one'));assert.ok(s.calls.includes('own-expenses'));
});
test('una identidad confirmada sin vínculo no se inventa por nombre',()=>{
 const s=setup();s.directory();s.c.window._usuariosDatosListos=true;s.c.svActualizarCuentaTrasDatos();
 assert.match(s.select.innerHTML,/Sin perfil/);assert.equal(s.calls.some(x=>x.startsWith('account:')),false);
});
test('el error de directorio no se presenta como ausencia de vínculo',()=>{
 const s=setup();s.profile();s.c.window._empleadosDatosListos=true;s.c.window._empleadosCargaError='error';s.c.svActualizarCuentaTrasDatos();
 assert.match(s.select.innerHTML,/No se pudo cargar/);
});
test('el administrador conserva su selección y una sesión cerrada no inicia lecturas',()=>{
 const s=setup();s.profile();s.directory();s.c.window.tienePermiso=()=>true;s.c.svPuedeLeerDominio=()=>true;
 s.c.svActualizarCuentaTrasDatos();assert.deepEqual(s.calls,[]);
 s.c.isAuthenticated=false;s.c.window.tienePermiso=()=>false;s.c.svActualizarCuentaTrasDatos();assert.deepEqual(s.calls,[]);
});
test('la llegada tardía actualiza Dashboard y no abre el selector de otras cuentas',()=>{
 const s=setup('page-dashboard');s.profile();s.directory();s.c.svActualizarCuentaTrasDatos();
 assert.ok(s.calls.includes('dashboard'));assert.equal(s.calls.some(x=>x.startsWith('account:')),false);
});

test('el inicializador no abre una cuenta mientras la pantalla no está visible',()=>{
 const s=setup();s.profile();s.directory();s.c.document.hidden=true;s.c.iniciarCtaEmp();
 assert.deepEqual(s.calls,[]);assert.equal(s.select.value,'');
});
test('el listener de perfiles descarta otra sesión y notifica también un directorio vacío',()=>{
 let receive,updates=0;const c={currentUserUid:'auth-tech',window:{fbDB:{},fbRef:()=>'',svRutaUsuarios:()=> 'sv_usuarios',fbOnValue:(_,cb)=>receive=cb,usuariosData:[{}]},svActualizarCuentaTrasDatos:()=>updates++};
 load(c,['fbCargarUsuarios']);c.fbCargarUsuarios();c.currentUserUid='other';receive({val:()=>null});assert.equal(updates,0);
 c.currentUserUid='auth-tech';receive({val:()=>null});assert.equal(updates,1);assert.equal(c.window._usuariosDatosListos,true);assert.equal(c.window.usuariosData.length,0);
});
