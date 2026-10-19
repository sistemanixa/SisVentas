'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const core=fs.readFileSync('js/core/firebase.js','utf8');
const wrapper=core.slice(core.indexOf('window.fbOnAuth = function'),core.indexOf('window.fbCreateUser  ='));
const {functionSource}=require('./helpers/app-functions.cjs');
function fixture(hidden=true){
 const document=new EventTarget(),browser=new EventTarget(),calls={gate:0,profile:0,login:[],errors:[],unsubscribed:0};document.hidden=hidden;
 let observed,finishProfile=null;const user={uid:'ficticio'};
 const root={document,fbAuth:{currentUser:user},fbDB:{},fbGoOffline(){},fbGoOnline(){},
  SVUserAccess:{gate:async()=>{calls.gate++;return false;}},
  svPrepararRutasSeguridad:async u=>{calls.profile++;if(finishProfile)await finishProfile.promise;return {uid:u?.uid};},
  addEventListener:browser.addEventListener.bind(browser),dispatchEvent:browser.dispatchEvent.bind(browser)};
 const c={window:root,document,Event,CustomEvent,DOMException,AbortController,console:{warn(){}},setTimeout,clearTimeout,
  onAuthStateChanged:(_auth,cb)=>{observed=cb;return()=>calls.unsubscribed++;}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/foreground-session.js','utf8'),c);vm.runInContext(wrapper,c);
 const stop=root.fbOnAuth(root.fbAuth,(u,p)=>calls.login.push({user:u?.uid||null,prepared:p?.uid||null}),e=>calls.errors.push(e));
 return {root,user,document,calls,stop,observe:u=>observed(u),visible(){document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));},
  holdProfile(){let resolve;finishProfile={promise:new Promise(r=>resolve=r)};return resolve;}};
}
test('restauración oculta no consulta perfil ni acceso hasta volver visible',async()=>{
 const f=fixture(),task=f.observe(f.user);await settle();assert.equal(f.calls.gate,0);assert.equal(f.calls.profile,0);assert.equal(f.calls.login.length,0);
 f.visible();await task;assert.equal(f.calls.gate,1);assert.equal(f.calls.profile,1);assert.equal(f.calls.login.length,1);assert.equal(f.calls.errors.length,0);
});
test('Auth nulo se entrega oculto y cancela la restauración anterior',async()=>{
 const f=fixture(),old=f.observe(f.user);await settle();f.root.fbAuth.currentUser=null;await f.observe(null);await old;
 assert.equal(f.calls.login.length,1);assert.equal(f.calls.login[0].user,null);f.visible();await settle();assert.equal(f.calls.gate,0);assert.equal(f.calls.errors.length,0);
});
test('cambio de identidad oculto sólo prepara la cuenta vigente al volver',async()=>{
 const f=fixture(),old=f.observe(f.user);await settle();const next={uid:'otra-identidad'};f.root.fbAuth.currentUser=next;const task=f.observe(next);await old;
 f.visible();await task;assert.equal(f.calls.profile,1);assert.equal(f.calls.login.length,1);assert.equal(f.calls.login[0].user,next.uid);
});
test('retirar el observador oculto no deja un ingreso que pueda revivir',async()=>{
 const f=fixture(),task=f.observe(f.user);await settle();f.stop();await task;f.visible();await settle();assert.equal(f.calls.unsubscribed,1);assert.equal(f.calls.profile,0);assert.equal(f.calls.login.length,0);
});
test('ocultarse mientras responde el perfil no inicia los módulos en segundo plano',async()=>{
 const f=fixture(false),release=f.holdProfile(),task=f.observe(f.user);await settle();assert.equal(f.calls.profile,1);
 f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));release();await settle();assert.equal(f.calls.login.length,0);
 f.visible();await task;assert.equal(f.calls.login.length,1);assert.equal(f.calls.profile,2,'El perfil anterior al bloqueo se verifica nuevamente al volver');
});

