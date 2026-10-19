'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/modules/offline-core.js','utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<6;i++)await tick();}
function fixture({delayedOpen=false}={}){
 const stores={cache:new Map(),queue:new Map()},events={},writes=[],listeners=[];let openRequest;
 const db={transaction(name){const tx={};tx.objectStore=()=>({
  put(value){stores[name].set(value.key||value.id,structuredClone(value));setImmediate(()=>tx.oncomplete?.());},
  delete(id){stores[name].delete(id);setImmediate(()=>tx.oncomplete?.());},
  get(id){const req={};const value=stores[name].get(id);setImmediate(()=>{req.result=value;req.onsuccess?.();tx.oncomplete?.();});return req;},
  getAll(){const req={};const value=[...stores[name].values()];setImmediate(()=>{req.result=value;req.onsuccess?.();tx.oncomplete?.();});return req;}
 });return tx;}};
 const c={URLSearchParams,location:{search:'?offline_preview=1'},localStorage:{getItem:()=>null},navigator:{onLine:false},console,crypto:require('node:crypto'),indexedDB:{open(){openRequest={result:db};if(!delayedOpen)setImmediate(()=>openRequest.onsuccess?.());return openRequest;}},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},document:{addEventListener(name,fn){(events[name]||=[]).push(fn);},dispatchEvent(event){for(const fn of events[event.type]||[])fn(event);}},fbAuth:{currentUser:{uid:'A'}},currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:1}},firebaseReady:true,fbDB:{},fbRef:(_,path)=>({_path:{pieces_:path.split('/')}}),fbSet:async(ref,value)=>writes.push({path:ref._path.pieces_.join('/'),value}),fbUpdate:async()=>{},fbRemove:async()=>{},fbPush:()=>{},fbRunTransaction:async()=>{},fbOnValue(ref,next,error,options){const row={ref,next,error,options,stopped:false};listeners.push(row);return()=>{row.stopped=true;};},addEventListener(){}};c.window=c;vm.runInNewContext(source,c);
 return {c,stores,writes,listeners,open:()=>openRequest.onsuccess(),end:()=>c.document.dispatchEvent(new c.CustomEvent('sisventas:session-ended')),ref:path=>c.fbRef(c.fbDB,path)};
}
test('cache pendiente de A no se entrega al entrar B ni después de cancelar',async()=>{
 const f=fixture();f.stores.cache.set('A|sisventas/clientes',{key:'A|sisventas/clientes',value:{private:'A'}});const seen=[];const stop=f.c.fbOnValue(f.ref('sisventas/clientes'),s=>seen.push(s.val()));f.end();f.c.fbAuth.currentUser={uid:'B'};await settle();assert.equal(seen.length,0);stop();assert.equal(f.listeners[0].stopped,true);
});
test('respuesta nativa tardía no se guarda como cache de otra cuenta',async()=>{
 const f=fixture();const seen=[];f.c.fbOnValue(f.ref('sisventas/clientes'),s=>seen.push(s.val()));f.end();f.c.fbAuth.currentUser={uid:'B'};f.listeners[0].next({val:()=>({private:'A'})});await settle();assert.equal(seen.length,0);assert.equal(f.stores.cache.size,0);
});
test('cancelar antes de que IndexedDB abra impide devolver cache atrasada',async()=>{
 const f=fixture({delayedOpen:true});f.stores.cache.set('A|sisventas/clientes',{key:'A|sisventas/clientes',value:{private:'A'}});const seen=[];const stop=f.c.fbOnValue(f.ref('sisventas/clientes'),s=>seen.push(s.val()));stop();f.open();await settle();assert.equal(seen.length,0);
});
test('cada suscripción distingue su primera lectura local de los datos nativos',async()=>{
 const f=fixture();f.c.navigator.onLine=true;const seen=[];f.c.fbOnValue(f.ref('sisventas/clientes'),()=>{});f.listeners[0].next({val:()=>({live:true})});await settle();f.stores.cache.set('A|sisventas/agenda',{key:'A|sisventas/agenda',value:{cached:true}});f.c.fbOnValue(f.ref('sisventas/agenda'),s=>seen.push(s.val()));await settle();assert.equal(seen.length,1);assert.equal(seen[0].cached,true);
});
test('salir y entrar con el mismo UID detiene la segunda escritura de una cola',async()=>{
 const f=fixture();await f.c.fbSet(f.ref('sisventas/clientes/c1'),{name:'Uno'});await f.c.fbSet(f.ref('sisventas/clientes/c2'),{name:'Dos'});f.c.navigator.onLine=true;
 // El original capturado recibe la primera operación y el cierre sucede antes de la siguiente.
 const original=f.writes.push.bind(f.writes);f.writes.push=function(row){const value=original(row);f.end();return value;};
 await f.c.SisVentasOffline.sync();assert.equal(f.writes.length,1);assert.equal(f.stores.queue.size,2);
});
test('cambio de rol o revisión invalida la lectura anterior',async()=>{
 const f=fixture();let seen=0;f.c.fbOnValue(f.ref('sisventas/clientes'),()=>seen++);f.c.PERMISOS_ROLES.admin.indiceRevision=2;f.listeners[0].next({val:()=>({private:true})});await settle();assert.equal(seen,0);assert.equal(f.stores.cache.size,0);
});

test('una escritura en espera no se encola después de cambiar de cuenta',async()=>{const f=fixture({delayedOpen:true});const pending=f.c.fbSet(f.ref('sisventas/clientes/c'),{name:'Ficticio'});f.end();f.c.fbAuth.currentUser={uid:'B'};f.open();await assert.rejects(pending,{code:'SISVENTAS_OFFLINE_BLOCKED'});assert.equal(f.stores.queue.size,0);});
test('sin identidad autenticada no se encolan operaciones',async()=>{const f=fixture();f.c.fbAuth.currentUser=null;await assert.rejects(f.c.fbSet(f.ref('sisventas/clientes/c'),{}),{code:'SISVENTAS_OFFLINE_BLOCKED'});assert.equal(f.stores.queue.size,0);});
test('conserva las opciones del SDK cuando no se pasa callback de error',()=>{const f=fixture();const options={onlyOnce:true};f.c.fbOnValue(f.ref('sisventas/clientes'),()=>{},options);assert.equal(f.listeners[0].options,options);});
