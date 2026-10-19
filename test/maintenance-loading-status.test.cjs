'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/session-assets.js','utf8');
function fixture(options={}){
 const scripts=[],timers=new Map(),events=new EventTarget(),observers=[];let timerId=0,mounts=0;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.id='';this.className='';this.style={};this.children=[];this.parentNode=null;this.attributes={};this._text='';}
  get classList(){return{contains:name=>this.className.split(/\s+/).includes(name)};}
  get isConnected(){for(let node=this;node;node=node.parentNode)if(node===body||node===head)return true;return false;}
  appendChild(node){node.remove();node.parentNode=this;this.children.push(node);if(this===head&&node.tagName==='SCRIPT')scripts.push(node);return node;}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name];}
  set textContent(value){this.children.forEach(child=>child.parentNode=null);this.children=[];this._text=String(value);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 }
 const body=new Node('body'),head=new Node('head'),page=new Node('section'),panel=new Node('section');page.id='page-configuracion';page.className='page active';panel.id='cfg-mantenimiento';panel.style.display='block';body.appendChild(page);page.appendChild(panel);
 const visit=(node,find)=>{if(find(node))return node;for(const child of node.children){const found=visit(child,find);if(found)return found;}return null;};
 const document={body,head,createElement:tag=>new Node(tag),getElementById:id=>visit(body,node=>node.id===id)||visit(head,node=>node.id===id),addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args)};
 class Observer{constructor(callback){this.callback=callback;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
 const window={currentUserUid:'fixture-admin',currentRole:'admin',fbAuth:{currentUser:{uid:'fixture-admin'}},MutationObserver:Observer};
 if(!options.legacyCore)window.SVScreenLoading={start(){}};
 const c={window,document,isAuthenticated:true,setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),Promise,Error,console:{warn(){}}};vm.createContext(c);vm.runInContext(source,c);
 const dispatch=(name,detail)=>{const event=new Event(name);event.detail=detail;events.dispatchEvent(event);};
 const complete=()=>{window.SisVentas={V3Diagnostics:{mount(){mounts++;}}};scripts.at(-1).onload();};
 const fail=()=>scripts.at(-1).onerror();
 const status=()=>document.getElementById('mnt-diagnostics-loading'),layer=()=>document.getElementById('mnt-diagnostics-loading-layer');
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 return{window,c,document,body,page,panel,scripts,timers,observers,Node,dispatch,complete,fail,status,layer,flush,mutate:()=>observers.filter(observer=>observer.active).forEach(observer=>observer.callback()),mounts:()=>mounts,run:window.SVSessionAssets.maintenance};
}
test('Mantenimiento presenta una sola tarjeta de carga dentro de una capa directa del body',async()=>{
 const f=fixture(),task=f.run();assert.equal(f.scripts.length,1);assert.equal(f.layer()?.parentNode,f.body);assert.equal(f.layer().className,'sv-load-status-layer');assert.equal(f.status().parentNode,f.layer());assert.equal(f.status().className,'sv-data-status');
 assert.equal(f.status().getAttribute('role'),'status');assert.equal(f.status().children[0].tagName,'STRONG');assert.match(f.status().textContent,/Cargando auditoría/);assert.ok(!f.panel.children.includes(f.status()));
 f.complete();await task;assert.equal(f.status(),null);assert.equal(f.layer(),null);assert.equal(f.mounts(),1);
});
test('reentradas del mismo panel comparten petición y descarga sin duplicar mount',async()=>{
 const f=fixture(),first=f.run(),second=f.run();assert.equal(first,second);assert.equal(f.scripts.length,1);f.complete();await Promise.all([first,second]);assert.equal(f.mounts(),1);assert.equal(f.layer(),null);
});
test('navegar limpia de inmediato y una respuesta antigua no monta ni muestra un error',async()=>{
 for(const outcome of ['complete','fail']){const f=fixture(),task=f.run();f.page.className='page';f.dispatch('sisventas:page-changed',{page:'dashboard'});assert.equal(f.layer(),null);f[outcome]();await task;assert.equal(f.mounts(),0);assert.equal(f.layer(),null);}
});
test('cambiar de solapa invalida el aviso; volver comparte descarga y sólo monta la petición nueva',async()=>{
 const f=fixture(),first=f.run();f.panel.style.display='none';f.dispatch('sisventas:configuration-tab-changed',{tab:'roles'});assert.equal(f.layer(),null);
 f.panel.style.display='block';f.dispatch('sisventas:configuration-tab-changed',{tab:'mantenimiento'});const second=f.run();assert.equal(f.scripts.length,1);const status=f.status();f.complete();await first;await second;assert.equal(f.mounts(),1);assert.equal(status.isConnected,false);assert.equal(f.layer(),null);
});
test('logout y login del mismo UID descartan la petición antigua sin reiniciar el estado nuevo',async()=>{
 const f=fixture(),first=f.run();f.dispatch('sisventas:session-ended');assert.equal(f.layer(),null);f.dispatch('sisventas:session-ready');const second=f.run();assert.equal(f.scripts.length,1);f.complete();await Promise.all([first,second]);assert.equal(f.mounts(),1);assert.equal(f.layer(),null);
});
test('reemplazar el panel invalida la continuación anterior aunque conserve el mismo id',async()=>{
 const f=fixture(),first=f.run();f.panel.remove();const replacement=new f.Node('section');replacement.id='cfg-mantenimiento';replacement.style.display='block';f.page.appendChild(replacement);const second=f.run();f.complete();await Promise.all([first,second]);assert.equal(f.mounts(),1);assert.equal(f.layer(),null);
});
test('UID, rol, Auth, autenticación o Ver como distintos impiden mount y error fuera del contexto capturado',async()=>{
 for(const mutate of [f=>f.window.currentUserUid='other',f=>f.window.currentRole='tecnico',f=>f.window.fbAuth.currentUser={uid:'fixture-admin'},f=>f.c.isAuthenticated=false,f=>f.window._impersonacionOriginal={uid:'fixture-admin'}]){
  for(const outcome of ['complete','fail']){const f=fixture(),task=f.run();mutate(f);f[outcome]();await task;assert.equal(f.mounts(),0);assert.equal(f.layer(),null);}
 }
});
test('el fallo conserva error y Reintentar accesible, usa estilo sin spinner y permite recuperar la descarga',async()=>{
 const f=fixture(),first=f.run();f.fail();await first;assert.equal(f.status().getAttribute('role'),'alert');assert.equal(f.status().className,'sv-data-status sv-data-error');assert.equal(f.status().children[0].tagName,'STRONG');assert.match(f.status().textContent,/descargar/);
 const retry=f.status().children.at(-1);assert.equal(retry.tagName,'BUTTON');assert.equal(retry.type,'button');assert.equal(retry.textContent,'Reintentar');const second=retry.onclick();assert.equal(f.scripts.length,2);assert.equal(f.status().className,'sv-data-status');f.complete();await second;assert.equal(f.mounts(),1);assert.equal(f.layer(),null);
});
test('un botón Reintentar ya retirado no descarga ni recrea una capa después de navegar',async()=>{
 const f=fixture(),first=f.run();f.fail();await first;const retry=f.status().children.at(-1);f.page.className='page';f.dispatch('sisventas:page-changed',{page:'ventas'});const stale=retry.onclick();assert.equal(f.scripts.length,1);await stale;assert.equal(f.layer(),null);
});
test('una solapa oculta, página inactiva o sesión cerrada no inicia cargas de mantenimiento',async()=>{
 for(const mutate of [f=>f.panel.style.display='none',f=>f.page.className='page',f=>f.c.isAuthenticated=false]){const f=fixture();mutate(f);const pending=f.run();assert.equal(f.scripts.length,0);await pending;assert.equal(f.layer(),null);}
});

