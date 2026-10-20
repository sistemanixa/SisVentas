'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Model=require('../js/core/budget-presentation-model.js');
const source=fs.readFileSync('js/modules/budget-presentation.js','utf8');
const copy=value=>value==null?value:JSON.parse(JSON.stringify(value));
const now=1792494000000;
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function record(key='p1',changes={}){
 return {fbKey:key,id:'PP-FICTICIO-'+key,cliente:'Cliente ficticio',tituloSolucion:'Cámaras de ejemplo',moneda:'ARS',conIva:true,items:[{cod:'CAM-1',desc:'Cámara ficticia',qty:2,punit:100,disc:0,sub:200,costo:63,proveedor:'Proveedor privado'}],subtotal:200,descuentoGeneral:0,descuentoAmt:0,iva:42,total:242,creadoPorUid:'propio',notaInterna:'No mostrar nota interna',costoTotal:126,_svAudit:'No mostrar auditoría',...changes};
}
function draft(id='d1',saved=record(),changes={}){
 return {schema:1,id,kind:'presupuesto',updated:now,original:copy(saved),data:{edit:saved.fbKey,currency:'ARS',iva:true,fields:[{id:'pp-descuento',value:'10'},{id:'pp-cli',value:'Cliente ficticio'}],rows:[{cod:'CAM-1',desc:'Cámara ficticia',qty:'3',price:'100',disc:'0',data:{costoOriginal:63,proveedor:'Proveedor privado'}}]},...changes};
}
function element(tag){
 return {tagName:tag.toUpperCase(),dataset:{},children:[],attributes:{},parentElement:null,
  appendChild(child){child.parentElement=this;this.children.push(child);return child;},prepend(child){child.parentElement=this;this.children.unshift(child);},
  setAttribute(name,value){this.attributes[name]=String(value);},
  matches(selector){return selector==='[data-budget-view]'&&this.dataset.budgetView!==undefined;},
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;},
  querySelector(selector){if(selector==='.ppto-row-actions')return this.actions||null;for(const child of this.children){if(child.matches(selector))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
 };
}
function fixture(options={}){
 const events=new Map(),windowEvents=new Map(),local=new Set(),subscriptions=[],reads=[],lookups=[],views=[],messages=[],observers=[],modelCalls=[],forbidden=[];
 const records={p1:record('p1'),p2:record('p2'),...copy(options.records||{})};
 const rows=['p1','p2'].map(key=>{const row=element('tr');row.dataset.pptoRef=key;row.actions=element('div');row.actions.className='ppto-row-actions';row.appendChild(row.actions);return row;});
 const tbody=element('tbody');rows.forEach(row=>tbody.appendChild(row));
 const on=(target,name,callback,capture)=>{const list=target.get(name)||[];list.push({callback,capture});target.set(name,list);};
 const state={ownerUid:'propio',ready:true,records:[],deletedIds:[],...copy(options.initial||{})};
 const denied=name=>(...args)=>{forbidden.push({name,args});throw Error('Acceso no permitido en prueba: '+name);};
 const c={document:{hidden:false,createElement:element,getElementById:id=>id==='ppto-tbody-main'?tbody:null,querySelectorAll:selector=>selector==='#ppto-tbody-main tr[data-ppto-ref]'?rows:[],addEventListener:(name,fn,capture)=>on(events,name,fn,capture)},
  navigator:{onLine:true},isAuthenticated:true,currentUserUid:'propio',currentRole:'admin',fbAuth:{currentUser:{uid:'propio'}},fbDB:{ficticio:true},prodData:{p:{codigo:'CAM-1',nombre:'Catálogo actual',precio:9999,costo:4000,imagenUrl:'https://images.invalid/camara.png'}},
  permisoModulo:()=>true,notify:message=>messages.push(message),Date:class extends Date{static now(){return now;}},
  buscarPptoPorRef:key=>{lookups.push(key);return records[key]||Object.values(records).find(r=>r.id===key)||null;},
  fbRef:(_db,path)=>path,fbGet:async path=>{reads.push(path);if(options.read)return options.read(path);return {val:()=>copy(records[path.split('/').at(-1)])};},
  fbOnValue:denied('fbOnValue'),fbSet:denied('fbSet'),fbUpdate:denied('fbUpdate'),fbPush:denied('fbPush'),fetch:denied('fetch'),setInterval:denied('setInterval'),setTimeout:denied('setTimeout'),prepararPresupuesto:denied('prepararPresupuesto'),
  addEventListener:(name,fn)=>on(windowEvents,name,fn),
  SVBudgetPresentationModel:{fromRecord(saved,products){modelCalls.push({kind:'saved',key:saved.fbKey});return Model.fromRecord(saved,products);},fromDraft(d,saved,products){modelCalls.push({kind:'draft',id:d.id,key:saved.fbKey});return Model.fromDraft(d,saved,products);}},
  SVBudgetPresentationView:{create(callbacks){const view={callbacks,renders:[],closed:0,element:{},render(snapshot,details){this.renders.push({snapshot:copy(snapshot),details:copy(details)});},close(){if(this.closed)return;this.closed++;callbacks.onClose();}};views.push(view);return view;}},
  svDrafts:{subscribe(callback){const sub={callback,stopped:0};subscriptions.push(sub);local.add(sub);callback(copy(state));return()=>{if(local.delete(sub))sub.stopped++;};}},
  MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(target,settings){this.target=target;this.settings=settings;}}
 };
 c.window=c;if(options.configure)options.configure(c);vm.createContext(c);
 if(options.lexical){delete c.isAuthenticated;delete c.currentUserUid;delete c.currentRole;vm.runInContext("let isAuthenticated=true;let currentUserUid='propio';let currentRole='admin';",c);}
 vm.runInContext(source,c,{filename:'budget-presentation.js'});
 const emit=(name,event={})=>{for(const {callback}of [...(events.get(name)||[])])callback(event);};
 const emitWindow=(name,event={})=>{for(const {callback}of [...(windowEvents.get(name)||[])])callback(event);};
 const receive=update=>{Object.assign(state,copy(update));for(const sub of [...local])sub.callback(copy(state));};
 function click(target){const event={target,prevented:0,stopped:0,immediate:0,preventDefault(){this.prevented++;},stopPropagation(){this.stopped++;},stopImmediatePropagation(){this.immediate++;this.stopped++;}};emit('click',event);return event;}
 return {c,records,rows,tbody,events,windowEvents,subscriptions,reads,lookups,views,messages,observers,modelCalls,forbidden,state,receive,emit,emitWindow,click,get view(){return views.at(-1);},get last(){return views.at(-1)?.renders.at(-1);}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('abrir usa el registro ya cargado y sólo se suscribe al observador local, sin nuevas consultas ni escuchas',()=>{
 const f=fixture(),listeners=[...f.events].map(([key,list])=>[key,list.length]);
 f.c.SVBudgetPresentation.open('p1');
 assert.deepEqual(f.lookups,['p1']);assert.equal(f.subscriptions.length,1);assert.equal(f.observers.length,1);assert.equal(f.observers[0].target,f.tbody);assert.deepEqual(f.reads,[]);assert.deepEqual(f.forbidden,[]);
 assert.deepEqual([...f.events].map(([key,list])=>[key,list.length]),listeners);assert.equal(f.last.snapshot.total,242);assert.equal(f.last.details.status,'Versión guardada');
 f.c.SVBudgetPresentation.close();assert.equal(f.view.closed,1);assert.equal(f.subscriptions[0].stopped,1);
});

test('una edición propia del mismo presupuesto actualiza exactamente un render con descuento y sin datos internos',()=>{
 const f=fixture();f.c.SVBudgetPresentation.open('p1');const count=f.view.renders.length,original=copy(f.records.p1),d=draft();
 f.receive({records:[d]});
 assert.equal(f.view.renders.length,count+1);assert.equal(f.last.details.status,'En edición');assert.equal(f.last.details.selectedDraft,'d1');assert.equal(f.last.snapshot.items[0].quantity,3);assert.equal(f.last.snapshot.discountPct,10);assert.equal(f.last.snapshot.discount,30);assert.equal(f.last.snapshot.total,326.7);
 const publicData=JSON.stringify(f.last);assert.doesNotMatch(publicData,/creadoPorUid|costoOriginal|costoTotal|Proveedor privado|No mostrar|fbKey|propio/);assert.deepEqual(f.records.p1,original);assert.deepEqual(f.reads,[]);assert.deepEqual(f.forbidden,[]);
});

test('dos ediciones ambiguas no eligen en silencio; elegir fija la edición y la siguiente actualización no salta a otra',()=>{
 const a=draft('a'),b=draft('b',record(),{updated:now+1000}),f=fixture({initial:{records:[a,b]}});f.c.SVBudgetPresentation.open('p1');
 assert.equal(f.last.details.status,'Versión guardada');assert.equal(f.last.details.selectedDraft,'');assert.deepEqual(f.last.details.alternatives.map(d=>d.id),['a','b']);assert.equal(f.last.snapshot.total,242);assert.equal(f.modelCalls.some(call=>call.kind==='draft'),false);
 f.view.callbacks.onChooseDraft('b');assert.equal(f.last.details.selectedDraft,'b');assert.equal(f.last.snapshot.total,326.7);
 const updatedB=copy(b);updatedB.data.fields[0].value='20';const updatedA=copy(a);updatedA.data.fields[0].value='99';updatedA.updated=now+5000;
 f.receive({records:[updatedA,updatedB]});assert.equal(f.last.details.selectedDraft,'b');assert.equal(f.last.snapshot.discountPct,20);assert.equal(f.last.snapshot.total,290.4);
 const count=f.view.renders.length;f.view.callbacks.onChooseDraft('ajeno');assert.equal(f.view.renders.length,count);assert.deepEqual(f.reads,[]);
});

test('no sigue borradores de otra clave, otra clase, otro original o una versión inválida',()=>{
 const good=draft(),wrongKey=draft('otro',record('p2')),wrongKind=draft('venta',record(),{kind:'venta'}),wrongOriginal=draft('obsoleto',record('p1',{total:999})),wrongSchema=draft('futuro',record(),{schema:2});
 const f=fixture();f.c.SVBudgetPresentation.open('p1');f.receive({records:[wrongKey,wrongKind,wrongOriginal,wrongSchema,good]});assert.equal(f.last.details.selectedDraft,'d1');assert.deepEqual(f.last.details.alternatives.map(d=>d.id),['d1']);
 f.receive({records:[wrongKey]});assert.equal(f.last.details.status,'Edición finalizada');assert.equal(f.last.snapshot.number,'PP-FICTICIO-p1');assert.equal(f.last.snapshot.total,326.7);assert.deepEqual(f.reads,[]);
});

test('el tombstone de la edición elegida hace una sola lectura exacta y no supone que se guardó',async()=>{
 const pending=deferred(),f=fixture({initial:{records:[draft()]},read:path=>pending.promise});f.c.SVBudgetPresentation.open('p1');const count=f.view.renders.length;
 f.receive({records:[],deletedIds:['d1']});assert.deepEqual(f.reads,['sisventas/presupuestos/p1']);assert.equal(f.last.details.status,'Edición finalizada');assert.equal(f.last.snapshot.total,326.7);assert.equal(f.view.renders.length,count+1);
 f.receive({records:[],deletedIds:['d1']});assert.equal(f.reads.length,1);
 pending.resolve({val:()=>record('p1')});await settle();assert.equal(f.last.details.status,'Versión guardada');assert.equal(f.last.snapshot.total,242);assert.equal(f.last.details.selectedDraft,'');assert.equal(f.reads.length,1);assert.deepEqual(f.forbidden,[]);
});

test('un tombstone no seleccionado no consulta y Ver versión guardada comparte los clics mientras lee',async()=>{
 const pending=deferred(),f=fixture({initial:{records:[draft()]},read:()=>pending.promise});f.c.SVBudgetPresentation.open('p1');f.receive({deletedIds:['otro']});assert.deepEqual(f.reads,[]);
 const a=f.view.callbacks.onSaved(),b=f.view.callbacks.onSaved();assert.equal(f.reads.length,1);assert.equal(f.last.snapshot.total,326.7);
 pending.resolve({val:()=>record('p1',{tituloSolucion:'Versión guardada actual'})});await Promise.all([a,b]);assert.equal(f.last.snapshot.title,'Versión guardada actual');assert.equal(f.last.details.status,'Versión guardada');assert.equal(f.reads.length,1);
});

test('cerrar o cambiar contexto descarta respuestas guardadas tardías sin reabrir ni repintar',async()=>{
 for(const action of ['close','uid','role','auth','impersonation']){
  const pending=deferred(),f=fixture({initial:{records:[draft()]},read:()=>pending.promise});f.c.SVBudgetPresentation.open('p1');const old=f.view,count=old.renders.length,request=old.callbacks.onSaved();
  if(action==='close')f.c.SVBudgetPresentation.close();
  else{if(action==='uid')f.c.currentUserUid='otro';if(action==='role')f.c.currentRole='vendedor';if(action==='auth')f.c.fbAuth.currentUser={uid:'propio'};if(action==='impersonation')f.c._impersonacionOriginal={user:'Otra cuenta'};f.emit('visibilitychange');}
  pending.resolve({val:()=>record('p1',{tituloSolucion:'Respuesta tardía'})});await request;
  assert.equal(old.closed,1,action);assert.equal(old.renders.length,count,action);assert.equal(f.views.length,1,action);assert.equal(f.subscriptions[0].stopped,1,action);assert.deepEqual(f.messages,[],action);
 }
});

test('un evento de otra identidad cierra, retira su observador e ignora callbacks locales anteriores',()=>{
 const f=fixture({initial:{records:[draft()]}});f.c.SVBudgetPresentation.open('p1');const old=f.view,sub=f.subscriptions[0],count=old.renders.length;
 f.receive({ownerUid:'otro',records:[draft('privado',record('p2'))]});assert.equal(old.closed,1);assert.equal(sub.stopped,1);assert.equal(old.renders.length,count);
 sub.callback({ownerUid:'propio',ready:true,records:[draft()],deletedIds:[]});assert.equal(old.renders.length,count);assert.deepEqual(f.reads,[]);
});

test('sesión finalizada, cambio de rol o navegación cierran una vez y liberan sólo la suscripción del visor',()=>{
 for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed']){
  const f=fixture();f.c.SVBudgetPresentation.open('p1');f.emit(event);f.emit(event);f.c.SVBudgetPresentation.close();assert.equal(f.view.closed,1);assert.equal(f.subscriptions[0].stopped,1);assert.deepEqual(f.reads,[]);
 }
});

test('oculto no repinta; volver muestra el último borrador y el estado sin conexión sin consultar',()=>{
 const f=fixture({initial:{records:[draft()]}});f.c.SVBudgetPresentation.open('p1');const count=f.view.renders.length;
 f.c.document.hidden=true;f.emit('visibilitychange');const changed=draft();changed.data.fields[0].value='20';f.receive({records:[changed]});f.c.navigator.onLine=false;f.emitWindow('sisventas:connection-lost');assert.equal(f.view.renders.length,count);
 f.c.document.hidden=false;f.emit('visibilitychange');assert.equal(f.view.renders.length,count+1);assert.equal(f.last.details.status,'Sin conexión');assert.equal(f.last.snapshot.discountPct,20);
 f.c.navigator.onLine=true;f.c.SVConnectionMonitor={canSync:()=>false};f.emitWindow('sisventas:connection-restored');assert.equal(f.last.details.status,'Sin conexión');
 f.c.SVConnectionMonitor.canSync=()=>true;f.emitWindow('sisventas:connection-restored');assert.equal(f.last.details.status,'En edición');assert.deepEqual(f.reads,[]);assert.deepEqual(f.forbidden,[]);
});

test('el ojo detiene el clic de fila, abre presupuesto y no abre venta ni detalle de lista',()=>{
 const f=fixture(),row=f.rows[0],eye=row.actions.children[0];assert.equal(eye.dataset.budgetView,'p1');assert.equal(eye.attributes['aria-label'],'Visualizar presupuesto');
 const result=f.click(eye.children[0]);let openedDetail=0;if(!result.stopped)openedDetail++;
 assert.equal(result.prevented,1);assert.equal(result.immediate,1);assert.equal(openedDetail,0);assert.equal(f.views.length,1);assert.equal(f.last.snapshot.number,'PP-FICTICIO-p1');assert.deepEqual(f.lookups,['p1']);assert.deepEqual(f.reads,[]);
 f.observers[0].fn();assert.equal(row.actions.children.filter(n=>n.dataset.budgetView==='p1').length,1);
 const ordinary=f.click(row);assert.equal(ordinary.stopped,0);if(!ordinary.stopped)openedDetail++;assert.equal(openedDetail,1);assert.equal(f.views.length,1);
 const key={target:eye,key:'Enter',stopped:0,stopPropagation(){this.stopped++;}};f.emit('keydown',key);assert.equal(key.stopped,1);assert.equal(f.views.length,1);
});

test('sin permiso, sesión propia o rol autorizado por módulo no monta ojos, no busca ni abre ni consulta',()=>{
 for(const change of [c=>{c.permisoModulo=()=>false;},c=>{c.isAuthenticated=false;},c=>{c.currentUserUid='otro';},c=>{c.fbAuth.currentUser=null;},c=>{c._impersonacionOriginal={user:'Vista ajena'};}]){
  const f=fixture({configure:change});f.c.SVBudgetPresentation.open('p1');assert.equal(f.views.length,0);assert.equal(f.subscriptions.length,0);assert.ok(f.rows.every(row=>row.actions.children.length===0));assert.deepEqual(f.lookups,[]);assert.deepEqual(f.reads,[]);assert.deepEqual(f.forbidden,[]);
 }
});

test('fallo de lectura puntual mantiene la vista y permite otro intento explícito sin descargar el listado',async()=>{
 let fail=true;const f=fixture({initial:{records:[draft()]},read:async()=>{if(fail)throw Error('Denegado ficticio');return {val:()=>record()};}});f.c.SVBudgetPresentation.open('p1');await f.view.callbacks.onSaved();
 assert.equal(f.last.details.status,'Edición finalizada');assert.equal(f.last.snapshot.total,326.7);assert.equal(f.messages.length,1);assert.equal(f.view.closed,0);
 fail=false;await f.view.callbacks.onSaved();assert.equal(f.last.details.status,'Versión guardada');assert.deepEqual(f.reads,['sisventas/presupuestos/p1','sisventas/presupuestos/p1']);assert.deepEqual(f.forbidden,[]);
});

test('abrir otro presupuesto cierra el anterior y no comparte ni reutiliza su edición seleccionada',()=>{
 const f=fixture({initial:{records:[draft(),draft('segundo',record('p2'))]}});f.c.SVBudgetPresentation.open('p1');const old=f.view,oldCount=old.renders.length;
 f.c.SVBudgetPresentation.open('p2');assert.equal(old.closed,1);assert.equal(f.subscriptions[0].stopped,1);assert.equal(f.last.snapshot.number,'PP-FICTICIO-p2');assert.equal(f.last.details.selectedDraft,'segundo');
 f.subscriptions[0].callback({ownerUid:'propio',ready:true,records:[draft()],deletedIds:[]});assert.equal(old.renders.length,oldCount);assert.equal(f.last.snapshot.number,'PP-FICTICIO-p2');assert.deepEqual(f.reads,[]);
});

test('usa las variables léxicas reales de la aplicación aunque no existan como propiedades window',()=>{
 const f=fixture({lexical:true,initial:{records:[draft()]}});
 for(const key of ['isAuthenticated','currentUserUid','currentRole'])assert.equal(Object.hasOwn(f.c,key),false);
 f.c.SVBudgetPresentation.open('p1');assert.equal(f.views.length,1);assert.equal(f.last.details.status,'En edición');assert.equal(f.last.snapshot.total,326.7);assert.deepEqual(f.reads,[]);
 vm.runInContext("currentRole='vendedor';",f.c);f.emit('visibilitychange');assert.equal(f.view.closed,1);assert.equal(f.subscriptions[0].stopped,1);
});

test('cerrar sesión léxica impide abrir el visualizador sin consultar ni buscar',()=>{
 const f=fixture({lexical:true});vm.runInContext('isAuthenticated=false;',f.c);f.c.SVBudgetPresentation.open('p1');assert.equal(f.views.length,0);assert.deepEqual(f.lookups,[]);assert.deepEqual(f.reads,[]);
});

test('elegir otra edición mientras espera guardado invalida su respuesta tardía, también si falla',async()=>{
 for(const fails of [false,true]){
  const pending=deferred(),f=fixture({initial:{records:[draft('a'),draft('b')]},read:()=>pending.promise});f.c.SVBudgetPresentation.open('p1');f.view.callbacks.onChooseDraft('a');
  const reading=f.view.callbacks.onSaved();f.view.callbacks.onChooseDraft('b');const count=f.view.renders.length;
  if(fails)pending.reject(Error('Fallo tardío ficticio'));else pending.resolve({val:()=>record('p1')});await reading;
  assert.equal(f.last.details.selectedDraft,'b');assert.equal(f.last.details.status,'En edición');assert.equal(f.last.snapshot.total,326.7);assert.equal(f.view.renders.length,count);assert.deepEqual(f.messages,[]);assert.equal(f.reads.length,1);
 }
});

test('un guardado fresco retira ediciones de un original anterior y no deja elegirlas después',async()=>{
 const f=fixture({initial:{records:[draft('a'),draft('b')]},read:async()=>({val:()=>record('p1',{cliente:'Cliente actualizado'})})});f.c.SVBudgetPresentation.open('p1');await f.view.callbacks.onSaved();
 assert.equal(f.last.snapshot.client,'Cliente actualizado');assert.deepEqual(f.last.details.alternatives,[]);const count=f.view.renders.length;
 f.view.callbacks.onChooseDraft('b');assert.equal(f.view.renders.length,count);assert.equal(f.last.details.selectedDraft,'');assert.equal(f.last.details.status,'Versión guardada');
});

test('una edición recibida durante el GET se reconsidera contra el original recién leído sin consultas adicionales',async()=>{
 const saved=record('p1',{cliente:'Cliente actualizado'}),pending=deferred(),f=fixture({initial:{records:[draft('old')]},read:()=>pending.promise});f.c.SVBudgetPresentation.open('p1');
 const reading=f.view.callbacks.onSaved(),fresh=draft('fresh',saved);f.receive({records:[fresh]});assert.equal(f.last.details.selectedDraft,'');
 pending.resolve({val:()=>saved});await reading;assert.deepEqual(f.last.details.alternatives.map(d=>d.id),['fresh']);assert.equal(f.last.details.selectedDraft,'');
 f.view.callbacks.onChooseDraft('fresh');assert.equal(f.last.details.selectedDraft,'fresh');assert.equal(f.last.details.status,'En edición');assert.equal(f.reads.length,1);
});
