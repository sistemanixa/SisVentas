const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const index=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync(index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1],'utf8');
const resolver=source.slice(source.indexOf('async function _resolverRolYCompletarLogin'),source.indexOf('async function _cancelarAutenticacionParcial'));
const firebase=fs.readFileSync('js/core/firebase.js','utf8');
const wrapper=firebase.slice(firebase.indexOf('window.fbOnAuth = function'),firebase.indexOf('window.fbCreateUser  ='));
function setup(role='admin'){
 const calls=[],subscriptions=[];let authCallback,complete=0,rejected=0;
 const identity={rol:role,activo:true},users={key:{uid:'u',rol:role,activo:true,nombre:'Prueba'}};
 const context={SV_SECURITY_STORAGE_V2:true,fbDB:{},fbAuth:{currentUser:{uid:'u'}},currentUserUid:'',currentUserEmail:'',currentRole:'',console,setTimeout,clearTimeout,
  fbRef:(_,path)=>path,fbQuery:(path,...filters)=>({path,filters}),fbOrderByChild:x=>x,fbEqualTo:x=>x,
  fbGet:async ref=>{calls.push(ref);const path=ref.path||ref;const value=path==='sv_usuarios'?users:identity;return{val:()=>value,exists:()=>Object.keys(value).length>0};},
  fbOnValue:(path,cb)=>{subscriptions.push({path,cb});return()=>{};},fbUpdate:async()=>{},
  _completarLogin:()=>complete++, _cancelarAutenticacionParcial:()=>rejected++,
  onAuthStateChanged:(_,cb)=>{authCallback=cb;return()=>{};}};
 context.window=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync('js/modules/security-storage.js','utf8'),context);
 vm.runInContext(resolver,context);vm.runInContext(wrapper,context);
 const user={uid:'u',email:'prueba@example.com'};
 return{context,user,calls,subscriptions,identity,users,auth:user=>authCallback(user),counts:()=>({complete,rejected})};
}
test('restauración verifica identidad y ficha con sólo dos lecturas, sin listener de existencia duplicado',async()=>{
 const x=setup();let login;
 x.context.fbOnAuth(x.context.fbAuth,(user,prepared)=>{login=x.context._resolverRolYCompletarLogin(user,null,prepared);});
 await x.auth(x.user);await login;
 assert.deepEqual(x.calls,['sv_chat_roles/u','sv_usuarios']);assert.equal(x.subscriptions.length,0);
 assert.deepEqual(x.counts(),{complete:1,rejected:0});
});
test('login y observador concurrentes comparten preparación en curso',async()=>{
 const x=setup();let release;const original=x.context.fbGet;
 x.context.fbGet=async ref=>{if(ref==='sv_chat_roles/u')await new Promise(r=>release=r);return original(ref);};
 const observer=x.context.svPrepararRutasSeguridad(x.user);
 const login=x.context._resolverRolYCompletarLogin(x.user,null);
 release();await Promise.all([observer,login]);
 assert.deepEqual(x.calls,['sv_chat_roles/u','sv_usuarios']);assert.equal(x.counts().complete,1);
});
test('un nuevo ingreso vuelve a verificar y detecta acceso revocado',async()=>{
 const x=setup();await x.context._resolverRolYCompletarLogin(x.user,null);
 x.identity.activo=false;
 await x.context._resolverRolYCompletarLogin(x.user,null);
 assert.equal(x.calls.length,4);assert.deepEqual(x.counts(),{complete:1,rejected:1});
});
for(const mutate of [x=>x.users.key.rol='tecnico',x=>x.users.key.activo=false,x=>x.users.duplicate={...x.users.key},x=>{delete x.users.key;}])
test('reutilizar snapshots mantiene rechazo de ficha inválida o duplicada',async()=>{
 const x=setup();mutate(x);await x.context._resolverRolYCompletarLogin(x.user,null);
 assert.deepEqual(x.counts(),{complete:0,rejected:1});
});
for(const role of ['compras_paraguay','distribuidora'])test('portal '+role+' consulta sólo ficha por UID',async()=>{
 const x=setup(role);await x.context._resolverRolYCompletarLogin(x.user,null);
 assert.equal(x.calls.length,2);assert.equal(x.calls[0],'sv_chat_roles/u');
 assert.equal(x.calls[1].path,'sv_usuarios');assert.deepEqual(Array.from(x.calls[1].filters),['uid','u']);
 assert.equal(x.counts().complete,1);
});
test('salir invalida una preparación pendiente y permite reintentar',async()=>{
 const x=setup();let release;const original=x.context.fbGet;
 x.context.fbGet=async ref=>{await new Promise(r=>release=r);return original(ref);};
 const pending=x.context.svPrepararRutasSeguridad(x.user);
 x.context.svInvalidarPreparacionSeguridad();release();await assert.rejects(pending,/sesión cambió/);
 assert.equal(x.context.svRutaUsuarios(),'sisventas/usuarios');
 x.context.fbGet=original;await x.context._resolverRolYCompletarLogin(x.user,null);
 assert.equal(x.counts().complete,1);
});
test('preparación de otro UID o de una generación anterior no concede acceso',async()=>{
 const x=setup();const result=await x.context.svPrepararRutasSeguridad(x.user);
 x.context.svInvalidarPreparacionSeguridad();
 await x.context._resolverRolYCompletarLogin(x.user,null,result);
 assert.deepEqual(x.counts(),{complete:0,rejected:1});
});
test('fallo de red no queda guardado y el siguiente intento puede verificar',async()=>{
 const x=setup();const original=x.context.fbGet;x.context.fbGet=async()=>{throw Error('offline');};
 await x.context._resolverRolYCompletarLogin(x.user,null);assert.equal(x.counts().rejected,1);
 x.context.fbGet=original;await x.context._resolverRolYCompletarLogin(x.user,null);assert.equal(x.counts().complete,1);
});
test('Auth no entrega al login una sesión pendiente después de recibir logout',async()=>{
 const x=setup();let release;const original=x.context.fbGet;
 x.context.fbGet=async ref=>{await new Promise(r=>release=r);return original(ref);};
 const callbacks=[];x.context.fbOnAuth(x.context.fbAuth,user=>callbacks.push(user),()=>assert.fail('No reportar error de una sesión anterior'));
 const pending=x.auth(x.user);await x.auth(null);release();await pending;
 assert.deepEqual(callbacks,[null]);
});
test('la sesión sólo se completa después de preparar los módulos del rol verificado',async()=>{
 const x=setup();let release,requestedRole;
 x.context.SVSessionAssets={forRole:async(role,isCurrent)=>{requestedRole=role;assert.equal(isCurrent(),true);await new Promise(r=>release=r);}};
 const pending=x.context._resolverRolYCompletarLogin(x.user,null);
 while(!release)await Promise.resolve();
 assert.equal(requestedRole,'admin');assert.equal(x.context.currentRole,'');assert.equal(x.counts().complete,0);
 release();await pending;assert.equal(x.counts().complete,1);
});
test('fallo al descargar módulos no concede acceso ni conserva rol',async()=>{
 const x=setup();x.context.SVSessionAssets={forRole:async()=>{throw Error('sin red');}};
 await x.context._resolverRolYCompletarLogin(x.user,null);
 assert.deepEqual(x.counts(),{complete:0,rejected:1});assert.equal(x.context.currentRole,'');
});
test('no descarga módulos para una identidad inactiva',async()=>{
 const x=setup();x.identity.activo=false;x.context.SVSessionAssets={forRole:()=>assert.fail('No descargar sin acceso verificado')};
 await x.context._resolverRolYCompletarLogin(x.user,null);assert.equal(x.counts().rejected,1);
});
test('salir mientras llegan los módulos no vuelve a completar la sesión anterior',async()=>{
 const x=setup();let release;
 x.context.SVSessionAssets={forRole:async()=>{await new Promise(r=>release=r);}};
 const pending=x.context._resolverRolYCompletarLogin(x.user,null);while(!release)await Promise.resolve();
 x.context.svInvalidarPreparacionSeguridad();x.context.currentUserUid='';
 release();await pending;assert.equal(x.counts().complete,0);assert.equal(x.context.currentRole,'');
});
