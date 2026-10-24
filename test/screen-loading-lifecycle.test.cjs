'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(pageId='page-proyectos',withHelper=true){
 const events=new Map(),observers=[],requests=[],subscriptions=[],frames=[];
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.className='';this.style={};this.dataset={};this.attrs={};this.hidden=false;this.markup='';this.textContent='';this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:name=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');},toggle:(name,on)=>on?this.classList.add(name):this.classList.remove(name)};}
  get isConnected(){return this===body||!!this.parentNode?.isConnected;}
  get parentElement(){return this.parentNode;}
  appendChild(node){node.remove();node.parentNode=this;this.children.push(node);return node;}
  append(...nodes){nodes.forEach(node=>this.appendChild(node));}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}
  setAttribute(name,value){this.attrs[name]=value;}
  getAttribute(name){return this.attrs[name];}
  set innerHTML(value){this.children.forEach(node=>{node.parentNode=null;});this.children=[];this.markup=value;}
  get innerHTML(){return this.markup;}
  querySelector(){return null;}
  querySelectorAll(){return [];}
 }
 const body=new Element('body'),page=new Element();page.id=pageId;page.className='page active';body.appendChild(page);
 const nodes=()=>{const all=[];function collect(node){all.push(node);node.children.forEach(collect);}collect(body);return all;};
 const document={body,activeElement:page,createElement:tag=>new Element(tag),getElementById:id=>nodes().find(node=>node.id===id)||null,querySelectorAll:()=>[],
  addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},dispatchEvent(event){(events.get(event.type)||[]).forEach(fn=>fn(event));}};
 const emit=(type,detail={})=>document.dispatchEvent({type,detail});
 class MutationObserver{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
 const root={document,URL,URLSearchParams,AbortSignal,Promise,console,MutationObserver,location:{hostname:'fixture.invalid',href:'https://fixture.invalid/',search:''},navigator:{onLine:true},
  currentUserUid:'fixture-user',currentUserEmail:'fixture@example.invalid',currentUser:'Usuario ficticio',currentRole:'admin',permisoModulo:()=>true,
  fbAuth:{currentUser:{uid:'fixture-user',getIdToken:async()=> 'fictional-token'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid/functions'},
  addEventListener(){},requestAnimationFrame:fn=>frames.push(fn),CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  fetch:(url,options)=>{const task=deferred();requests.push({url,options,...task});return task.promise;},
  fbDB:{},fbRef:(_,path)=>path,fbOnValue:(path,callback,error)=>{const row={path,callback,error,active:true};subscriptions.push(row);return()=>{row.active=false;};},
  fbSet(){throw Error('La presentación no debe escribir datos');},fbGet(){throw Error('La presentación no debe agregar lecturas');},indexedDB:{open(){throw Error('El listado no debe abrir borradores');}}};
 root.window=root;vm.createContext(root);if(withHelper)vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),root);
 const run=file=>vm.runInContext(fs.readFileSync(file,'utf8'),root);
 const layers=()=>nodes().filter(node=>node.classList.contains('sv-load-status-layer'));
 const mutate=()=>observers.filter(o=>o.active).forEach(o=>o.fn());
 const finish=(index=0,value={projects:[],canCreate:false})=>requests[index].resolve({ok:true,json:async()=>value});
 return {root,document,body,page,Element,events,emit,run,layers,requests,subscriptions,observers,mutate,finish};
}

