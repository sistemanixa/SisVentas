'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('../js/core/foreground-session.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hidden=false,user=true,sdk=true}={}){
 const document=new EventTarget(),browser=new EventTarget(),calls=[],events=[];document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';
 const root={document,Event,fbDB:{},fbAuth:{currentUser:user?{uid:'ficticio'}:null},
  addEventListener:browser.addEventListener.bind(browser),dispatchEvent:browser.dispatchEvent.bind(browser),
  setTimeout:assert.fail,setInterval:assert.fail,fetch:assert.fail,fbStopAllValueListeners:assert.fail};
 const functions={fbGoOffline:database=>{assert.equal(database,root.fbDB);calls.push('offline');},fbGoOnline:database=>{assert.equal(database,root.fbDB);calls.push('online');}};
 if(sdk)Object.assign(root,functions);
 for(const name of ['paused','restored'])document.addEventListener('sisventas:foreground-'+name,()=>events.push(name));
 const api=root.SVForegroundSession=create(root);
 return {root,document,api,calls,events,functions,emit:name=>document.dispatchEvent(new Event(name)),browser:name=>browser.dispatchEvent(new Event(name)),
  hidden(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';document.dispatchEvent(new Event('visibilitychange'));}};
}
test('oculto suspende una vez y todas las esperas se reanudan sólo al volver visible, sin reloj ni lecturas',async()=>{
 const f=fixture({hidden:true}),done=[];const a=f.api.waitVisible().then(()=>done.push('a')),b=f.api.waitVisible().then(()=>done.push('b'));
 await settle();assert.deepEqual(done,[]);assert.deepEqual(f.calls,['offline']);f.emit('visibilitychange');assert.deepEqual(f.calls,['offline']);
 f.hidden(false);await Promise.all([a,b]);assert.deepEqual(done,['a','b']);assert.deepEqual(f.calls,['offline','online']);assert.deepEqual(f.events,['restored']);
 f.hidden(true);f.hidden(true);assert.deepEqual(f.calls,['offline','online','offline']);assert.deepEqual(f.events,['restored','paused']);
});
test('freeze y pagehide conservan la barrera aunque document.hidden sea falso',async()=>{
 const f=fixture(),done=[];f.emit('freeze');const pending=f.api.waitVisible().then(()=>done.push(true));f.browser('pagehide');f.emit('resume');await settle();
 assert.equal(f.api.isVisible(),false);assert.deepEqual(done,[]);assert.deepEqual(f.calls,['online','offline']);
 f.browser('pageshow');await pending;assert.equal(f.api.isVisible(),true);assert.deepEqual(done,[true]);assert.deepEqual(f.calls,['online','offline','online']);
});
test('abort antes o durante la espera rechaza AbortError y retira su listener sin reanudar después',async()=>{
 const f=fixture({hidden:true}),controller=new AbortController();let added=0,removed=0;
 const signal=controller.signal,add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
 signal.addEventListener=(...args)=>{added++;add(...args);};signal.removeEventListener=(...args)=>{removed++;remove(...args);};
 const rejected=assert.rejects(f.api.waitVisible({signal}),{name:'AbortError'});controller.abort();await rejected;assert.equal(added,1);assert.equal(removed,1);
 await assert.rejects(f.api.waitVisible({signal}),{name:'AbortError'});assert.equal(added,1);f.hidden(false);await settle();assert.equal(removed,1);
});
test('logout cancela todas las esperas y no revive el transporte por visibilidad o un signal viejo',async()=>{
 const f=fixture({hidden:true}),controller=new AbortController();const old=assert.rejects(f.api.waitVisible({signal:controller.signal}),{name:'AbortError'}),other=assert.rejects(f.api.waitVisible(),{name:'AbortError'});
 f.emit('sisventas:session-ended');await Promise.all([old,other]);f.hidden(false);assert.deepEqual(f.calls,['offline']);controller.abort();
 await assert.rejects(f.api.waitVisible({signal:controller.signal}),{name:'AbortError'});assert.deepEqual(f.calls,['offline']);
 await f.api.waitVisible({signal:new AbortController().signal});assert.deepEqual(f.calls,['offline','online'],'Un nuevo intento Auth visible puede verificar su perfil antes de session-ready');
});
test('sin usuario Auth no abre DB; un bootstrap válido la recupera antes de confirmar la sesión de app',async()=>{
 const f=fixture({user:false});assert.deepEqual(f.calls,['offline']);f.emit('firebase-ready');f.emit('sisventas:session-ready');assert.deepEqual(f.calls,['offline']);
 f.root.fbAuth.currentUser={uid:'otra'};await f.api.waitVisible();assert.deepEqual(f.calls,['offline','online']);
 f.emit('sisventas:session-ended');f.root.fbAuth.currentUser=null;f.hidden(true);f.hidden(false);assert.deepEqual(f.calls,['offline','online','offline']);
});
test('copias sin SDK no importan Firebase ni abren red, y pueden recibir el SDK más tarde',async()=>{
 const f=fixture({sdk:false,hidden:true});const waiting=f.api.waitVisible();assert.equal(f.api.syncDatabase(),false);assert.deepEqual(f.calls,[]);
 Object.assign(f.root,f.functions);f.emit('firebase-ready');assert.deepEqual(f.calls,['offline']);f.hidden(false);await waiting;assert.deepEqual(f.calls,['offline','online']);
 const next={};f.root.fbDB=next;f.root.fbGoOnline=db=>{assert.equal(db,next);f.calls.push('next-online');};f.api.syncDatabase();f.api.syncDatabase();assert.equal(f.calls.at(-1),'next-online');assert.equal(f.calls.filter(value=>value==='next-online').length,1);
});
test('un write iniciado conserva transporte al ocultar; último release suspende sin liberar lecturas',async()=>{
 const f=fixture(),first=f.api.holdDatabase(),second=f.api.holdDatabase();f.hidden(true);let ready=false;const waiting=f.api.waitVisible().then(()=>ready=true);await settle();
 assert.equal(f.api.isVisible(),false);assert.equal(ready,false);assert.deepEqual(f.calls,['online']);first();first();assert.deepEqual(f.calls,['online']);second();assert.deepEqual(f.calls,['online','offline']);
 f.hidden(false);await waiting;assert.equal(ready,true);assert.deepEqual(f.calls,['online','offline','online']);
});
test('release desde throw/rejection no queda retenido; un hold oculto no enciende DB',async()=>{
 const f=fixture();const release=f.api.holdDatabase();f.hidden(true);try{throw Error('Fallo ficticio del SDK');}catch(_){}finally{release();}
 assert.deepEqual(f.calls,['online','offline']);const hiddenHold=f.api.holdDatabase();f.api.syncDatabase();assert.deepEqual(f.calls,['online','offline']);
 await Promise.reject(Error('Rechazo ficticio del SDK')).finally(hiddenHold).catch(()=>{});assert.deepEqual(f.calls,['online','offline']);
});
test('logout tiene prioridad sobre holds antiguos y su release no mantiene otra sesión conectada',async()=>{
 const f=fixture(),old=f.api.holdDatabase();f.hidden(true);f.emit('sisventas:session-ended');assert.deepEqual(f.calls,['online','offline']);
 f.hidden(false);await f.api.waitVisible();const current=f.api.holdDatabase();f.hidden(true);old();assert.deepEqual(f.calls,['online','offline','online']);
 current();assert.deepEqual(f.calls,['online','offline','online','offline']);
});
test('off/on conserva listeners y presencia real se rearma con otra clave después de onDisconnect',async()=>{
 const f=fixture(),listeners=[],registrations=[],writes=[],retired=[],stored=new Map();let connected=true;
 Object.assign(f.root,{currentUserUid:'ficticio',currentUser:'Persona ficticia',currentRole:'admin',_chatDirectorio:{ficticio:{activo:true,nombre:'Persona ficticia'}},
  fbRef:(_,path)=>path,fbServerTimestamp:()=>123,obtenerIdSesionPresencia:()=> 'tab',presenciaEstaActiva:()=>true,
  fbSet:(path,value)=>{writes.push(path);stored.set(path,value);return Promise.resolve();},fbRemove:path=>{stored.delete(path);return Promise.resolve();},
  fbOnValue:(path,callback)=>{const row={path,callback,active:true};listeners.push(row);if(path==='.info/connected')queueMicrotask(()=>callback({val:()=>connected}));return()=>{row.active=false;};},
  fbOnDisconnect:path=>{const row={path,armed:false};registrations.push(row);return {remove:()=>new Promise(resolve=>row.ack=()=>{row.armed=true;resolve();}),cancel:async()=>{row.armed=false;}};}});
 f.document.getElementById=()=>null;
 const emit=value=>{connected=value;listeners.filter(row=>row.active&&row.path==='.info/connected').forEach(row=>row.callback({val:()=>value}));};
 f.root.fbGoOffline=()=>{for(const row of registrations)if(row.armed){stored.delete(row.path);retired.push(row.path);row.armed=false;}emit(false);};f.root.fbGoOnline=()=>emit(true);
 vm.runInNewContext(fs.readFileSync('js/modules/chat-presence.js','utf8'),{window:f.root,document:f.document,queueMicrotask});
 f.root.SVChatPresence.start();await settle();assert.equal(writes.length,0);registrations[0].ack();await settle();assert.equal(stored.size,1);
 f.hidden(true);assert.equal(stored.size,0);assert.deepEqual(retired,[writes[0]]);assert.equal(listeners.filter(row=>row.active).length,2);
 f.hidden(false);await settle();assert.equal(registrations.length,2);assert.equal(writes.length,1,'La presencia nueva espera ACK');registrations[1].ack();await settle();
 assert.equal(stored.size,1);assert.notEqual(writes[0],writes[1]);assert.equal(listeners.filter(row=>row.active).length,2);
});
