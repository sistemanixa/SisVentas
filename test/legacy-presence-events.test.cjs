'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=process.env.SV_PRESENCE_PROPOSAL?fs.readFileSync(process.env.SV_PRESENCE_PROPOSAL,'utf8'):require('./helpers/active-app').readActiveApp().source;
const begin=source.indexOf('var _presenciaConexionEstado ='),end=source.indexOf('function _verificarHaberesPendientes',begin);
assert.notEqual(begin,-1,'La app activa debe incluir el ciclo de presencia por conexión');
const lifecycle=source.slice(begin,end<0?source.length:end);
function fixture(){
 const listeners=[],registrations=[],writes=[],metrics={starts:0,stops:0};
 const c={document:new EventTarget(),currentUserUid:'self',currentUser:'Ana',currentUserEmail:'ana@example.test',currentRole:'admin',fbAuth:{currentUser:{uid:'self'}},fbDB:{},
  fbRef:(_,path)=>path,fbServerTimestamp:()=>1000000,obtenerIdSesionPresencia:()=> 'tab',clavePresenciaSesionActual:()=> 'self__tab',
  iniciarMedicionUsoUsuario:()=>metrics.starts++,detenerMedicionUsoUsuario:()=>metrics.stops++,clearInterval(){},
  fbOnValue:(path,callback)=>{const item={path,callback,active:true};listeners.push(item);return()=>item.active=false;},
  fbOnDisconnect:path=>{const item={path,cancels:0};registrations.push(item);return{update:payload=>{item.payload=payload;return new Promise((resolve,reject)=>{item.resolve=resolve;item.reject=reject;});},cancel:()=>{item.cancels++;return Promise.resolve();}};},
  fbSet:(path,value)=>{writes.push({type:'set',path,value});return Promise.resolve();},fbUpdate:(path,value)=>{writes.push({type:'update',path,value});return Promise.resolve();}};
 c.window=c;vm.createContext(c);vm.runInContext(lifecycle,c);
 const emit=value=>listeners.filter(l=>l.active).forEach(l=>l.callback({val:()=>value}));
 const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
 const connect=async()=>{emit(true);registrations.at(-1).resolve();await flush();};
 return{c,listeners,registrations,writes,metrics,emit,flush,connect};
}
test('legado espera ACK y conserva TTL sin persistir marcador permanente',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);assert.equal(f.writes.length,0);f.registrations[0].resolve();await f.flush();
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].type,'set');assert.equal(Object.hasOwn(f.writes[0].value,'conexionPorEventos'),false);assert.equal(f.metrics.starts,1);
});
test('ACK inválido tras cerrar no crea fila vacía y sólo cancela su propio onDisconnect',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);const old=f.registrations[0];f.c.limpiarPresenciaOnline();assert.equal(f.writes.length,0);old.resolve();await f.flush();
 assert.equal(f.writes.length,0);assert.equal(old.cancels,1);
});
test('ACK después de desconexión no publica antes de reconectar',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);const old=f.registrations[0];f.emit(false);old.resolve();await f.flush();assert.equal(f.writes.length,0);assert.equal(old.cancels,1);
 await f.connect();assert.equal(f.writes.length,1);assert.notEqual(f.writes[0].path,old.path);
});
test('cerrar con UID vacío preserva historia de la sesión publicada usando sólo su ref capturada',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();await f.connect();const path=f.writes[0].path;f.c.currentUserUid='';f.c.currentUser='';f.c.limpiarPresenciaOnline();await f.flush();
 assert.equal(f.writes.length,2);assert.equal(f.writes[1].path,path);assert.equal(f.writes[1].type,'update');assert.deepEqual(Object.keys(f.writes[1].value).sort(),['online','ultimaDesconexion']);assert.equal(f.writes[1].value.online,false);
});
test('login del mismo UID genera otra ref y una finalización anterior no toca su sucesora',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);const old=f.registrations[0];f.c.limpiarPresenciaOnline();f.c.registrarPresenciaOnline();await f.connect();const next=f.writes[0].path;old.resolve();await f.flush();
 assert.equal(f.writes.length,1);assert.notEqual(old.path,next);assert.equal(old.cancels,1);assert.equal(f.registrations[1].cancels,0);
});
test('autenticación distinta con mismo UID y Ver como invalidan ACK sin escrituras',async()=>{
 for(const mutate of [c=>c.fbAuth.currentUser={uid:'self'},c=>c._impersonacionOriginal={uid:'self'},c=>c.currentUserUid='other']){
  const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);mutate(f.c);f.registrations[0].resolve();await f.flush();assert.equal(f.writes.length,0);
 }
});
test('un fallo de registro no publica y no programa sondeos ni reintentos',async()=>{
 const f=fixture();f.c.registrarPresenciaOnline();f.emit(true);f.registrations[0].reject(Error('denied'));await f.flush();assert.equal(f.writes.length,0);assert.equal(f.registrations.length,1);
});
