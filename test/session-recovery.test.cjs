'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {recoverable,create,deadline}=require('../js/core/session-recovery');
function setup(retry=async()=>{}){let current={uid:'ficticio'},blocked=0,denied=0,callbacks=[];const user=current;
 const controller=create({currentUser:()=>current,block:()=>blocked++,retry,deny:()=>denied++,show:(error,callback)=>callbacks.push(callback)});
 return {controller,user,callbacks,setUser:u=>current=u,counts:()=>({blocked,denied})};}
test('indisponibilidad se distingue de revocación y de ficha inválida',()=>{
 for(const error of [{name:'TypeError'},{name:'TimeoutError'},{code:'SV_ASSET_LOAD'},{code:'auth/network-request-failed'},{status:503}])assert.equal(recoverable(error),true);
 for(const error of [{name:'TypeError',status:401},{name:'TypeError',status:'403'},{code:'SV_ASSET_LOAD',status:403},{statusCode:403},{name:'TypeError',code:'PERMISSION_DENIED'},{code:'auth/user-disabled'},Error('Ficha inactiva')])assert.equal(recoverable(error),false);
});
test('fallo de módulo bloquea la interfaz sin cerrar Auth y revalida la misma cuenta al reintentar',async()=>{let retried=0;const f=setup(async u=>{assert.equal(u,f.user);retried++;});assert.equal(f.controller.offer({code:'SV_ASSET_LOAD'},f.user),true);assert.deepEqual(f.counts(),{blocked:1,denied:0});assert.equal(retried,0);await f.callbacks[0]();assert.equal(retried,1);await f.callbacks[0]();assert.equal(retried,1);});
test('cierre o cambio de cuenta descarta el botón pendiente',async()=>{let retried=0;const f=setup(async()=>retried++);f.controller.offer({name:'TypeError'},f.user);f.setUser({uid:'otra'});await f.callbacks[0]();assert.equal(retried,0);assert.equal(f.controller.offer({name:'TypeError'},f.user),false);});
test('doble clic no duplica verificaciones y un segundo fallo de red ofrece recuperación nueva',async()=>{let fail,calls=0;const f=setup(()=>{calls++;return new Promise((_,reject)=>fail=reject);});f.controller.offer({name:'TypeError'},f.user);const pending=f.callbacks[0]();await f.callbacks[0]();assert.equal(calls,1);fail(Object.assign(Error('red'),{name:'TypeError'}));await pending;assert.equal(f.callbacks.length,2);await f.callbacks[0]();assert.equal(calls,1);});
test('revocación durante recuperación vuelve a bloquear y rechaza; no concede acceso',async()=>{const f=setup(async()=>{throw Object.assign(Error('revocado'),{status:403});});f.controller.offer({name:'TypeError'},f.user);await f.callbacks[0]();assert.deepEqual(f.counts(),{blocked:2,denied:1});});
test('respuesta fallida tardía de una cuenta anterior no afecta la cuenta actual',async()=>{let reject;const f=setup(()=>new Promise((_,r)=>reject=r));f.controller.offer({name:'TypeError'},f.user);const pending=f.callbacks[0]();f.setUser({uid:'otra'});reject(Object.assign(Error(),{status:403}));await pending;assert.deepEqual(f.counts(),{blocked:1,denied:0});});

test('verificación SDK pendiente tiene límite propio aunque todavía no haya empezado fetch',async()=>{let timeout,cleared=0;const clock={setTimeout:fn=>(timeout=fn,1),clearTimeout:()=>cleared++};const pending=deadline(new Promise(()=>{}),20000,clock);timeout();await assert.rejects(pending,e=>e.code==='SV_AUTH_LOAD_TIMEOUT'&&recoverable(e));assert.equal(cleared,1);});
test('token o preparación válidos conservan resultado y cancelan su temporizador',async()=>{let cleared=0;const clock={setTimeout:()=>1,clearTimeout:()=>cleared++},result={uid:'ficticio'};assert.equal(await deadline(Promise.resolve(result),20000,clock),result);assert.equal(cleared,1);});