// Preparación, perfil, cancelación y deadline reales; sólo reloj, Auth y red
// son ficticios. Así la espera oculta no queda fuera de la prueba del plazo.
function integratedFixture(){
 const document=new EventTarget(),browser=new EventTarget();document.hidden=false;document.visibilityState='visible';
 const timers=new Map(),tokens=[],requests=[],login=[],errors=[];let now=0,sequence=0,holdToken=false,holdHTTP=false,status=200,observed;
 const response=(code=200,name='Perfil vigente')=>({status:code,ok:code===200,json:async()=>code===200?{ok:true,profile:{uid:'ficticio',fbKey:'fixture',rol:'vendedor',activo:true,nombre:name}}:{ok:false,mensaje:'Acceso revocado ficticio'}});
 const user={uid:'ficticio',email:'fixture@example.invalid',getIdToken(){if(!holdToken)return Promise.resolve('FICTICIO');let resolve;const promise=new Promise(done=>resolve=done);tokens.push({resolve});return promise;}};
 const root={document,Event,CustomEvent,AbortController,AbortSignal,URL,Promise,queueMicrotask,console:{warn(){}},fbAuth:{currentUser:user},fbDB:{},
  SV_USER_DIRECTORY_V2:true,SV_SECURITY_STORAGE_V2:true,currentUserUid:'',currentRole:'',currentUserEmail:'',isAuthenticated:true,
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},navigator:{onLine:true},fbGoOffline(){},fbGoOnline(){},fbRef:(_,path)=>path,fbOnValue:()=>()=>{},
  addEventListener:browser.addEventListener.bind(browser),dispatchEvent:browser.dispatchEvent.bind(browser),SVUserAccess:{gate:async()=>false},
  setTimeout(fn,delay=0){const id=++sequence;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),
  onAuthStateChanged:(_auth,callback)=>{observed=callback;return()=>{};},
  fetch(url,options){assert.equal(new URL(url).origin,'https://fixture.invalid');let resolve;const task=holdHTTP?new Promise(done=>resolve=done):Promise.resolve(response(status));requests.push({url,signal:options.signal,resolve});return task;}};
 root.window=root;vm.createContext(root);
 for(const file of ['js/core/session-recovery.js','js/core/foreground-session.js','js/core/user-directory.js','js/modules/security-storage.js'])vm.runInContext(fs.readFileSync(file,'utf8'),root);
 vm.runInContext(wrapper,root);root.fbOnAuth(root.fbAuth,(actor,prepared)=>login.push({uid:actor?.uid||null,prepared}),error=>errors.push(error));
 return {root,user,timers,tokens,requests,login,errors,observe:actor=>observed(actor),holdToken:value=>{holdToken=value;},holdHTTP:value=>{holdHTTP=value;},status:value=>{status=value;},response,
  hidden(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';document.dispatchEvent(new Event('visibilitychange'));},
  advance(ms){const until=now+ms;for(;;){const next=[...timers].filter(([,task])=>task.due<=until).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;timers.delete(next[0]);now=next[1].due;next[1].fn();}now=until;},
  resolver(){vm.runInContext(functionSource('_resolverRolYCompletarLogin'),root);root.SVSessionAssets={forRole:async()=>true};root._completarLogin=()=>login.push({uid:root.currentUserUid,role:root.currentRole});root._svOfrecerRecuperacionCarga=error=>{errors.push(error);return true;};root._cancelarAutenticacionParcial=message=>errors.push(Error(message));return root._resolverRolYCompletarLogin;}};
}

test('deadline real no consume una espera oculta y el token SDK anterior nunca inicia un GET huérfano',async()=>{
 const f=integratedFixture();f.holdToken(true);const task=f.observe(f.user);await settle();assert.equal(f.tokens.length,1);
 f.hidden(true);await settle();assert.equal(f.timers.size,0);f.advance(600000);await settle();assert.equal(f.errors.length,0);assert.equal(f.requests.length,0);assert.equal(f.login.length,0);
 f.tokens[0].resolve('TOKEN-ANTERIOR');await settle();assert.equal(f.requests.length,0);
 f.holdToken(false);f.hidden(false);await task;assert.equal(f.requests.length,1);assert.equal(f.login.length,1);assert.equal(f.login[0].prepared.usuariosSnapshot.val().fixture.nombre,'Perfil vigente');assert.equal(f.errors.length,0);assert.equal(f.timers.size,0);
});

