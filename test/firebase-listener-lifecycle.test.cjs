'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const file=fs.readFileSync('js/core/firebase.js','utf8'),source=file.slice(file.indexOf('    const fbValueListeners ='),file.indexOf('    window.fbUpdate      ='));
function fixture(){const callbacks=[],loads=[],errors=[];let stops=0;const c={window:{SVDataReadiness:{begin(){const stats={ready:0,error:0,cancel:0};loads.push(stats);return Object.fromEntries(Object.keys(stats).map(k=>[k,()=>stats[k]++]));}}},console:{warn(){},error:()=>errors.push(1)},onValue:(...args)=>{callbacks.push(args);return()=>stops++;}};vm.createContext(c);vm.runInContext(source,c);return {c,callbacks,loads,errors,get stops(){return stops;}};}
test('cancelar una escucha descarta snapshots y errores ya encolados; cancelar dos veces no repite',()=>{const f=fixture();let calls=0,errors=0;const stop=f.c.window.fbOnValue({path:'demo'},()=>calls++,()=>errors++);stop();stop();f.callbacks[0][1]({});f.callbacks[0][2](Error('Error tardío ficticio'));assert.equal(calls,0);assert.equal(errors,0);assert.equal(f.stops,1);assert.equal(f.loads[0].cancel,1);});
test('cerrar todas las escuchas no permite que un callback viejo pinte la siguiente sesión',()=>{const f=fixture();let old=0,next=0;f.c.window.fbOnValue({},()=>old++);f.c.window.fbStopAllValueListeners();f.c.window.fbOnValue({},()=>next++);f.callbacks[0][1]({});f.callbacks[1][1]({});assert.equal(old,0);assert.equal(next,1);});
test('una preparación asíncrona anterior no marca lista ni error tras cancelar',async()=>{for(const reject of [false,true]){const f=fixture();let finish;const stop=f.c.window.fbOnValue({},()=>new Promise((resolve,fail)=>finish=reject?fail:resolve));const task=f.callbacks[0][1]({});stop();finish();await Promise.resolve(task).catch(()=>{});assert.equal(f.loads[0].ready,0);assert.equal(f.loads[0].error,0);assert.equal(f.loads[0].cancel,1);}});
test('cancelar una pantalla no cancela otra escucha legítima del mismo recurso',async()=>{const f=fixture();let first=0,second=0;const stop=f.c.window.fbOnValue({path:'demo'},()=>first++);f.c.window.fbOnValue({path:'demo'},()=>second++);stop();f.callbacks[0][1]({});f.callbacks[1][1]({});await Promise.resolve();assert.equal(first,0);assert.equal(second,1);assert.equal(f.loads[1].ready,1);});
test('un fallo síncrono al registrar también notifica al cargador para liberar su indicador',()=>{const f=fixture();let active=true;f.c.onValue=()=>{throw Error('Registro ficticio fallido');};assert.throws(()=>f.c.window.fbOnValue({},()=>{},()=>active=false),/Registro ficticio fallido/);assert.equal(active,false);assert.equal(f.loads[0].error,1);f.c.window.fbStopAllValueListeners();assert.equal(f.stops,0);});

test('reintentar una suscripción cancelada no arrastra el error de la fuente anterior',async()=>{
 const f=fixture();Object.assign(f.c,{URL,document:{addEventListener(){}},requestAnimationFrame(){}});f.c.window.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),f.c);
 const ref='https://demo.firebaseio.com/sisventas/empleados';let delivered=0;
 f.c.window.fbOnValue(ref,()=>delivered++);f.callbacks[0][2](Error('Cancelación ficticia del SDK'));
 assert.deepEqual(Array.from(f.c.window.SVDataReadiness.status(['empleados']).errors),['empleados']);
 f.c.window.fbOnValue(ref,()=>delivered++);f.callbacks[1][1]({});await Promise.resolve();
 assert.equal(f.c.window.SVDataReadiness.status(['empleados']).ready,true);
 assert.deepEqual(Array.from(f.c.window.SVDataReadiness.status(['empleados']).errors),[]);
 f.callbacks[0][1]({});assert.equal(delivered,1);assert.equal(f.stops,1);
});

test('lecturas onlyOnce liberan el registro y no vuelven a rellenar formularios',async()=>{const f=fixture();let calls=0;for(let i=0;i<20;i++){f.c.window.fbOnValue({},()=>calls++,{onlyOnce:true});f.callbacks[i][1]({});await Promise.resolve();f.callbacks[i][1]({});}assert.equal(calls,20);assert.equal(f.stops,20);assert.ok(f.loads.every(x=>x.ready===1&&x.cancel===1));f.c.window.fbStopAllValueListeners();assert.equal(f.stops,20);});
test('una lectura única asíncrona conserva el indicador hasta completar y se libera al fallar',async()=>{const f=fixture();let reject;f.c.window.fbOnValue({},()=>new Promise((_,r)=>reject=r),{onlyOnce:true});f.callbacks[0][1]({});assert.equal(f.stops,0);reject(Error('Preparación ficticia fallida'));await new Promise(setImmediate);assert.equal(f.loads[0].error,1);assert.equal(f.loads[0].cancel,1);assert.equal(f.stops,1);});
