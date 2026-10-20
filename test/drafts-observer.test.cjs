'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/modules/commercial-drafts.js','utf8');
const now=1792494000000,ttl=30*86400000;
const plain=value=>JSON.parse(JSON.stringify(value));
const key=(uid,id)=>'sv:commercial-draft:v1:'+encodeURIComponent(uid)+':'+id;
const draft=(id,title,updated=now)=>({schema:1,id,kind:'presupuesto',updated,data:{fields:[{id:'pp-cli',value:title,data:{}}],rows:[],currency:'ARS'}});
function node(tag){
 return {tagName:tag.toUpperCase(),dataset:{},children:[],appendChild(child){this.children.push(child);return child;},replaceChildren(){this.children=[];},querySelector(){return null;},setAttribute(){},get rows(){return this.children;}};
}
function fixture(initial={}){
 const events={},storage={...initial},subscriptions=[],writes=[],timers=new Map(),messages=[];let timerId=0,storageWrites=0,grid=false;
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]||null},setItem:{value:(k,v)=>{storageWrites++;storage[k]=v;}},removeItem:{value:k=>{storageWrites++;delete storage[k];}}});
 const fields=[{id:'pp-cli',value:'Cliente inicial',type:'text',dataset:{},closest:()=>null}];
 const form={querySelectorAll:()=>fields,closest:()=>({classList:{contains:()=>true}}),getClientRects:()=>[1]},body=node('tbody');
 const on=(name,callback)=>{(events[name]||=[]).push(callback);};
 const c={currentUserUid:'propio',currentRole:'admin',navigator:{onLine:true},Date:class extends Date{static now(){return now;}},Math:Object.assign(Object.create(Math),{random:()=>0.25}),localStorage:storage,
  document:{hidden:true,getElementById:id=>id==='ppto-form-view'?form:grid&&id==='ppto-tbody-main'?body:null,querySelectorAll:()=>[],createElement:node,addEventListener:on},
  addEventListener:on,setInterval:callback=>{c.tick=callback;},setTimeout:callback=>{timers.set(++timerId,callback);return timerId;},clearTimeout:id=>timers.delete(id),notify:message=>messages.push(message),svConfirm:async()=>true,
  _pptoConIva:true,_pptoConDetalle:false,_pptoMonedaActual:'ARS',fbDB:{},fbRef:(_,path)=>path,
  fbOnValue:(path,next,error)=>{const sub={path,next,error,stopped:0};subscriptions.push(sub);return()=>sub.stopped++;},
  fbUpdate:(path,batch)=>{writes.push({path,batch:plain(batch)});return Promise.resolve();},
  fbGet(){throw Error('El observador no debe consultar datos');},fbSet(){throw Error('El observador no debe crear registros');},fetch(){throw Error('Sin red en esta prueba');}};
 c.window=c;vm.runInNewContext(source,c);
 const emit=(name,event={})=>(events[name]||[]).forEach(callback=>callback(event));
 return {c,storage,subscriptions,writes,timers,messages,fields,body,get storageWrites(){return storageWrites;},emit,
  start(){emit('sisventas:session-ready');},receive(data,sub=subscriptions.at(-1)){sub.next({val:()=>plain(data)});},
  edit(value){fields[0].value=value;c.svDrafts.flush();},runTimers(){for(const [id,callback]of [...timers])if(timers.delete(id))callback();},
  renderGrid(){grid=true;c.svDrafts.renderGrid();}};
}

test('dos observadores reciben estado inicial local sin conectar, escribir ni crear timers',()=>{
 const f=fixture({[key('propio','real')]:JSON.stringify(draft('real','Cliente ficticio'))}),a=[],b=[];
 const stopA=f.c.svDrafts.subscribe(state=>a.push(state)),stopB=f.c.svDrafts.subscribe(state=>b.push(state));
 assert.equal(a.length,1);assert.equal(b.length,1);assert.deepEqual(plain(a[0]),{ownerUid:'propio',ready:false,records:[draft('real','Cliente ficticio')],deletedIds:[]});
 assert.notEqual(a[0],b[0]);assert.equal(f.subscriptions.length,0);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);assert.equal(f.storageWrites,0);
 stopA();stopA();stopB();assert.equal(f.subscriptions.length,0);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);
});