test('app anterior sin evento de solapa retira el error al ocultar el panel y el botón viejo no reinicia',async()=>{
 const f=fixture(),task=f.run();f.fail();await task;const retry=f.status().children.at(-1);
 assert.equal(f.observers.filter(observer=>observer.active).length,1);f.panel.style.display='none';f.mutate();
 assert.equal(f.status(),null);assert.equal(f.layer(),null);assert.equal(f.observers.filter(observer=>observer.active).length,0);
 await retry.onclick();assert.equal(f.scripts.length,1);f.panel.style.display='block';const next=f.run();assert.equal(f.scripts.length,2);f.complete();await next;
 assert.equal(f.mounts(),1);assert.equal(f.observers.filter(observer=>observer.active).length,0);assert.equal(f.timers.size,0);
});

test('sin eventos la espera se limpia al ocultar o retirar al dueño y no monta al responder tarde',async()=>{
 for(const remove of [f=>f.panel.hidden=true,f=>f.panel.remove(),f=>f.page.className='page',f=>f.layer().remove()]){
  const f=fixture(),task=f.run();remove(f);f.mutate();assert.equal(f.status(),null);assert.equal(f.layer(),null);assert.equal(f.observers.filter(observer=>observer.active).length,0);
  f.complete();await task;assert.equal(f.mounts(),0);assert.equal(f.timers.size,0);
 }
});

test('core anterior sin estilo de portal mantiene aviso y reintento dentro del panel, sin otra hoja ni consulta',async()=>{
 const f=fixture({legacyCore:true}),task=f.run();assert.equal(f.layer(),null);assert.equal(f.status().parentNode,f.panel);assert.match(f.status().textContent,/Cargando auditoría/);
 f.fail();await task;assert.equal(f.status().parentNode,f.panel);assert.equal(f.status().getAttribute('role'),'alert');assert.equal(f.status().children.at(-1).textContent,'Reintentar');
 assert.equal(f.scripts.length,1);assert.equal(f.document.head.children.length,0,'El fallo retiró el script; no se insertó una hoja adicional');
 f.panel.style.display='none';f.mutate();assert.equal(f.status(),null);assert.equal(f.observers.filter(observer=>observer.active).length,0);assert.equal(f.timers.size,0);
});
