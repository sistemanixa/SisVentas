const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');
const wrapper=source.slice(source.indexOf('window.fbOnAuth = function'),source.indexOf('window.fbCreateUser  ='));
test('la sesión espera a resolver las rutas antes de cargar usuarios',async()=>{
 let authCallback,release;const events=[];
 const window={svPrepararRutasSeguridad:async()=>{events.push('preparar');await new Promise(r=>release=r);events.push('listo');}};
 vm.runInNewContext(wrapper,{window,onAuthStateChanged:(_,cb)=>{authCallback=cb;return()=>{};},console});
 window.fbOnAuth({},()=>events.push('login'));
 const pending=authCallback({uid:'ficticio'});
 assert.deepEqual(events,['preparar']);release();await pending;
 assert.deepEqual(events,['preparar','listo','login']);
});
test('un fallo de verificación no completa la sesión con una ruta no validada',async()=>{
 let authCallback,loaded=false,failed=false;
 const window={svPrepararRutasSeguridad:async()=>{throw Error('sin conexión');}};
 vm.runInNewContext(wrapper,{window,onAuthStateChanged:(_,cb)=>authCallback=cb,console:{warn:()=>{}}});
 window.fbOnAuth({},()=>loaded=true,()=>failed=true);
 await authCallback({uid:'ficticio'});
 assert.equal(loaded,false);assert.equal(failed,true);
});