test('el aviso va al body, conserva contenido y foco y se retira sin nodos ni lecturas',()=>{
 const f=fixture();f.page.innerHTML='Contenido conservado';f.body.style.overflow='auto';
 const close=f.root.SVScreenLoading.start(f.page,'Cargando proyectos…'),layer=f.layers()[0],card=layer.children[0];
 assert.equal(layer.parentNode,f.body);assert.equal(card.className,'sv-data-status');assert.equal(card.attrs.role,'status');assert.equal(card.children[0].tagName,'STRONG');assert.equal(card.children[0].textContent,'Cargando proyectos…');
 assert.equal(f.page.innerHTML,'Contenido conservado');assert.equal(f.document.activeElement,f.page);assert.equal(f.body.style.overflow,'auto');assert.equal(f.requests.length+f.subscriptions.length,0);
 close();close();assert.equal(f.layers().length,0);assert.equal(f.observers.filter(o=>o.active).length,0);
});
test('un portal explícito contiene el aviso y el cierre anterior no elimina su sucesor ni otro dueño',()=>{
 const f=fixture(),portal=new f.Element(),other=new f.Element();f.body.appendChild(portal);portal.appendChild(f.page);f.body.appendChild(other);
 const first=f.root.SVScreenLoading.start(f.page,'Primero',{container:portal});assert.equal(f.layers()[0].parentNode,portal);
 const current=f.root.SVScreenLoading.start(f.page,'Actual',{container:portal}),independent=f.root.SVScreenLoading.start(other,'Otro');
 first();assert.equal(f.layers().length,2);current();assert.equal(f.layers().length,1);independent();assert.equal(f.layers().length,0);
});
test('navegación, rol, sesión nueva/final y reset retiran todas las capas',()=>{
 const f=fixture();for(const event of ['sisventas:page-changed','sisventas:role-changed','sisventas:session-ready','sisventas:session-ended','reset']){
  const close=f.root.SVScreenLoading.start(f.page,'Esperando');assert.equal(f.layers().length,1);
  if(event==='reset')f.root.SVDataReadiness.reset();else f.emit(event,{page:'dashboard'});
  close();assert.equal(f.layers().length,0);assert.equal(f.observers.filter(o=>o.active).length,0);
 }
 assert.equal(f.requests.length+f.subscriptions.length,0);
});
test('un dueño retirado, oculto o página inactiva se limpia por observación sin reloj',()=>{
 for(const mode of ['detach','hidden','inactive','container']){
  const f=fixture(),portal=new f.Element();f.body.appendChild(portal);portal.appendChild(f.page);
  f.root.SVScreenLoading.start(f.page,'Esperando',{container:portal});
  if(mode==='detach')f.page.remove();else if(mode==='hidden')f.page.hidden=true;else if(mode==='inactive')f.page.classList.remove('active');else portal.remove();
  f.mutate();assert.equal(f.layers().length,0,mode);assert.equal(f.observers.filter(o=>o.active).length,0,mode);
 }
});
test('no se monta una capa sobre un dueño ausente, oculto o inactivo',()=>{
 const f=fixture();f.root.SVScreenLoading.start(null,'Ausente')();f.page.hidden=true;f.root.SVScreenLoading.start(f.page,'Oculto')();f.page.hidden=false;f.page.classList.remove('active');f.root.SVScreenLoading.start(f.page,'Inactivo')();
 assert.equal(f.layers().length,0);assert.equal(f.observers.length,0);
});
function projects(withHelper=true){const f=fixture('page-proyectos',withHelper);f.root.SVProjectsModel=require('../js/core/projects-model');f.run('js/modules/projects.js');return f;}
test('Proyectos deduplica su carga, cierra al responder y no agrega lecturas ni escrituras',async()=>{
 const f=projects(),pending=f.root.SVProjects.open();await flush();await f.root.SVProjects.open();assert.equal(f.layers().length,1);assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.method,'GET');assert.equal(f.requests[0].options.cache,'no-store');
 f.finish();await pending;assert.equal(f.layers().length,0);assert.match(f.page.innerHTML,/Planificá el próximo trabajo/);assert.ok(!f.page.innerHTML.includes('Cargando proyectos'));assert.equal(f.requests.length,1);
});
test('Proyectos conserva error y Reintentar y su índice antiguo muestra carga visible',async()=>{
 for(const helper of [true,false]){const f=projects(helper),pending=f.root.SVProjects.open();await flush();if(!helper)assert.match(f.page.innerHTML,/role="status">Cargando proyectos/);
  f.requests[0].reject(Error('Fallo ficticio'));await pending;assert.equal(f.layers().length,0);assert.match(f.page.innerHTML,/Fallo ficticio/);assert.match(f.page.innerHTML,/Reintentar/);assert.equal(f.requests.length,1);
 }
});
test('Proyectos descarta respuesta anterior tras salir y no cierra la capa de reentrada',async()=>{
 const f=projects(),old=f.root.SVProjects.open();await flush();f.emit('sisventas:page-changed',{page:'dashboard'});assert.equal(f.layers().length,0);
 const current=f.root.SVProjects.open();await flush();const markup=f.page.innerHTML;f.finish(0);await old;assert.equal(f.layers().length,1);assert.equal(f.page.innerHTML,markup);
 f.finish(1);await current;assert.equal(f.layers().length,0);assert.equal(f.requests.length,2);
});
test('Proyectos no presenta respuestas de otro UID, rol, sesión o dueño retirado',async()=>{
 for(const mode of ['uid','role','session','detached']){const f=projects(),pending=f.root.SVProjects.open();await flush();
  if(mode==='uid')f.root.currentUserUid='otra-cuenta';else if(mode==='role')f.root.currentRole='vendedor';else if(mode==='session')f.emit('sisventas:session-ended');else f.page.remove();
  f.finish();await pending;assert.equal(f.layers().length,0);assert.ok(!f.page.innerHTML.includes('Planificá el próximo trabajo'),mode);assert.equal(f.requests.length,1);
 }
});
function surveys(withHelper=true){
 const f=fixture('page-relevamientos',withHelper);f.root.isAuthenticated=true;f.root.PERMISOS_ROLES={admin:{indiceRevision:1}};f.root._svOperacionesSesionEpoch=1;f.run('js/modules/surveys.js');
 // El evento usa target directamente, sin abrir el borrador local ni su almacenamiento.
 f.list=()=>{const button={closest:selector=>selector==='button'?button:f.page,hasAttribute:name=>name==='data-list'};(f.events.get('click')||[]).forEach(fn=>fn({target:button}));};return f;
}
test('Relevamientos espera el primer snapshot y distingue vacío confirmado sin consultas extra',()=>{
 const f=surveys();f.list();assert.equal(f.layers().length,1);assert.equal(f.subscriptions.length,1);assert.equal(f.subscriptions[0].path,'sisventas/relevamientos');
 f.subscriptions[0].callback({val:()=>null});assert.equal(f.layers().length,0);assert.match(f.page.innerHTML,/Todavía no hay relevamientos guardados/);assert.equal(f.subscriptions.length,1);assert.equal(f.requests.length,0);
});
test('Relevamientos cierra ante error y conserva Reintentar; sin helper muestra carga',()=>{
 for(const helper of [true,false]){const f=surveys(helper);f.list();if(!helper)assert.match(f.page.innerHTML,/role="status">Cargando relevamientos/);
  f.subscriptions[0].error(Error('Fallo ficticio'));assert.equal(f.layers().length,0);assert.match(f.page.innerHTML,/No se pudo sincronizar/);assert.match(f.page.innerHTML,/Reintentar/);assert.equal(f.subscriptions.length,1);
 }
});
test('Relevamientos se desuscribe al salir y callbacks viejos no afectan el listado nuevo',()=>{
 const f=surveys();f.list();const old=f.subscriptions[0];f.emit('sisventas:page-changed',{page:'dashboard'});assert.equal(old.active,false);assert.equal(f.layers().length,0);
 f.list();const markup=f.page.innerHTML;old.callback({val:()=>null});old.error(Error('Antiguo'));assert.equal(f.page.innerHTML,markup);assert.equal(f.layers().length,1);
 f.subscriptions[1].callback({val:()=>({})});assert.equal(f.layers().length,0);assert.equal(f.subscriptions.length,2);
});
test('Relevamientos detiene el listado por rol/sesión y descarta otro dueño o permiso',()=>{
 for(const mode of ['role-event','session','uid','permission','detached']){const f=surveys();f.list();const pending=f.page.innerHTML;
  if(mode==='role-event')f.emit('sisventas:role-changed');else if(mode==='session')f.emit('sisventas:session-ended');else if(mode==='uid')f.root.currentUserUid='otro';else if(mode==='permission')f.root.permisoModulo=()=>false;else f.page.remove();
  f.subscriptions[0].callback({val:()=>assert.fail('No decodificar una lectura retirada')});assert.equal(f.layers().length,0);
  if(mode==='session')assert.equal(f.page.innerHTML,'');else if(mode==='detached')assert.equal(f.page.innerHTML,pending);else assert.match(f.page.innerHTML,/lectura del listado está pausada/);
  assert.equal(f.subscriptions[0].active,false,mode);
 }
});
test('Relevamientos cierra un fallo síncrono y reentrar sólo conserva una suscripción activa',()=>{
 const f=surveys();f.list();f.list();assert.equal(f.subscriptions.filter(row=>row.active).length,1);assert.equal(f.layers().length,1);f.emit('sisventas:session-ended');assert.equal(f.layers().length,0);
 f.root.fbOnValue=()=>{throw Error('Fallo síncrono');};f.list();assert.equal(f.layers().length,0);assert.match(f.page.innerHTML,/No se pudo sincronizar/);
});
