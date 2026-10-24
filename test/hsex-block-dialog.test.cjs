'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {functionSource}=require('./helpers/app-functions.cjs');

// The real opener, close handlers and modal-stack controller run over a small
// DOM. No SDK, credentials, clock jobs or requests are used by this fixture.
function fixture() {
  let context;
  const frames=[],observers=new Set(),documentEvents=new Map(),windowEvents=new Map();
  const calls={network:0,writes:0,navigation:[],render:[],calendar:0,focus:[]};
  const events=(target,registry)=>Object.assign(target,{
    addEventListener(name,fn){if(!registry.has(name))registry.set(name,new Set());registry.get(name).add(fn);},
    removeEventListener(name,fn){registry.get(name)?.delete(fn);},
    emit(name,event={}){for(const fn of [...(registry.get(name)||[])])fn(event);}
  });
  const doc=events({hidden:false,visibilityState:'visible',activeElement:null},documentEvents);
  class Element {
    constructor(tag='DIV'){this.tagName=tag;this.children=[];this.parentNode=null;this.isConnected=false;this.style={};this.dataset={};this.attributes={};this.className='';this.id='';this.hidden=false;this.disabled=false;this._events=new Map();events(this,this._events);}
    get classList(){const self=this;return {contains(name){return self.className.split(/\s+/).includes(name);},add(name){if(!this.contains(name))self.className+=' '+name;},remove(name){self.className=self.className.split(/\s+/).filter(x=>x!==name).join(' ');},toggle(name,on){on?this.add(name):this.remove(name);}};}
    setAttribute(name,value){this.attributes[name]=String(value);if(name==='id')this.id=value;}
    getAttribute(name){return this.attributes[name]??null;}
    set innerHTML(html){this.html=html;this.children=[];for(const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){const button=new Element('BUTTON');for(const attr of match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g))button.setAttribute(attr[1],attr[2]??'');button.textContent=match[2].replace(/<[^>]*>/g,'').trim();this.appendChild(button);}}
    get innerHTML(){return this.html||'';}
    appendChild(node){node.parentNode=this;this.children.push(node);node.connect(this.isConnected);return node;}
    connect(value){this.isConnected=value;this.children.forEach(child=>child.connect(value));}
    remove(){if(!this.parentNode)return;const parent=this.parentNode;parent.children=parent.children.filter(child=>child!==this);this.parentNode=null;this.connect(false);if(this.contains(doc.activeElement)||doc.activeElement===this)doc.activeElement=doc.body;}
    contains(node){return node===this||this.children.some(child=>child.contains(node));}
    matches(selector){return selector==='dialog:modal'?false:false;}
    closest(selector){for(let node=this;node;node=node.parentNode)if(selector.includes('[inert]')&&node.attributes.inert!==undefined||selector.includes('.sv-modal-underlay')&&node.classList.contains('sv-modal-underlay'))return node;return null;}
    getClientRects(){return this.isConnected&&!this.hidden&&this.style.display!=='none'?[{}]:[];}
    querySelectorAll(){return this.children.filter(child=>child.tagName==='BUTTON'&&!child.disabled);}
    querySelector(selector){return this.children.find(child=>selector==='[data-hsex-block-close]'?child.attributes['data-hsex-block-close']!==undefined:selector==='.btn-primary'?child.getAttribute('class')?.includes('btn-primary'):false)||null;}
    focus(options){doc.activeElement=this;calls.focus.push({node:this,options});}
    scrollIntoView(options){calls.scrolled={node:this,options};}
  }
  doc.body=new Element('BODY');doc.body.connect(true);doc.body.style.overflow='auto';
  const page=new Element();page.id='page-dashboard';page.className='page active';doc.body.appendChild(page);
  const origin=new Element('BUTTON');origin.textContent='Cargar hs extra';page.appendChild(origin);origin.focus();
  const nav=new Element('BUTTON');nav.textContent='OT';page.appendChild(nav);
  doc.createElement=()=>new Element();
  const all=()=>{const list=[];function walk(node){list.push(node);node.children.forEach(walk);}walk(doc.body);return list;};
  doc.getElementById=id=>all().find(node=>node.id===id)||null;
  doc.querySelector=selector=>selector==='.page.active'?page:selector==='[onclick*="ordentrabajo"]'?nav:null;
  doc.querySelectorAll=selector=>selector.includes('.modal-overlay')?all().filter(node=>node.classList.contains('modal-overlay')||node.attributes.role==='dialog'):[];
  const employee={fbKey:'employee-fictional',nombre:'Persona ficticia'};
  const overdue=[{id:'OT-FICTICIA'}];
  context={window:null,document:doc,currentUserUid:'user-fictional',currentRole:'tecnico',isAuthenticated:true,
    fbAuth:{currentUser:{uid:'user-fictional'}},PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:2,
    location:{hash:'#/dashboard'},_impersonacionOriginal:null,_svModalSyncPendiente:false,
    _hsexEmpleadoActual:()=>employee,_hsexOTPendientesVencidas:()=>overdue,tienePermiso:()=>false,
    escapeHTML:value=>String(value).replace(/[<>&"']/g,''),renderHsExtraCalendarGrid:()=>calls.calendar++,
    getComputedStyle:node=>({display:node.style.display||'block',visibility:node.hidden?'hidden':'visible',position:node.classList.contains('modal-overlay')?'fixed':'static',zIndex:node.style.zIndex||'9000'}),
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>assert.fail('No new timers'),
    fetch:()=>{calls.network++;assert.fail('No network');},fbGet:()=>{calls.network++;assert.fail('No SDK reads');},fbUpdate:()=>{calls.writes++;assert.fail('No writes');},
    svNavegarDirecto(name,callback,button){calls.navigation.push({name,button});page.id='page-'+name;context.location.hash='#/'+name;nav.focus();callback();},
    renderOTTabla:value=>calls.render.push(value),
    MutationObserver:class {constructor(fn){this.fn=fn;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},
    notify:()=>assert.fail('Unexpected notice')};
  events(context,windowEvents);context.window=context;vm.createContext(context);
  for(const name of ['_svModalEsVisible','svSincronizarPilaModales','cerrarBloqueoOTPendientesHsExtra','_hsexActivarDialogoBloqueoOT','irAOTPendientesHsExtra','abrirFormCargaHsExtra'])vm.runInContext(functionSource(name),context);
  function flush(){for(const observer of [...observers])observer.fn([]);while(frames.length)frames.shift()();}
  const open=()=>{context.abrirFormCargaHsExtra();flush();return doc.getElementById('modal-hsextra');};
  const click=(overlay,index)=>{const button=overlay.children[index];button.focus();vm.runInContext(button.getAttribute('onclick'),context);flush();};
  function key(overlay,value,shift=false,target=doc.activeElement){const event={key:value,shiftKey:shift,target,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};overlay.emit('keydown',event);flush();return event;}
  const countListeners=()=>[...documentEvents.values(),...windowEvents.values()].reduce((sum,list)=>sum+list.size,0);
  return {c:context,doc,page,origin,nav,employee,overdue,calls,frames,observers,open,flush,click,key,countListeners,Element};
}

test('the real OT blocker has a named modal dialog and focuses its close action',()=>{
  const f=fixture(),modal=f.open();assert.equal(modal.getAttribute('role'),'dialog');assert.equal(modal.getAttribute('aria-modal'),'true');
  assert.equal(modal.getAttribute('aria-labelledby'),'hsex-bloqueo-titulo');assert.match(modal.innerHTML,/id="hsex-bloqueo-titulo"/);assert.match(modal.innerHTML,/id="hsex-bloqueo-descripcion"/);
  assert.equal(f.doc.activeElement,modal.children[0]);assert.equal(modal.children[0].getAttribute('aria-label'),'Cerrar aviso de OT pendientes');assert.equal(f.doc.body.classList.contains('sv-modal-stack-open'),true);assert.equal(f.calls.calendar,0);assert.equal(f.calls.network,0);assert.equal(f.calls.writes,0);
});
for(const [label,index]of [['X',0],['Cerrar',1]])test(label+' returns focus without scrolling and releases the shared modal lock',()=>{
  const f=fixture(),modal=f.open();f.click(modal,index);assert.equal(f.doc.getElementById('modal-hsextra'),null);assert.equal(f.doc.activeElement,f.origin);assert.equal(f.calls.focus.at(-1).options.preventScroll,true);assert.equal(f.doc.body.classList.contains('sv-modal-stack-open'),false);assert.equal(f.doc.body.style.overflow,'auto');assert.equal(f.countListeners(),0);assert.equal(f.observers.size,0);
});
test('Escape has one owner, closes and returns focus',()=>{const f=fixture(),modal=f.open(),event=f.key(modal,'Escape');assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(f.doc.activeElement,f.origin);assert.equal(f.countListeners(),0);});
test('Tab wraps both ends; ordinary keyboard keys retain native behavior',()=>{
  const f=fixture(),modal=f.open();assert.equal(f.key(modal,'Tab',true).defaultPrevented,true);assert.equal(f.doc.activeElement,modal.children[2]);assert.equal(f.key(modal,'Tab').defaultPrevented,true);assert.equal(f.doc.activeElement,modal.children[0]);assert.equal(f.key(modal,'Enter').defaultPrevented,undefined);
  modal.focus();f.key(modal,'Tab');assert.equal(f.doc.activeElement,modal.children[0]);modal.children.forEach(button=>button.disabled=true);modal.focus();f.key(modal,'Tab');assert.equal(f.doc.activeElement,modal);
});
test('an underlaid blocker does not consume Escape or steal the upper dialog focus',()=>{
  const f=fixture(),modal=f.open(),other=new f.Element();other.className='modal-overlay';other.style.zIndex='10001';other.setAttribute('role','dialog');f.doc.body.appendChild(other);f.c.svSincronizarPilaModales();f.flush();other.focus();
  assert.equal(modal.classList.contains('sv-modal-underlay'),true);assert.equal(f.key(modal,'Escape',false,modal.children[0]).defaultPrevented,undefined);f.c.cerrarBloqueoOTPendientesHsExtra();f.flush();assert.equal(f.doc.activeElement,other);assert.equal(f.doc.body.classList.contains('sv-modal-stack-open'),true);assert.equal(f.doc.body.style.overflow,'auto');
});
for(const [label,change]of [
  ['UID',f=>f.c.currentUserUid='another'],['Auth object',f=>f.c.fbAuth.currentUser={uid:'user-fictional'}],['Auth UID',f=>f.c.fbAuth.currentUser.uid='another'],
  ['logout',f=>f.c.isAuthenticated=false],['role',f=>f.c.currentRole='admin'],['revision',f=>f.c.PERMISOS_ROLES.tecnico.indiceRevision++],
  ['epoch',f=>f.c._svOperacionesSesionEpoch++],['view',f=>f.c._impersonacionOriginal={}],['employee',f=>f.employee.fbKey='another'],
  ['hash',f=>f.c.location.hash='#/productos'],['hidden',f=>f.doc.hidden=true]
])test('closing after '+label+' changed never restores focus to the retired account',()=>{
  const f=fixture(),modal=f.open();change(f);f.c.cerrarBloqueoOTPendientesHsExtra();f.flush();assert.notEqual(f.doc.activeElement,f.origin);assert.equal(f.doc.getElementById('modal-hsextra'),null);assert.equal(f.countListeners(),0);assert.equal(f.observers.size,0);
});
for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange','hashchange'])test(event+' retires the blocker and its listeners',()=>{
  const f=fixture();f.open();if(event==='visibilitychange'){f.doc.hidden=true;f.doc.emit(event);}else if(event==='hashchange'){f.c.location.hash='#/productos';f.c.emit(event);}else f.doc.emit(event);f.flush();assert.equal(f.doc.getElementById('modal-hsextra'),null);assert.notEqual(f.doc.activeElement,f.origin);assert.equal(f.countListeners(),0);assert.equal(f.observers.size,0);
});
test('external removal cleans up and syncs scroll without returning focus',()=>{const f=fixture(),modal=f.open();modal.remove();f.flush();assert.equal(f.countListeners(),0);assert.equal(f.observers.size,0);assert.equal(f.doc.body.classList.contains('sv-modal-stack-open'),false);assert.notEqual(f.doc.activeElement,f.origin);});
test('reopening does not accumulate listeners and retains the original opener',()=>{const f=fixture();for(let i=0;i<7;i++){f.open();assert.equal(f.countListeners(),5);assert.equal(f.observers.size,1);}f.c.cerrarBloqueoOTPendientesHsExtra();f.flush();assert.equal(f.doc.activeElement,f.origin);assert.equal(f.countListeners(),0);});
test('an unavailable opener is not focused',()=>{const f=fixture();f.open();f.origin.disabled=true;f.c.cerrarBloqueoOTPendientesHsExtra();f.flush();assert.notEqual(f.doc.activeElement,f.origin);});
test('Ver OT pendientes navigates normally without restoring the opener or adding a timer',()=>{
  const f=fixture(),modal=f.open();const timers=[];f.c.setTimeout=(callback,delay)=>{assert.equal(delay,120);timers.push(callback);};f.click(modal,2);
  assert.equal(f.calls.navigation.length,1);assert.equal(f.calls.navigation[0].name,'ordentrabajo');assert.equal(f.calls.navigation[0].button,f.nav);assert.deepEqual(f.calls.render,['abiertas']);assert.equal(f.doc.activeElement,f.nav);assert.equal(f.doc.getElementById('modal-hsextra'),null);assert.equal(f.countListeners(),0);assert.equal(timers.length,1);assert.equal(f.calls.network,0);assert.equal(f.calls.writes,0);
});