test('publicar notifica a ambos sin sumar lecturas ni escrituras al circuito existente',()=>{
 function run(observe){const f=fixture(),states=[];if(observe){f.c.svDrafts.subscribe(state=>states.push(state));f.c.svDrafts.subscribe(()=>{});}f.start();f.receive({});f.c.svDrafts.begin('presupuesto');f.edit('Modificado');f.runTimers();return {f,states};}
 const baseline=run(false),observed=run(true);
 assert.equal(observed.f.subscriptions.length,baseline.f.subscriptions.length);assert.deepEqual(observed.f.writes,baseline.f.writes);
 assert.equal(observed.f.subscriptions.length,1);assert.equal(observed.f.writes.length,1);assert.equal(observed.states.at(-1).records[0].data.fields[0].value,'Modificado');
});

test('cada snapshot es una copia profundamente inmutable y un observador que falla no impide guardar',()=>{
 const f=fixture(),a=[],b=[];
 f.c.svDrafts.subscribe(state=>{a.push(state);if(state.records.length)state.records[0].data.fields[0].value='Cambio del observador';throw Error('Fallo del observador');});
 f.c.svDrafts.subscribe(state=>b.push(state));f.start();f.receive({});f.c.svDrafts.begin('presupuesto');f.edit('Contenido real');f.runTimers();
 const first=a.at(-1),second=b.at(-1);assert.notEqual(first,second);assert.ok(Object.isFrozen(first));assert.ok(Object.isFrozen(first.records));assert.ok(Object.isFrozen(first.records[0].data.fields[0]));
 assert.equal(second.records[0].data.fields[0].value,'Contenido real');assert.equal(Object.values(f.storage).map(JSON.parse)[0].data.fields[0].value,'Contenido real');assert.equal(f.writes[0].batch[first.records[0].id].data.fields[0].value,'Contenido real');
});

test('unsubscribe es idempotente y sólo retira su propio observador',()=>{
 const f=fixture(),a=[],b=[];const stop=f.c.svDrafts.subscribe(state=>a.push(state));f.c.svDrafts.subscribe(state=>b.push(state));
 f.c.svDrafts.begin('presupuesto');f.edit('Primero');stop();stop();f.edit('Segundo');
 assert.equal(a.length,2);assert.equal(b.length,3);assert.equal(b.at(-1).records[0].data.fields[0].value,'Segundo');assert.equal(f.subscriptions.length,1);
});

test('flush sin cambios, relojes, storage idéntico y snapshots remotos idénticos no repiten avisos',()=>{
 const d=draft('remoto','Sin cambios'),f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.start();f.receive({remoto:d});
 const count=states.length;for(let i=0;i<60;i++){f.c.tick();f.c.svDrafts.flush();}
 f.emit('storage',{key:key('propio','remoto'),newValue:JSON.stringify(d)});f.receive({remoto:d});f.receive({remoto:plain(d)});
 assert.equal(states.length,count);assert.equal(f.subscriptions.length,1);assert.equal(f.writes.length,0);
});

test('la escucha ya existente comunica ready y su error conserva registros locales sin reconectar por reloj',()=>{
 const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.start();assert.equal(f.subscriptions.length,1);assert.equal(states.at(-1).ready,false);
 f.receive({real:draft('real','Remoto')});assert.equal(states.at(-1).ready,true);assert.equal(states.at(-1).records.length,1);
 f.subscriptions[0].error(Error('Permiso rechazado'));assert.equal(states.at(-1).ready,false);assert.equal(states.at(-1).records[0].id,'real');
 const count=states.length;for(let i=0;i<30;i++)f.c.tick();assert.equal(states.length,count);assert.equal(f.subscriptions.length,1);assert.equal(f.subscriptions[0].stopped,1);
});

test('complete y descartar informan el mismo tombstone sin atribuirle un motivo de negocio',async()=>{
 for(const action of ['complete','discard']){
  const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.c.svDrafts.begin('presupuesto');f.edit('Borrador real');const id=states.at(-1).records[0].id;
  if(action==='complete')f.c.svDrafts.complete('presupuesto');else{f.renderGrid();const buttons=f.body.children[0].children.at(-1).children;await buttons[1].onclick();}
  const state=plain(states.at(-1));assert.deepEqual(state.records,[]);assert.deepEqual(state.deletedIds,[id]);assert.deepEqual(Object.keys(state).sort(),['deletedIds','ownerUid','ready','records']);
  const count=states.length;f.c.svDrafts.complete('presupuesto');assert.equal(states.length,count);
 }
});