test('ocultar aborta el GET de perfil y descarta una respuesta tardía antes de verificar uno nuevo',async()=>{
 const f=integratedFixture();f.holdHTTP(true);const task=f.observe(f.user);await settle();assert.equal(f.requests.length,1);assert.equal(f.requests[0].signal.aborted,false);
 f.hidden(true);await settle();assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.timers.size,0);f.advance(600000);assert.equal(f.errors.length,0);
 f.holdHTTP(false);f.hidden(false);await task;assert.equal(f.requests.length,2);assert.equal(f.login.length,1);
 f.requests[0].resolve(f.response(200,'Respuesta obsoleta'));await settle();assert.equal(f.login.length,1);assert.equal(f.login[0].prepared.usuariosSnapshot.val().fixture.nombre,'Perfil vigente');assert.equal(f.errors.length,0);
});

test('plazo visible conserva el error, cancela el token pendiente y permite un ingreso nuevo sin GET tardío',async()=>{
 const f=integratedFixture();f.holdToken(true);const task=f.observe(f.user);await settle();f.advance(20000);await task;
 assert.equal(f.errors.length,1);assert.equal(f.errors[0].name,'TimeoutError');assert.equal(f.requests.length,0);assert.equal(f.login.length,0);assert.equal(f.timers.size,0);
 f.tokens[0].resolve('TOKEN-VENCIDO');await settle();assert.equal(f.requests.length,0);
 f.holdToken(false);await f.observe(f.user);assert.equal(f.requests.length,1);assert.equal(f.login.length,1);assert.equal(f.root.fbAuth.currentUser,f.user);
});

test('Auth nulo oculto cancela preparación real y una revocación al regresar no habilita login',async()=>{
 const f=integratedFixture();f.holdToken(true);const task=f.observe(f.user);await settle();f.hidden(true);await settle();f.root.fbAuth.currentUser=null;await f.observe(null);await task;
 f.tokens[0].resolve('FICTICIO');f.hidden(false);await settle();assert.deepEqual(f.login.map(item=>item.uid),[null]);assert.equal(f.requests.length,0);assert.equal(f.errors.length,0);
 const denied=integratedFixture();denied.holdToken(true);const pending=denied.observe(denied.user);await settle();denied.hidden(true);await settle();denied.holdToken(false);denied.status(403);denied.hidden(false);await pending;
 assert.equal(denied.requests.length,1);assert.equal(denied.errors[0].status,403);assert.equal(denied.login.length,0);denied.tokens[0].resolve('ANTERIOR');await settle();assert.equal(denied.requests.length,1);
});

test('entrada manual de la app espera con deadline real y no arma su timeout de rol durante el bloqueo',async()=>{
 const f=integratedFixture(),resolver=f.resolver();f.holdToken(true);const task=resolver(f.user);await settle();assert.equal(f.tokens.length,1);
 f.hidden(true);await settle();f.advance(600000);await settle();assert.equal(f.errors.length,0);assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);
 f.tokens[0].resolve('ANTERIOR');f.holdToken(false);f.hidden(false);await task;assert.equal(f.errors.length,0);assert.deepEqual(f.login.map(item=>item.role),['vendedor']);assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
});

test('si los módulos de rol demoran durante el bloqueo, la app reinicia visible sin error ni rol obsoleto',async()=>{
 const f=integratedFixture(),resolver=f.resolver(),app=require('./helpers/active-app').readActiveApp().source;
 vm.runInContext(app.slice(app.indexOf('var _svTrabajosFondo ='),app.indexOf('var _usoUsuariosCargaModulo')),f.root);
 let release,assets=0;f.root.SVSessionAssets={forRole:async()=>{if(++assets===1)await new Promise(resolve=>release=resolve);return true;}};
 const first=resolver(f.user);await settle();assert.equal(assets,1);assert.equal(f.requests.length,1);
 f.hidden(true);f.advance(15000);await settle();assert.equal(f.errors.length,0);assert.equal(f.login.length,0);assert.equal(f.root._svTrabajosFondo.size,1);
 f.hidden(false);await settle();await settle();assert.equal(f.requests.length,2);assert.deepEqual(f.login.map(item=>item.role),['vendedor']);
 release();await first;assert.equal(f.login.length,1);assert.equal(f.errors.length,0);assert.equal(f.root._svTrabajosFondo.size,0);assert.equal(f.timers.size,0);
});
