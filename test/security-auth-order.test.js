const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');
const wrapper=source.slice(source.indexOf('window.fbOnAuth = function'),source.indexOf('window.fbCreateUser  ='));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function environment(){const user={uid:'ficticio'},document=new EventTarget();document.hidden=false;document.visibilityState='visible';return {user,document,AbortController};}
test('la sesión espera a resolver las rutas antes de cargar usuarios',async()=>{
 let authCallback,release;const events=[];
 const env=environment(),window={fbAuth:{currentUser:env.user},svPrepararRutasSeguridad:async()=>{events.push('preparar');await new Promise(r=>release=r);events.push('listo');}};
 vm.runInNewContext(wrapper,{...env,window,onAuthStateChanged:(_,cb)=>{authCallback=cb;return()=>{};},console});
 window.fbOnAuth(window.fbAuth,()=>events.push('login'));
 const pending=authCallback(env.user);await settle();
 assert.deepEqual(events,['preparar']);release();await pending;
 assert.deepEqual(events,['preparar','listo','login']);
});
test('un fallo de verificación no completa la sesión con una ruta no validada',async()=>{
 let authCallback,loaded=false,failed=false;
 const env=environment(),window={fbAuth:{currentUser:env.user},svPrepararRutasSeguridad:async()=>{throw Error('sin conexión');}};
 vm.runInNewContext(wrapper,{...env,window,onAuthStateChanged:(_,cb)=>{authCallback=cb;return()=>{};},console:{warn:()=>{}}});
 window.fbOnAuth(window.fbAuth,()=>loaded=true,()=>failed=true);
 await authCallback(env.user);
 assert.equal(loaded,false);assert.equal(failed,true);
});
