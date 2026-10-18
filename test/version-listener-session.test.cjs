const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

function setup(role='administrativo'){
 const subscriptions=[],timers=new Map(),intervals=[],updates=[],warnings=[];let serial=0;
 const c={isAuthenticated:false,currentUserUid:'u1',currentRole:role,
  _listenerVersionActivo:false,_listenerVersionUnsubscribe:null,_listenerVersionUid:'',_listenerVersionEpoch:0,
  _reintentoListenerVersionTimer:null,_watchdogVersionTimer:null,_chequeoVersionIniciado:false,
  APP_CONFIG:{VERSION:'v3.11.6-firebase'},document:{visibilityState:'visible'},httpChecks:0,
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn(){timers.delete(id);fn();},ms});return id;},clearTimeout(id){timers.delete(id);},
  setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},
  console:{warn:message=>warnings.push(message),info(){}},
  _dispararActualizacion:v=>updates.push(v),
  window:{fbDB:{},fbAuth:{currentUser:{uid:'u1'}},fbRef:(_,path)=>path,
   fbSet(){assert.fail('El listener no escribe configuración');},
   fbOnValue(path,next,error){const s={path,next,error,stopped:0};subscriptions.push(s);return ()=>s.stopped++;}}
 };
 c.rolActualNormalizado=()=>c.currentRole;c._chequearGitHub=()=>c.httpChecks++;
 load(c,['_sesionVersionLista','detenerListenerVersion','iniciarListenerVersion','iniciarWatchdogVersion','iniciarChequeoPeriodicoVersion','_versionMasNueva']);
 return {c,subscriptions,timers,intervals,updates,warnings,login(){c.isAuthenticated=true;c.iniciarChequeoPeriodicoVersion();}};
}

test('firebase-ready sin login conserva HTTP y no abre una lectura protegida',()=>{
 const s=setup();s.c.iniciarChequeoPeriodicoVersion();
 assert.equal(s.subscriptions.length,0);assert.equal(s.c._listenerVersionActivo,false);
 assert.equal(s.intervals.length,0);assert.equal(s.c.httpChecks,1);
 assert.equal(s.c.httpChecks,1);
});

for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico']){
 test('la sesión confirmada de '+role+' escucha una sola vez y recibe la actualización',()=>{
  const s=setup(role);s.c.iniciarChequeoPeriodicoVersion();s.login();s.c.iniciarChequeoPeriodicoVersion();
  assert.equal(s.subscriptions.length,1);assert.equal(s.subscriptions[0].path,'sisventas/config/version');
  assert.equal(s.intervals.length,0);assert.equal(s.c._listenerVersionActivo,true);
  s.subscriptions[0].next({val:()=> 'v3.11.6-firebase'});assert.deepEqual(s.updates,[]);
  s.subscriptions[0].next({val:()=> 'v3.11.7-firebase'});assert.deepEqual(s.updates,['v3.11.7-firebase']);
 });
}

test('Auth ausente o diferente del UID de pantalla no abre una lectura con identidad incorrecta',()=>{
 for(const user of [null,{uid:'otra'}]){const s=setup();s.c.window.fbAuth.currentUser=user;s.login();assert.equal(s.subscriptions.length,0);}
});

test('los portales externos y roles desconocidos mantienen HTTP sin pedir configuración restringida',()=>{
 for(const role of ['compras_paraguay','distribuidora','desconocido']){
  const s=setup(role);s.login();assert.equal(s.subscriptions.length,0);assert.equal(s.intervals.length,0);assert.equal(s.c.httpChecks,1);
 }
});

test('un rechazo asíncrono libera el listener y programa un único reintento',()=>{
 const s=setup();s.login();s.subscriptions[0].error({code:'PERMISSION_DENIED'});
 assert.equal(s.c._listenerVersionActivo,false);assert.equal(s.subscriptions[0].stopped,1);
 assert.equal(s.timers.size,1);assert.equal([...s.timers.values()][0].ms,30000);
 s.subscriptions[0].error({code:'PERMISSION_DENIED'});assert.equal(s.timers.size,1);
 const timer=[...s.timers.values()][0];timer.fn();assert.equal(s.subscriptions.length,2);assert.equal(s.c._listenerVersionActivo,true);
 s.subscriptions[1].next({val:()=> 'v3.11.7-firebase'});assert.equal(s.updates.length,1);
});

test('el login/reintento explícito no queda bloqueado por la bandera después de un rechazo',()=>{
 const s=setup();s.login();s.subscriptions[0].error({code:'PERMISSION_DENIED'});
 s.c.iniciarChequeoPeriodicoVersion();assert.equal(s.subscriptions.length,2);assert.equal(s.timers.size,0);
 assert.equal(s.c._listenerVersionActivo,true);assert.equal(s.intervals.length,0);
});

test('cerrar sesión cancela el reintento; una respuesta o timer anterior no afectan el nuevo login',()=>{
 const s=setup();s.login();const old=s.subscriptions[0];old.error({code:'PERMISSION_DENIED'});const timer=[...s.timers.values()][0];
 s.c.isAuthenticated=false;s.c.detenerListenerVersion();assert.equal(s.timers.size,0);
 s.login();old.next({val:()=> 'v9.9.9-firebase'});old.error({code:'PERMISSION_DENIED'});timer.fn();
 assert.deepEqual(s.updates,[]);assert.equal(s.subscriptions.length,2);assert.equal(s.c._listenerVersionActivo,true);
});

test('cambiar de usuario cancela la lectura previa e ignora sus snapshots tardíos',()=>{
 const s=setup();s.login();const old=s.subscriptions[0];s.c.currentUserUid='u2';s.c.window.fbAuth.currentUser={uid:'u2'};
 s.c.iniciarListenerVersion();assert.equal(old.stopped,1);assert.equal(s.subscriptions.length,2);
 old.next({val:()=> 'v9.9.9-firebase'});assert.deepEqual(s.updates,[]);
 s.subscriptions[1].next({val:()=> 'v3.11.7-firebase'});assert.equal(s.updates.length,1);
});

test('una excepción o cancelación síncrona tampoco deja una bandera activa',()=>{
 for(const cancel of [false,true]){
  const s=setup();let stopped=0;s.c.window.fbOnValue=(_,next,error)=>{if(!cancel)throw Error('network');error({code:'PERMISSION_DENIED'});return ()=>stopped++;};
  s.login();assert.equal(s.c._listenerVersionActivo,false);assert.equal(s.c._listenerVersionUnsubscribe,null);
  assert.equal(s.timers.size,1);assert.equal(stopped,cancel?1:0);
 }
});