test('deletedIds incluye tombstones recientes propios y storage externo no inicia sincronización',()=>{
 const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));
 for(const [id,updated]of [['reciente',now],['vencido',now-ttl],['futuro',now+1]])f.storage[key('propio',id)]=JSON.stringify({id,deleted:true,updated});
 f.storage[key('ajeno','privado')]=JSON.stringify({id:'privado',deleted:true,updated:now});f.emit('storage',{key:key('propio','reciente'),newValue:f.storage[key('propio','reciente')]});
 assert.deepEqual(plain(states.at(-1).deletedIds),['reciente']);const count=states.length;f.emit('storage',{key:key('ajeno','privado'),newValue:f.storage[key('ajeno','privado')]});
 assert.equal(states.length,count);assert.equal(f.subscriptions.length,0);assert.equal(f.writes.length,0);
});

test('un tombstone remoto actualiza el observador local sin publicar otro registro ni inferir su motivo',()=>{
 const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.start();f.receive({real:draft('real','Para mostrar')});
 const deleted={real:{id:'real',deleted:true,updated:now}};f.receive(deleted);assert.deepEqual(plain(states.at(-1).records),[]);assert.deepEqual(plain(states.at(-1).deletedIds),['real']);assert.equal(states.at(-1).ready,true);
 const count=states.length;f.receive(deleted);f.runTimers();assert.equal(states.length,count);assert.equal(f.subscriptions.length,1);assert.equal(f.writes.length,0);
});

test('logout invalida el contexto aunque se vuelva a ingresar con el mismo UID y descarta callbacks viejos',()=>{
 const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.start();f.receive({viejo:draft('viejo','Antes de salir')});const old=f.subscriptions[0];
 f.emit('sisventas:session-ended');assert.deepEqual(plain(states.at(-1)),{ownerUid:'propio',ready:false,records:[],deletedIds:[]});const count=states.length;
 f.start();f.receive({tarde:draft('tarde','Callback obsoleto')},old);f.receive({nuevo:draft('nuevo','Otra sesión')});assert.equal(states.length,count);assert.equal(f.storage[key('propio','tarde')],undefined);
});

test('cambiar UID o rol retira observadores anteriores sin entregarles registros del contexto nuevo',()=>{
 for(const change of ['uid','role']){
  const f=fixture(),states=[];f.c.svDrafts.subscribe(state=>states.push(state));f.start();f.receive({viejo:draft('viejo','Privado previo')});
  if(change==='uid'){f.c.currentUserUid='otro';f.emit('sisventas:session-ready');}else{f.c.currentRole='administrativo';f.emit('sisventas:role-changed');}
  assert.equal(states.at(-1).ready,false);assert.deepEqual(plain(states.at(-1).records),[]);assert.deepEqual(plain(states.at(-1).deletedIds),[]);assert.equal(states.at(-1).ownerUid,change==='uid'?'otro':'propio');
  const count=states.length,newStates=[];f.c.svDrafts.subscribe(state=>newStates.push(state));f.receive({nuevo:draft('nuevo','Sólo contexto nuevo')});assert.equal(states.length,count);assert.ok(newStates.at(-1).records.some(record=>record.id==='nuevo'));
 }
});

test('roles excluidos no reciben registros locales y el cambio de rol detiene la escucha existente',()=>{
 const f=fixture({[key('propio','privado')]:JSON.stringify(draft('privado','Privado'))}),states=[];f.start();f.receive({privado:draft('privado','Privado')});f.c.svDrafts.subscribe(state=>states.push(state));
 f.c.currentRole='distribuidora';f.emit('sisventas:role-changed');assert.deepEqual(plain(states.at(-1).records),[]);assert.equal(states.at(-1).ready,false);assert.equal(f.subscriptions[0].stopped,1);
 const excluded=[];f.c.svDrafts.subscribe(state=>excluded.push(state));assert.deepEqual(plain(excluded[0].records),[]);assert.deepEqual(plain(excluded[0].deletedIds),[]);assert.equal(f.subscriptions.length,1);
});

test('una mutación durante un callback no entrega luego una instantánea obsoleta al segundo observador',()=>{
 const f=fixture(),a=[],b=[];let completed=false;
 f.c.svDrafts.subscribe(state=>{a.push(state);if(state.records.length&&!completed){completed=true;f.c.svDrafts.complete('presupuesto');}});f.c.svDrafts.subscribe(state=>b.push(state));
 f.c.svDrafts.begin('presupuesto');f.edit('Se completa en callback');assert.equal(a.at(-1).records.length,0);assert.equal(b.at(-1).records.length,0);assert.equal(b.some(state=>state.records.length>0),false);assert.equal(b.at(-1).deletedIds.length,1);
});
