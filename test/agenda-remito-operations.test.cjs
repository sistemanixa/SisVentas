'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const settle=()=>new Promise(setImmediate);
function fixture(){
 const events=new Map(),notices=[],transactions=[],stored=new Map(),timers=new Map(),observers=[],reads=[],popups=[];
 let sequence=0,timerSequence=0,progress=0,stops=0,popupBlocked=false,permission=true;
 class Node{constructor(value=''){this.value=value;this.disabled=false;this.style={};this.isConnected=true;this.attrs={};this.handlers=new Map();this.dataset={};this.innerHTML='Guardar';this.tagName='INPUT';}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];if(k==='data-proceso-largo')delete this.dataset.procesoLargo;}getAttribute(k){return this.attrs[k]||'';}addEventListener(k,v){this.handlers.set(k,v);}removeEventListener(k,v){if(this.handlers.get(k)===v)this.handlers.delete(k);}closest(){return this;}}
 const button=new Node(),modal=new Node(),page=new Node();button.tagName='BUTTON';button.attrs.onclick='agGuardarEvento()';modal.style.display='flex';modal.querySelector=()=>button;
 const values={'ag-ev-desc':'Reunión ficticia','ag-ev-fecha':'2026-10-24','ag-ev-hora':'09:00','ag-ev-empleado':'Técnico ficticio','ag-ev-notas':'Nota ficticia'},nodes=Object.fromEntries(Object.entries(values).map(([id,value])=>[id,new Node(value)]));nodes['ag-modal-nuevo']=modal;
 const c={console:{warn(){}},Date,Promise,currentUser:'Admin ficticio',currentUserUid:'uid-ficticio',currentRole:'admin',isAuthenticated:true,fbDB:{},fbAuth:{currentUser:{uid:'uid-ficticio'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},_svOperacionesSesionEpoch:0,navigator:{onLine:true},location:{hash:'#/agenda'},
  document:{activeElement:button,getElementById:id=>nodes[id]||null,querySelector:()=>page,addEventListener(k,v){if(!events.has(k))events.set(k,new Set());events.get(k).add(v);},removeEventListener(k,v){events.get(k)?.delete(v);}},
  MutationObserver:class{constructor(callback){this.callback=callback;this.records=[];observers.push(this);}observe(){}disconnect(){this.records=[];}takeRecords(){return this.records.splice(0);}},
  notify:message=>notices.push(message),tienePermiso:()=>permission,permisoModulo:()=>permission,
  fbRef:(_db,path)=>path,fbPush:path=>({key:'evento-'+(++sequence),path:path+'/evento-'+sequence}),
  fbRunTransaction:(ref,update,options)=>new Promise((resolve,reject)=>transactions.push({ref,update,options,resolve,reject})),
  SisVentas:{carga:{mostrar(){const close=()=>progress++;close.actualizar=()=>{};return close;}}},
  setTimeout(fn,ms){const id=++timerSequence;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  escapeHTML:value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),logoImpresionActualUrl:()=>'',nombreClienteVigente:r=>r.cliente,
  open(){if(popupBlocked)return null;const popup={closed:false,html:'',printed:0,close(){this.closed=true;},print(){this.printed++;},document:{write(html){popup.html+=html;},close(){}}};popups.push(popup);return popup;},
  SVDataReadiness:{begin:()=>({ready(){},error(){},cancel(){}})}};
 c.window=c;vm.createContext(c);
 const firebase=fs.readFileSync('js/core/firebase.js','utf8');c.onValue=(...args)=>{reads.push(args);return()=>stops++;};vm.runInContext(firebase.slice(firebase.indexOf('    const fbValueListeners ='),firebase.indexOf('    window.fbUpdate      =')),c);
 load(c,['svCapturarContextoOperacion','svCrearProgresoBoton','svPostventaEsperar','svAgendaRetenerIntento','agGuardarEvento','imprimirRemito']);
 function emit(type){for(const fn of [...(events.get(type)||[])])fn({type});}
 function finish(index,{loseAck=false}={}){const tx=transactions[index],current=stored.has(tx.ref.path)?stored.get(tx.ref.path):null,next=tx.update(current);if(next===undefined){tx.resolve({committed:false,snapshot:{val:()=>current}});return;}stored.set(tx.ref.path,structuredClone(next));if(loseAck)tx.reject(Error('Acuse ficticio perdido'));else tx.resolve({committed:true,snapshot:{val:()=>next}});}
 function fire(ms){for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}
 return{c,nodes,modal,button,page,events,notices,transactions,stored,timers,observers,reads,popups,emit,finish,fire,stats:()=>({allocated:sequence,progress,stops}),permission:value=>permission=value,blockPopup:()=>popupBlocked=true};
}
test('Agenda devuelve una promesa única, señala actividad y confirma una sola creación puntual',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento(),duplicate=f.c.agGuardarEvento();assert.equal(first,duplicate);assert.equal(f.button.disabled,true);assert.match(f.button.innerHTML,/Guardando/);await settle();
 assert.equal(f.transactions.length,1);assert.equal(f.stats().allocated,1);assert.equal(f.transactions[0].options.applyLocally,false);assert.equal(f.reads.length,0);f.finish(0);assert.equal(await first,true);assert.equal(f.stored.size,1);assert.equal(f.modal.style.display,'none');assert.equal(f.button.disabled,false);assert.equal(f.stats().progress,1);
});
test('Agenda conserva formulario al fallar y reutiliza la misma clave tras perderse un acuse',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.finish(0,{loseAck:true});assert.equal(await first,false);assert.equal(f.modal.style.display,'flex');assert.equal(f.nodes['ag-ev-desc'].value,'Reunión ficticia');assert.equal(f.button.disabled,false);
 const retry=f.c.agGuardarEvento();await settle();assert.equal(f.stats().allocated,1);assert.equal(f.transactions[1].ref.path,f.transactions[0].ref.path);f.finish(1);assert.equal(await retry,true);assert.equal(f.stored.size,1);
});
test('maximizar o mover el diálogo no libera el guardado ni crea otra alta',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.modal.style.width='90vw';f.observers[0].records.push({attributeName:'style',oldValue:'display:flex;width:440px'});f.observers[0].callback(f.observers[0].takeRecords());
 assert.equal(f.c.agGuardarEvento(),first);assert.equal(f.button.disabled,true);assert.equal(f.transactions.length,1);f.finish(0);assert.equal(await first,true);assert.equal(f.stats().allocated,1);
});
test('ocultar y reabrir en el mismo tick invalida el diálogo anterior aunque no cambien sus campos',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.observers[0].records.push({attributeName:'style',oldValue:'display:flex'},{attributeName:'style',oldValue:'display:none'});f.modal.style.display='flex';f.finish(0);await first;
 assert.equal(f.modal.style.display,'flex');assert.equal(f.notices.length,0);assert.equal(f.button.disabled,false);
});
test('Agenda no sobrescribe una edición de otro equipo al reintentar un acuse ambiguo',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.finish(0,{loseAck:true});await first;const key=f.transactions[0].ref.path;f.stored.get(key).notas='Edición concurrente ficticia';
 const retry=f.c.agGuardarEvento();await settle();f.finish(1);assert.equal(await retry,false);assert.equal(f.stored.get(key).notas,'Edición concurrente ficticia');assert.equal(f.modal.style.display,'flex');assert.match(f.notices.at(-1),/cambió/);
});
test('editar después de un acuse perdido no clona el evento ni reserva una segunda clave',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.finish(0,{loseAck:true});await first;f.nodes['ag-ev-desc'].value='Otro evento ficticio';assert.equal(await f.c.agGuardarEvento(),false);assert.equal(f.stats().allocated,1);assert.equal(f.transactions.length,1);assert.equal(f.stored.size,1);assert.match(f.notices.at(-1),/evento sin confirmar/);assert.equal(f.modal.style.display,'flex');
});
test('Agenda no permite guardar con Ver como ya activo',async()=>{const f=fixture();f.c._impersonacionOriginal={uid:'uid-ficticio'};assert.equal(await f.c.agGuardarEvento(),false);assert.equal(f.transactions.length,0);assert.equal(f.stats().allocated,0);});
test('Cerrar tras un fallo descarta el intento retenido y permite un evento nuevo deliberado',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.finish(0,{loseAck:true});await first;f.modal.style.display='none';f.observers[1].records.push({attributeName:'style',oldValue:'display:flex'});f.observers[1].callback(f.observers[1].takeRecords());f.modal.style.display='flex';f.nodes['ag-ev-desc'].value='Evento nuevo deliberado';const next=f.c.agGuardarEvento();await settle();assert.equal(f.stats().allocated,2);f.finish(1);assert.equal(await next,true);assert.equal(f.stored.size,2);
});
test('Una confirmación pendiente de Agenda vence sin dar éxito ni duplicar el reintento',async()=>{
 const f=fixture(),first=f.c.agGuardarEvento();await settle();f.fire(20000);assert.equal(await first,false);assert.equal(f.button.disabled,false);assert.equal(f.modal.style.display,'flex');assert.match(f.notices.at(-1),/demoró demasiado/);f.finish(0);await settle();assert.equal(f.modal.style.display,'flex');const retry=f.c.agGuardarEvento();await settle();assert.equal(f.stats().allocated,1);f.finish(1);assert.equal(await retry,true);assert.equal(f.stored.size,1);
});
for(const change of ['uid','auth','role','revision','route','page','dialog'])test('Agenda descarta la respuesta de otro contexto: '+change,async()=>{
 const f=fixture(),task=f.c.agGuardarEvento();await settle();
 if(change==='uid')f.c.currentUserUid='otro';if(change==='auth')f.c.fbAuth.currentUser={uid:'uid-ficticio'};if(change==='role')f.c.currentRole='tecnico';if(change==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(change==='route')f.c.location.hash='#/productos';if(change==='page')f.c.document.querySelector=()=>({});if(change==='dialog'){f.observers[0].records.push({type:'attributes'});f.modal.style.display='flex';f.nodes['ag-ev-desc'].value='Formulario posterior';}
 const previous=f.notices.length;f.finish(0);await task;assert.equal(f.modal.style.display,'flex');assert.equal(f.notices.length,previous);assert.equal(f.button.disabled,false);
});
test('Agenda no inicia escrituras sin permiso, sin conexión o cuando la sesión cambia antes del envío',async()=>{
 for(const state of ['permission','offline','session']){const f=fixture();if(state==='permission')f.permission(false);if(state==='offline')f.c.navigator.onLine=false;const task=f.c.agGuardarEvento();if(state==='session'){f.c.currentUserUid='otro';f.emit('sisventas:session-ended');}assert.equal(await task,false);assert.equal(f.transactions.length,0);assert.equal(f.stats().allocated,0);}
});
test('Agenda libera la operación al cerrar y el acuse anterior no cierra el diálogo siguiente',async()=>{
 const f=fixture(),task=f.c.agGuardarEvento();await settle();f.emit('sisventas:page-changed');assert.equal(f.button.disabled,false);f.nodes['ag-ev-desc'].value='Formulario posterior';f.finish(0);await task;assert.equal(f.modal.style.display,'flex');assert.equal(f.notices.length,0);
});
test('un fallo visual después del acuse de Agenda no anuncia una persistencia rechazada',async()=>{
 const f=fixture(),task=f.c.agGuardarEvento();await settle();f.c.notify=()=>{throw Error('Render ficticio fallido');};f.finish(0);assert.equal(await task,true);assert.equal(f.stored.size,1);assert.equal(f.button.disabled,false);
});
test('Remito bloqueado informa ventanas emergentes sin lectura ni TypeError',async()=>{
 const f=fixture();f.blockPopup();assert.equal(await f.c.imprimirRemito('remito-ficticio'),false);assert.equal(f.reads.length,0);assert.match(f.notices.at(-1),/ventanas emergentes/);
});
test('Remito conserva onlyOnce y cancela la lectura al primer snapshot, sin imprimir de nuevo',async()=>{
 const f=fixture(),task=f.c.imprimirRemito('remito-ficticio');assert.equal(f.reads.length,1);assert.equal(f.reads[0][3].onlyOnce,true);const snap={val:()=>({numero:'R-FICTICIO',cliente:'Cliente ficticio',fecha:'2026-10-24'})};f.reads[0][1](snap);await settle();f.reads[0][1](snap);assert.equal(f.stats().stops,1);f.fire(500);assert.equal(await task,true);assert.equal(f.popups[0].printed,1);assert.equal(f.timers.size,0);
});

for(const changed of [false,true])test('Remito espera recursos sin otra lectura y revalida al terminar: '+changed,async()=>{
 const f=fixture();let finishResources;
 f.c.SVPrintLayout={ready:()=>new Promise(resolve=>{finishResources=resolve;})};
 const task=f.c.imprimirRemito('remito-ficticio');f.reads[0][1]({val:()=>({numero:'R-FICTICIO'})});await settle();f.fire(500);await settle();
 assert.equal(f.popups[0].printed,0);assert.equal(f.reads.length,1);
 if(changed)f.c.PERMISOS_ROLES.admin.indiceRevision++;
 finishResources();assert.equal(await task,!changed);assert.equal(f.popups[0].printed,changed?0:1);assert.equal(f.stats().stops,1);
});
for(const change of ['closed','session','revision','route'])test('Remito no imprime al retirarse el contexto: '+change,async()=>{
 const f=fixture(),task=f.c.imprimirRemito('remito-ficticio');f.reads[0][1]({val:()=>({numero:'R-FICTICIO'})});await settle();if(change==='closed')f.popups[0].closed=true;if(change==='session'){f.c.currentUserUid='otro';f.emit('sisventas:session-ended');}if(change==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(change==='route')f.c.location.hash='#/clientes';f.fire(500);assert.equal(await task,false);assert.equal(f.popups[0].printed,0);assert.equal(f.timers.size,0);
});
for(const failure of ['denied','missing','timeout','document','print'])test('Remito informa el fallo y libera lectura/timers: '+failure,async()=>{
 const f=fixture(),task=f.c.imprimirRemito('remito-ficticio');if(failure==='denied')f.reads[0][2](Error('PERMISSION_DENIED'));else if(failure==='timeout')f.fire(15000);else{if(failure==='document')f.popups[0].document.write=()=>{throw Error('Documento bloqueado');};if(failure==='print')f.popups[0].print=()=>{throw Error('Impresión bloqueada');};f.reads[0][1]({val:()=>failure==='missing'?null:{numero:'R-FICTICIO'}});await settle();f.fire(500);}assert.equal(await task,false);assert.equal(f.popups[0].closed,true);assert.equal(f.timers.size,0);assert.equal(f.stats().stops,1);assert.ok(f.notices.length>0);
});
