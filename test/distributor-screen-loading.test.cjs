'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const snapshot=value=>({val:()=>value});
const flush=async()=>{for(let count=0;count<10;count++)await Promise.resolve();};
function fixture(file){
 const portal={id:'screen-paraguay'},loads=[],listeners=new Map(),events=[];
 class Host{
  constructor(){this.nodes=new Map();this.markup='';this.isConnected=true;}
  closest(selector){assert.equal(selector,'#screen-paraguay');return portal;}
  set innerHTML(value){this.markup=value;this.nodes.clear();for(const match of value.matchAll(/\bdata-([a-z-]+)(?:="[^"]*")?/g)){
   const key=match[1];if(!this.nodes.has(key))this.nodes.set(key,{value:key==='order'?'profit':key==='state'?'all':'',textContent:'',innerHTML:'',hidden:false,selectedOptions:[{textContent:'Todos'}],listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}});
  }}
  get innerHTML(){return this.markup;}
  querySelector(selector){const key=selector.match(/^\[data-([a-z-]+)\]$/)?.[1];return this.nodes.get(key)||null;}
  querySelectorAll(){return [];}
 }
 const root={currentUserUid:'fixture-admin',currentRole:'admin',currentUser:'Admin ficticio',
  addEventListener:(name,fn)=>events.push({name,fn}),removeEventListener(){},
  SVScreenLoading:{start(host,title,options){assert.equal(options.container,portal);const row={host,title,container:options.container,closed:false,closes:0};loads.push(row);return()=>{row.closes++;row.closed=true;};}},
  obtenerDolarReferenciaProducto:()=>({valor:1000}),SVParaguayPortal:{listSavings:()=>({usd:10,included:1,omitted:0})},
  fbDB:{},fbRef:(_,path)=>path,fbOnValue:(ref,fn)=>{assert.equal(ref,'sisventas/config/tipoCambio');const row={fn,active:true};events.push(row);return()=>{row.active=false;};}};
 const document={querySelector:selector=>selector==='#screen-paraguay [data-display-currency]'?{value:'USD'}:null,
  addEventListener:(name,fn)=>listeners.set(fn,name),removeEventListener:(name,fn)=>{assert.equal(listeners.get(fn),name);listeners.delete(fn);}};
 const context={window:root,document,Promise,console,Map,Set};vm.createContext(context);vm.runInContext(fs.readFileSync(file,'utf8'),context);
 return {root,Host,portal,loads,events,listeners,active:()=>loads.filter(row=>!row.closed)};
}
function documentsFixture(){
 const f=fixture('js/modules/distributor-documents.js'),requests=[];
 const api=f.root.SVDistributorDocumentsFactory.createUI(path=>{const task=deferred();requests.push({path,...task});return task.promise;});
 return {...f,api,requests,finish(at=0){requests[at].resolve({products:[],company:{}});requests[at+1].resolve({documents:[]});}};
}
function balanceFixture({throwDirectory=false}={}){
 const f=fixture('js/modules/distribuidora-sales-balance.js'),directories=[],reads=[];
 f.root.SVUserDirectory={read(){if(throwDirectory)throw Error('Fallo ficticio');const task=deferred();directories.push(task);return task.promise;}};
 f.root.fbGet=path=>{assert.equal(path,'sv_listas_paraguay/fixture-admin');const task=deferred();reads.push({path,...task});return task.promise;};
 return {...f,api:f.root.SVSalesBalance,directories,reads};
}

test('Comprobantes mantiene un aviso centrado hasta recibir las dos respuestas, sin texto de carga repetido',async()=>{
 const f=documentsFixture(),host=new f.Host(),task=f.api.mount(host);
 assert.deepEqual(f.requests.map(row=>row.path),['/opciones','']);assert.equal(f.active().length,1);assert.equal(f.loads[0].title,'Cargando comprobantes…');
 assert.ok(!host.innerHTML.includes('Cargando comprobantes'));assert.equal(f.loads[0].container,f.portal);
 f.requests[0].resolve({products:[],company:{}});await flush();assert.equal(f.active().length,1);
 f.requests[1].resolve({documents:[]});await task;assert.equal(f.active().length,0);assert.equal(f.loads[0].closes,1);
 assert.match(host.querySelector('[data-documents]').innerHTML,/Todavía no emitiste/);assert.equal(f.requests.length,2);
});

test('Comprobantes cierra al fallar, conserva error y permite reintentar una sola carga',async()=>{
 const f=documentsFixture(),host=new f.Host(),first=f.api.mount(host);f.requests[0].reject(Error('Fallo ficticio de comprobantes'));await first;
 assert.equal(f.active().length,0);assert.match(host.innerHTML,/Fallo ficticio de comprobantes/);
 const retry=host.querySelector('[data-retry]'),second=retry.listeners.click();assert.equal(f.active().length,1);assert.equal(f.requests.length,4);
 f.finish(2);await second;assert.equal(f.active().length,0);assert.equal(f.loads[1].closes,1);
 f.requests[1].resolve({documents:[]});await flush();assert.equal(f.requests.length,4);
});

