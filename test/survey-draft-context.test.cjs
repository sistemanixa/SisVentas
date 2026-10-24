'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require.resolve('../js/modules/surveys.js'),'utf8');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function sample(id='REL-ficticio'){return {id,cliente:'Cliente ficticio',direccion:'Sitio de prueba',contacto:'',services:['otro'],items:{'otro.necesidad':{value:'Tarea ficticia',note:'Conservar'}},createdAt:'2026-10-24T12:00:00.000Z',autor:'Persona ficticia',owner:'A@example.test'};}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}
function deferred(){let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};}
function fixture(options={}){
 const events={},windowEvents={},records=new Map([['A@example.test',sample('REL-A')],['B@example.test',sample('REL-B')]]),transactions=[],pending=[],sets=[],notices=[],watches=[];
 let dbRequest,products=0,active=true;const controls=[{disabled:false},{disabled:false}],button={textContent:'Guardar relevamiento'},status={textContent:''};
 const page={isConnected:true,innerHTML:'',attrs:{},classList:{contains:()=>active},setAttribute(k,v){this.attrs[k]=v;},querySelectorAll:()=>controls,querySelector:()=>button};
 const database={transaction(_name,mode){const tx={mode,error:null,objectStore(){const operation=(kind,key,value)=>{const request={},entry={kind,key,value:clone(value),mode,tx,request};transactions.push(entry);entry.complete=()=>{if(kind==='put')records.set(key,clone(value));if(kind==='delete')records.delete(key);request.result=kind==='get'?clone(entry.value):undefined;tx.oncomplete?.();};if(kind==='get')entry.value=clone(records.get(key));if(options.hold===kind)pending.push(entry);else queueMicrotask(entry.complete);return request;};return {get:key=>operation('get',key),put:(value,key)=>operation('put',key,value),delete:key=>operation('delete',key)};}};return tx;}};
 const indexedDB={open(){const request={result:database};dbRequest=request;if(!options.holdOpen)queueMicrotask(()=>request.onsuccess?.());return request;}};
 const window={isAuthenticated:true,currentUserUid:'actor-A',currentUserEmail:'A@example.test',currentUser:'Persona A',currentRole:'tecnico',fbAuth:{currentUser:{uid:'actor-A'}},PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:1,_svDataEpoch:1,_impersonacionOriginal:null,
  location:{hash:'#/relevamientos'},SVForegroundSession:{isVisible:()=>!document.hidden},permisoModulo:()=>true,fbDB:{},fbRef:(_db,path)=>path,fbCargarProductos:()=>products++,
  fbSet(path,data){const response=deferred();sets.push({path,data:clone(data),...response});if(!options.holdSet)response.resolve();return response.promise;},
  fbOnValue(ref,receive,error){const entry={ref,receive,error,stops:0};watches.push(entry);return ()=>entry.stops++;},
  notify:message=>notices.push(message),addEventListener:(name,fn)=>(windowEvents[name]||=[]).push(fn),scrollTo(){},scrollY:0};
 const document={hidden:false,visibilityState:'visible',getElementById:id=>id==='page-relevamientos'?page:id==='rel-draft-status'?status:null,addEventListener:(name,fn)=>(events[name]||=[]).push(fn)};
 const context={window,document,indexedDB,navigator:{onLine:true},crypto:crypto.webcrypto,console,Date,Promise};vm.createContext(context);
 vm.runInContext(source.replace(/\}\)\(\);\s*$/,'window.__surveyTest={open,save,persist,local,context:draftContext,setQueue(value){saveQueue=value;},seed(value){draft=value;loadedOwner=owner();loadedContext=draftContext();},getDraft(){return draft;},getBusy(){return busy;}};})();'),context);
 const hooks=window.__surveyTest;
 function emit(name,detail={}){return Promise.all((events[name]||[]).map(fn=>fn({detail})));}
 function emitUI(name,target){return Promise.all((events[name]||[]).map(fn=>fn({target})));}
 function actorB(){window.currentUserUid='actor-B';window.currentUserEmail='B@example.test';window.currentUser='Persona B';window.fbAuth.currentUser={uid:'actor-B'};}
 return {window,document,page,controls,button,status,transactions,pending,sets,notices,watches,hooks,records,context,products:()=>products,emit,emitUI,actorB,active:value=>active=value,
  releaseOpen:()=>dbRequest.onsuccess?.(),failOpen:()=>{dbRequest.error=Error('IndexedDB ficticio');dbRequest.onerror?.();},release:(index=0)=>pending.splice(index,1)[0].complete()};
}
test('la clave de IndexedDB queda capturada antes de esperar su apertura',async()=>{
 const f=fixture({holdOpen:true});const task=f.hooks.local(undefined,'A@example.test',()=>true);f.actorB();f.releaseOpen();const value=await task;assert.equal(value.id,'REL-A');assert.equal(f.transactions[0].key,'A@example.test');
});
test('persistir no inicia una transacción de otro actor después de esperar IndexedDB',async()=>{
 const f=fixture({holdOpen:true});f.hooks.seed(sample('REL-A'));f.hooks.persist();await settle();f.actorB();f.releaseOpen();await settle();assert.equal(f.transactions.length,0);assert.equal(f.records.get('B@example.test').id,'REL-B');assert.equal(f.status.textContent,'');
});
test('un borrador local pendiente puede terminar en su dueño original al salir de la página',async()=>{
 const f=fixture({holdOpen:true});f.hooks.seed(sample('REL-A-modificado'));f.hooks.persist();await settle();f.active(false);await f.emit('sisventas:page-changed',{page:'dashboard'});f.releaseOpen();await settle();assert.equal(f.transactions.length,1);assert.equal(f.transactions[0].key,'A@example.test');assert.equal(f.records.get('A@example.test').id,'REL-A-modificado');assert.equal(f.records.get('B@example.test').id,'REL-B');assert.equal(f.status.textContent,'');
});
test('persistir conserva una copia y el orden de las modificaciones del mismo propietario',async()=>{
 const f=fixture();const draft=sample();f.hooks.seed(draft);draft.cliente='Primera modificación';f.hooks.persist();draft.cliente='Segunda modificación';f.hooks.persist();await settle();assert.deepEqual(f.transactions.map(t=>t.value.cliente),['Primera modificación','Segunda modificación']);assert.equal(f.records.get('A@example.test').cliente,'Segunda modificación');
});
test('un borrador viejo en memoria no se persiste ni guarda como el nuevo actor',async()=>{
 const f=fixture();const old=sample('REL-A');f.hooks.seed(old);f.actorB();f.hooks.persist();await f.hooks.save();await settle();assert.equal(f.transactions.length,0);assert.equal(f.sets.length,0);assert.equal(f.records.get('B@example.test').id,'REL-B');
});
for(const [name,change]of Object.entries({UID:f=>f.window.currentUserUid='actor-B',email:f=>f.window.currentUserEmail='B@example.test',época:f=>f.window._svOperacionesSesionEpoch++,épocaDatos:f=>f.window._svDataEpoch++,revisión:f=>f.window.PERMISOS_ROLES.tecnico.indiceRevision++,Auth:f=>f.window.fbAuth.currentUser={uid:'actor-A'}}))test('open no aplica el borrador anterior al cambiar '+name+' durante get',async()=>{
 const f=fixture({hold:'get'});const task=f.hooks.open();await settle();assert.equal(f.pending.length,1);change(f);f.page.innerHTML='Pantalla posterior';f.release();await task;assert.equal(f.hooks.getDraft(),null);assert.equal(f.page.innerHTML,'Pantalla posterior');assert.equal(f.products(),0);
});
test('UID de pantalla distinto de Auth impide abrir IDB, persistir o guardar',async()=>{
 const f=fixture();f.window.currentUserUid='otra-persona';f.hooks.seed(sample('REL-A'));await f.hooks.open();f.hooks.persist();await f.hooks.save();await settle();assert.equal(f.transactions.length,0);assert.equal(f.sets.length,0);assert.equal(f.products(),0);assert.equal(f.watches.length,0);
});
test('la época de datos cambia antes de abrir una transacción IDB o enviar al SDK',async()=>{
 const f=fixture({holdOpen:true});f.hooks.seed(sample('REL-A'));f.hooks.persist();await settle();f.window._svDataEpoch++;f.releaseOpen();await settle();assert.equal(f.transactions.length,0);
 const q=fixture(),wait=deferred();q.hooks.seed(sample('REL-A'));q.hooks.setQueue(wait.promise);const task=q.hooks.save();q.window._svDataEpoch++;wait.resolve();await task;assert.equal(q.sets.length,0);assert.equal(q.transactions.length,0);
});
test('dos aperturas con respuestas inversas conservan sólo el borrador del actor vigente',async()=>{
 const f=fixture({hold:'get'});const first=f.hooks.open();await settle();f.actorB();const second=f.hooks.open();await settle();f.release(1);await second;assert.equal(f.hooks.getDraft().id,'REL-B');const ready=f.page.innerHTML;f.release(0);await first;assert.equal(f.hooks.getDraft().id,'REL-B');assert.equal(f.page.innerHTML,ready);assert.equal(f.products(),1);
});
test('salir durante la apertura impide repintar y no carga productos fuera de pantalla',async()=>{
 const f=fixture({holdOpen:true});const task=f.hooks.open();f.active(false);await f.emit('sisventas:page-changed',{page:'dashboard'});f.releaseOpen();await task;assert.equal(f.transactions.length,1);assert.equal(f.hooks.getDraft(),null);assert.equal(f.products(),0);
});
test('un error de apertura tardío no sustituye la interfaz de otra sesión',async()=>{
 const f=fixture({holdOpen:true});const task=f.hooks.open();f.actorB();f.page.innerHTML='Sesión B';f.failOpen();await task;assert.equal(f.page.innerHTML,'Sesión B');assert.equal(f.products(),0);
});
test('Guardar cancela antes del SDK si cambió el contexto mientras esperaba persistencias',async()=>{
 const f=fixture(),queue=deferred();f.hooks.seed(sample('REL-A'));f.hooks.setQueue(queue.promise);const task=f.hooks.save();assert.equal(f.hooks.getBusy(),true);f.actorB();queue.resolve();await task;assert.equal(f.sets.length,0);assert.equal(f.transactions.length,0);assert.deepEqual(f.notices,[]);assert.equal(f.records.get('B@example.test').id,'REL-B');
});
test('Guardar toma el snapshot original y no ejecuta un segundo envío por doble clic',async()=>{
 const f=fixture({holdSet:true}),queue=deferred(),draft=sample('REL-A');f.hooks.seed(draft);f.hooks.setQueue(queue.promise);const task=f.hooks.save();draft.cliente='Cambio externo posterior';await f.hooks.save();queue.resolve();await settle();assert.equal(f.sets.length,1);assert.equal(f.sets[0].data.cliente,'Cliente ficticio');f.sets[0].resolve();await task;assert.equal(f.sets.length,1);assert.equal(f.hooks.getBusy(),false);
});
test('un ACK ya enviado por A no borra, notifica o lista datos para B',async()=>{
 const f=fixture({holdSet:true});f.hooks.seed(sample('REL-A'));const task=f.hooks.save();await settle();assert.equal(f.sets.length,1);assert.equal(f.sets[0].path,'sisventas/relevamientos/REL-A');f.actorB();await f.emit('sisventas:session-ended');const next=sample('REL-B-en-edición');f.hooks.seed(next);f.page.innerHTML='Edición de B';f.sets[0].resolve();await task;
 assert.equal(f.records.get('B@example.test').id,'REL-B');assert.equal(f.hooks.getDraft(),next);assert.equal(f.page.innerHTML,'Edición de B');assert.equal(f.transactions.length,0);assert.equal(f.watches.length,0);assert.deepEqual(f.notices,[]);
});
test('un fallo del SDK de A no muestra un error en B',async()=>{
 const f=fixture({holdSet:true});f.hooks.seed(sample('REL-A'));const task=f.hooks.save();await settle();f.actorB();await f.emit('sisventas:session-ended');f.sets[0].reject(Error('Fallo ficticio de A'));await task;assert.deepEqual(f.notices,[]);assert.equal(f.transactions.length,0);
});
test('Guardar correcto conserva formato, una sola escritura y borra únicamente el borrador confirmado',async()=>{
 const f=fixture();f.hooks.seed(sample('REL-A'));await f.hooks.save();assert.equal(f.sets.length,1);assert.equal(f.sets[0].data.items.otro.necesidad.value,'Tarea ficticia');assert.equal(f.sets[0].data.items['otro.necesidad'],undefined);assert.equal(f.records.has('A@example.test'),false);assert.equal(f.records.get('B@example.test').id,'REL-B');assert.deepEqual(f.transactions.map(t=>[t.kind,t.key]),[['delete','A@example.test']]);assert.deepEqual(f.notices,['Relevamiento guardado']);assert.equal(f.watches.length,1);assert.equal(f.hooks.getBusy(),false);
});
test('ACK remoto seguido de fallo local informa éxito y permite completar sólo la limpieza',async()=>{
 const f=fixture({hold:'delete'});const draft=sample('REL-A');f.hooks.seed(draft);const first=f.hooks.save();await settle();const failed=f.pending.shift();failed.tx.error=Error('Fallo local ficticio');failed.tx.onerror();await first;
 assert.equal(f.sets.length,1);assert.equal(f.sets[0].path,'sisventas/relevamientos/REL-A');assert.equal(f.hooks.getDraft(),draft);assert.equal(f.records.get('A@example.test').id,'REL-A');assert.match(f.notices[0],/ya está guardado/);assert.doesNotMatch(f.notices[0],/^No se pudo guardar/);assert.equal(f.button.textContent,'Completar guardado local');
 const confirmed=JSON.stringify(f.sets[0].data);f.context.navigator.onLine=false;const retry=f.hooks.save();await settle();assert.equal(f.sets.length,1);f.release();await retry;assert.equal(f.sets.length,1);assert.equal(JSON.stringify(f.sets[0].data),confirmed);assert.equal(f.records.has('A@example.test'),false);assert.equal(f.records.get('B@example.test').id,'REL-B');assert.equal(f.hooks.getDraft(),null);assert.equal(f.notices.at(-1),'Relevamiento guardado');
});
test('editar un borrador ya confirmado requiere una nueva escritura del mismo ID',async()=>{
 const f=fixture({hold:'delete'}),draft=sample('REL-A');f.hooks.seed(draft);const first=f.hooks.save();await settle();const failed=f.pending.shift();failed.tx.error=Error('Fallo local ficticio');failed.tx.onerror();await first;
 draft.cliente='Edición explícita posterior';f.hooks.persist();await settle();assert.equal(f.button.textContent,'Guardar relevamiento');const next=f.hooks.save();await settle();assert.equal(f.sets.length,2);assert.equal(f.sets[1].path,'sisventas/relevamientos/REL-A');assert.equal(f.sets[1].data.cliente,'Edición explícita posterior');f.release();await next;
});
test('la limpieza confirmada de A no se reutiliza para el borrador de B',async()=>{
 const f=fixture({hold:'delete'});f.hooks.seed(sample('REL-A'));const first=f.hooks.save();await settle();const failed=f.pending.shift();failed.tx.error=Error('Fallo local ficticio');failed.tx.onerror();await first;
 f.actorB();await f.emit('sisventas:session-ended');f.hooks.seed(sample('REL-B'));const next=f.hooks.save();await settle();assert.equal(f.sets.length,2);assert.equal(f.sets[1].path,'sisventas/relevamientos/REL-B');f.release();await next;assert.equal(f.records.get('A@example.test').id,'REL-A');
});
test('cambiar de usuario mientras se confirma delete mantiene la clave capturada y no repinta B',async()=>{
 const f=fixture({hold:'delete'});f.hooks.seed(sample('REL-A'));const task=f.hooks.save();await settle();assert.equal(f.pending[0].key,'A@example.test');f.actorB();await f.emit('sisventas:session-ended');const next=sample('REL-B-edición');f.hooks.seed(next);f.page.innerHTML='Edición B';f.release();await task;assert.equal(f.records.has('A@example.test'),false);assert.equal(f.records.get('B@example.test').id,'REL-B');assert.equal(f.hooks.getDraft(),next);assert.equal(f.page.innerHTML,'Edición B');assert.deepEqual(f.notices,[]);assert.equal(f.watches.length,0);
});
test('una denegación de permiso antes de confirmar impide el envío y conserva el borrador',async()=>{
 const f=fixture(),queue=deferred();f.hooks.seed(sample('REL-A'));f.hooks.setQueue(queue.promise);const task=f.hooks.save();f.window.permisoModulo=()=>false;queue.resolve();await task;assert.equal(f.sets.length,0);assert.equal(f.records.get('A@example.test').id,'REL-A');
});
test('el input de otra identidad no modifica el borrador que quedó en memoria',async()=>{
 const f=fixture(),draft=sample('REL-A');f.hooks.seed(draft);f.actorB();const input={closest:()=>f.page,dataset:{meta:'cliente'},value:'Dato de B'};await f.emitUI('input',input);
 assert.equal(draft.cliente,'Cliente ficticio');assert.equal(f.transactions.length,0);
});
test('los botones de otra identidad no modifican ni repintan el borrador anterior',async()=>{
 const f=fixture(),draft=sample('REL-A');f.hooks.seed(draft);f.actorB();f.page.innerHTML='Interfaz de B';const button={dataset:{service:'alarma'},hasAttribute:()=>false,closest:selector=>selector==='button'?button:f.page};await f.emitUI('click',button);
 assert.deepEqual(draft.services,['otro']);assert.equal(f.page.innerHTML,'Interfaz de B');assert.equal(f.transactions.length,0);assert.equal(f.sets.length,0);
});
test('al ocultar durante un envío no se pierde el borrador ni quedan controles bloqueados',async()=>{
 const f=fixture({holdSet:true});f.hooks.seed(sample('REL-A'));const task=f.hooks.save();await settle();f.document.hidden=true;f.document.visibilityState='hidden';f.sets[0].resolve();await task;assert.equal(f.records.get('A@example.test').id,'REL-A');assert.deepEqual(f.controls.map(c=>c.disabled),[false,false]);assert.deepEqual(f.notices,[]);assert.equal(f.watches.length,0);
});
test('una imagen preparada para A no termina adjunta al borrador de B',async()=>{
 const f=fixture(),photo=deferred();f.hooks.seed(sample('REL-A'));f.window.svPrepararAdjuntoImagen=()=>photo.promise;
 const task=f.emitUI('change',{closest:()=>f.page,dataset:{photo:'otro.necesidad'},files:[{name:'ficticia.png'}]});await settle();assert.equal(f.hooks.getBusy(),true);
 f.actorB();await f.emit('sisventas:session-ended');const next=sample('REL-B');f.hooks.seed(next);f.page.innerHTML='Edición B';photo.resolve({data:'data:image/png;base64,AA=='});await task;
 assert.equal(next.items['otro.necesidad'].photo,undefined);assert.equal(f.page.innerHTML,'Edición B');assert.equal(f.transactions.length,0);assert.deepEqual(f.notices,[]);
});
test('una imagen que termina oculta conserva el borrador y libera los controles sin guardar',async()=>{
 const f=fixture(),photo=deferred(),draft=sample('REL-A');f.hooks.seed(draft);f.window.svPrepararAdjuntoImagen=()=>photo.promise;
 const task=f.emitUI('change',{closest:()=>f.page,dataset:{photo:'otro.necesidad'},files:[{name:'ficticia.png'}]});await settle();f.document.hidden=true;f.document.visibilityState='hidden';photo.resolve({data:'data:image/png;base64,AA=='});await task;
 assert.equal(draft.items['otro.necesidad'].photo,undefined);assert.deepEqual(f.controls.map(c=>c.disabled),[false,false]);assert.equal(f.transactions.length,0);assert.deepEqual(f.notices,[]);
});
