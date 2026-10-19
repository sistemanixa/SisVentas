'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=require('./helpers/active-app').readActiveApp().source,core=fs.readFileSync('js/core/firebase.js','utf8');
function fixture(){
 let observed,finish,timer,blocked=0,logged=0;
 const user={uid:'fixture'},document=new EventTarget();document.hidden=false;document.visibilityState='visible';
 const ctx={window:{fbAuth:{currentUser:user},svPrepararRutasSeguridad:()=>new Promise(r=>finish=r)},document,Event,AbortController,console,
  onAuthStateChanged:(_auth,cb)=>{observed=cb;return()=>{};},_primeraVerificacionAuth:true,isAuthenticated:false,_mostrarLoginSinSesion:()=>{blocked++;},setTimeout:fn=>{timer=fn;}};
 vm.createContext(ctx);vm.runInContext(core.slice(core.indexOf('    let authStateReceived = false;'),core.indexOf('    window.fbCreateUser  =')),ctx);
 ctx.window.fbOnAuth(ctx.window.fbAuth,()=>{logged++;});
 const start=app.indexOf("  var sdkRespondio = typeof window.fbAuthStateReceived");vm.runInContext('setTimeout(function(){'+app.slice(start,app.indexOf('}, 6000);',start))+'},6000);',ctx);
 return{ctx,user,observe:()=>observed(user),async finish(){for(let attempt=0;attempt<100&&!finish;attempt++)await new Promise(setImmediate);if(!finish)throw Error('El fixture no alcanzó la lectura de perfil');finish({uid:user.uid});},tick:()=>timer(),blocked:()=>blocked,logged:()=>logged};
}
test('SDK recibido con perfil pendiente no dispara cierre de sesión a los seis segundos',async()=>{const f=fixture();const pending=f.observe();assert.equal(f.ctx.window.fbAuthStateReceived(),true);assert.equal(f.logged(),0);f.tick();assert.equal(f.blocked(),0);assert.equal(f.ctx.isAuthenticated,false);await f.finish();await pending;assert.equal(f.logged(),1);});
test('sin respuesta del SDK se conserva la salida de carga al login',()=>{const f=fixture();assert.equal(f.ctx.window.fbAuthStateReceived(),false);f.tick();assert.equal(f.blocked(),1);assert.equal(f.logged(),0);});
test('la señal de SDK no omite el rechazo del perfil protegido',async()=>{const f=fixture();let errors=0;f.ctx.window.svPrepararRutasSeguridad=async()=>{throw Error('Perfil rechazado');};f.ctx.window.fbOnAuth(f.ctx.window.fbAuth,()=>assert.fail('No puede completar login'),()=>errors++);await f.observe();assert.equal(errors,1);assert.equal(f.logged(),0);});

test('perfil interrumpido se entrega a recuperación en lugar de dejar esperando el arranque',async()=>{const f=fixture();let offered=0;f.ctx.window.svPrepararRutasSeguridad=async()=>{throw Object.assign(Error('red'),{name:'TypeError'});};f.ctx.window._svOfrecerRecuperacionCarga=(error,user)=>{assert.equal(user,f.user);assert.equal(error.name,'TypeError');offered++;return true;};await f.observe();assert.equal(offered,1);assert.equal(f.logged(),0);});

test('perfil revocado conserva el rechazo explícito sin ofrecer acceso incompleto',async()=>{const f=fixture();let rejected=0;f.ctx.window.svPrepararRutasSeguridad=async()=>{throw Object.assign(Error('revocado'),{status:403});};f.ctx.window._svOfrecerRecuperacionCarga=()=>false;f.ctx.window._cancelarAutenticacionParcial=()=>rejected++;await f.observe();assert.equal(rejected,1);assert.equal(f.logged(),0);});