test('Comprobantes reset y respuesta anterior no borran el aviso ni la vista del montaje nuevo',async()=>{
 for(const failure of [false,true]){
  const f=documentsFixture(),oldHost=new f.Host(),first=f.api.mount(oldHost);f.api.reset();assert.equal(f.active().length,0);
  const newHost=new f.Host(),second=f.api.mount(newHost),pendingMarkup=newHost.innerHTML;
  if(failure)f.requests[0].reject(Error('Error anterior'));else f.finish();await first;
  assert.equal(newHost.innerHTML,pendingMarkup);assert.equal(f.active().length,1);assert.equal(f.loads[0].closes,1);assert.equal(f.loads[1].closes,0);
  f.finish(2);await second;assert.equal(f.active().length,0);assert.equal(f.loads[1].closes,1);
  if(failure)f.requests[1].resolve({documents:[]});
 }
});

test('Comprobantes descarta fallo de otro UID y un Reintentar retirado no vuelve a consultar',async()=>{
 const f=documentsFixture(),host=new f.Host(),first=f.api.mount(host);f.root.currentUserUid='otra-cuenta';f.requests[0].reject(Error('Error de cuenta anterior'));await first;
 assert.ok(!host.innerHTML.includes('Error de cuenta anterior'));assert.equal(f.active().length,0);
 f.root.currentUserUid='fixture-admin';const second=f.api.mount(host);f.requests[2].reject(Error('Fallo nuevo'));await second;
 const retry=host.querySelector('[data-retry]').listeners.click;f.api.reset();await retry();assert.equal(f.requests.length,4);assert.equal(f.active().length,0);
});

test('Balance conserva carga centrada durante directorio y listas, después presenta datos sin nuevas consultas',async()=>{
 const f=balanceFixture(),host=new f.Host();f.api.mount(host,()=>{});
 assert.equal(f.active().length,1);assert.equal(f.loads[0].title,'Cargando listas…');assert.equal(host.querySelector('[data-error]').textContent,'');
 assert.equal(f.directories.length,1);assert.equal(f.reads.length,0);f.directories[0].resolve(snapshot({}));await flush();
 assert.equal(f.reads.length,1);assert.equal(f.active().length,1);f.reads[0].resolve(snapshot({one:{nombre:'Lista ficticia',actualizadoEn:100}}));await flush();
 assert.equal(f.active().length,0);assert.equal(f.loads[0].closes,1);assert.equal(host.querySelector('[data-total]').textContent,'1 listas');
 assert.match(host.querySelector('[data-rows]').innerHTML,/Lista ficticia/);assert.equal(f.reads.length,1);assert.equal(f.listeners.size,1);
 host.querySelector('[data-search]').oninput();assert.equal(f.reads.length,1);assert.equal(f.loads.length,1);
});

test('Balance cierra el aviso ante error del directorio o listas y mantiene mensaje de recuperación',async()=>{
 for(const phase of ['directory','lists']){
  const f=balanceFixture(),host=new f.Host();f.api.mount(host,()=>{});
  if(phase==='directory')f.directories[0].reject(Error('Fallo ficticio'));else{f.directories[0].resolve(snapshot({}));await flush();f.reads[0].reject(Error('Fallo ficticio'));}
  await flush();assert.equal(f.active().length,0);assert.equal(f.loads[0].closes,1);assert.match(host.querySelector('[data-error]').textContent,/No se pudieron cargar las listas/);
 }
 const f=balanceFixture({throwDirectory:true}),host=new f.Host();f.api.mount(host,()=>{});assert.equal(f.active().length,0);assert.match(host.querySelector('[data-error]').textContent,/No se pudieron cargar las listas/);
});

test('Balance salir/reset cancela su aviso y callbacks antiguos no afectan la carga actual',async()=>{
 const f=balanceFixture(),oldHost=new f.Host();f.api.mount(oldHost,()=>{});f.directories[0].resolve(snapshot({}));await flush();
 f.api.reset();assert.equal(f.active().length,0);assert.equal(f.listeners.size,0);assert.equal(f.events.find(row=>'active'in row).active,false);
 const newHost=new f.Host();f.api.mount(newHost,()=>{});f.reads[0].resolve(snapshot({old:{nombre:'Dato anterior'}}));await flush();
 assert.equal(f.active().length,1);assert.equal(f.loads[1].closes,0);assert.equal(newHost.querySelector('[data-rows]').innerHTML,'');
 f.directories[1].resolve(snapshot({}));await flush();f.reads[1].resolve(snapshot({}));await flush();
 assert.equal(f.active().length,0);assert.equal(f.loads[0].closes,1);assert.equal(f.loads[1].closes,1);assert.equal(newHost.querySelector('[data-error]').textContent,'No hay listas registradas.');
});

test('Balance fallo tardío y cambio de UID no cambian la vista nueva ni reabren el aviso',async()=>{
 const f=balanceFixture(),oldHost=new f.Host();f.api.mount(oldHost,()=>{});const newHost=new f.Host();f.api.mount(newHost,()=>{});
 f.directories[0].reject(Error('Error anterior'));await flush();assert.equal(f.active().length,1);assert.equal(newHost.querySelector('[data-error]').textContent,'');
 f.root.currentUserUid='otra-cuenta';f.directories[1].reject(Error('Error de otra sesión'));await flush();
 assert.equal(f.active().length,0);assert.equal(newHost.querySelector('[data-error]').textContent,'');assert.equal(f.directories.length,2);assert.equal(f.reads.length,0);
});
