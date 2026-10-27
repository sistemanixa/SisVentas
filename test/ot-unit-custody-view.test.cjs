'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const controller=require('../js/modules/ot-unit-custody');
const model=require('../js/core/ot-unit-confirmation.v1');
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let index=0;index<14;index++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// DOM deliberadamente pequeño: se usan nodos, propiedades y eventos reales del
// contrato del controlador; no se lee ni analiza HTML generado para seleccionar.
function dom(){
  const handlers=new Map();
  const document={activeElement:null,addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},emit(name){for(const fn of [...handlers.get(name)||[]])fn({type:name});},listenerCount(){return [...handlers.values()].reduce((sum,set)=>sum+set.size,0);}};
  class Node{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.className='';this.attributes={};this.handlers=new Map();this.value='';this.disabled=false;this.hidden=false;this._text='';}
    get isConnected(){let node=this;while(node){if(node===document.body)return true;node=node.parentNode;}return false;}
    get firstChild(){return this.children[0]||null;}
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this._text=String(value);for(const child of this.children)child.parentNode=null;this.children=[];}
    get classList(){const node=this;return {contains:name=>node.className.split(/\s+/).includes(name),add(...names){node.className=[...new Set(node.className.split(/\s+/).filter(Boolean).concat(names))].join(' ');},toggle(name,enabled){const values=new Set(node.className.split(/\s+/).filter(Boolean));const on=enabled===undefined?!values.has(name):enabled;if(on)values.add(name);else values.delete(name);node.className=[...values].join(' ');return on;}};}
    append(...nodes){for(const node of nodes){if(!(node instanceof Node))throw Error('La prueba exige nodos, no innerHTML');node.remove();node.parentNode=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const node of [...this.children])node.remove();this._text='';this.append(...nodes);}
    remove(){if(this.parentNode){const siblings=this.parentNode.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);this.parentNode=null;}}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(fn);}
    emit(name){const event={type:name,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};for(const fn of [...this.handlers.get(name)||[]])fn(event);return event;}
    click(){if(!this.disabled)this.emit('click');}
    focus(){document.activeElement=this;}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  document.createElement=tag=>new Node(tag);document.body=new Node('body');
  const trigger=new Node('button');trigger.textContent='Finalizar OT';document.body.append(trigger);trigger.focus();
  return {document,trigger};
}
function all(node,predicate){const result=[];for(const child of node.children){if(predicate(child))result.push(child);result.push(...all(child,predicate));}return result;}
const withTag=(document,tag)=>all(document.body,node=>node.tagName===tag.toUpperCase());
const withClass=(document,name)=>all(document.body,node=>node.classList.contains(name));
const buttons=document=>withTag(document,'button');

const saveButton=document=>buttons(document).find(n=>/Registrar entrega|Registrar devolución|Confirmar recepción|Guardando/.test(n.textContent));
const status=document=>withClass(document,'ot-unit-status')[0];
const inputs=document=>withTag(document,'input');
const series=document=>inputs(document).filter(n=>n.type==='text');
const checks=document=>inputs(document).filter(n=>n.type==='checkbox');
const selectors=document=>withTag(document,'select');
const ot={fbKey:'ot-demo',id:'OT-DEMO'};
const prepared=change=>({otKey:'ot-demo',revision:'f'.repeat(64),units:Array.from({length:5},(_,n)=>({key:'unit_'+n,itemKey:'locks',n,name:'Cerradura ficticia',code:'P-LOCK',materialKey:'locks'})),materials:[{key:'locks',cod:'P-LOCK',desc:'Cerraduras',vendida:5}],registry:{},capabilities:{entregar:true,devolver:true,recibir:true,historicalMapping:true},...change});
function fixture(options={}){
 const {document,trigger}=dom(),calls=[],pendingPrepare=deferred(),pendingConfirm=deferred();let valid=true;
 const request=(action,body,signal)=>{calls.push({action,body:clone(body),signal});return action==='preparar'?pendingPrepare.promise:pendingConfirm.promise;};
 const api=controller.create({document,request,context:()=>()=>valid,scan:options.scan,closeScanner:options.closeScanner});
 return {document,trigger,calls,api,pendingPrepare,pendingConfirm,invalidate(){valid=false;},open:(action='entregar')=>api.open(ot,{action}),async ready(data){pendingPrepare.resolve(data||prepared());await tick();}};
}
function fill(document,count=5){series(document).slice(0,count).forEach((n,i)=>n.value='SERIE-'+i);}
const receipt=f=>({ok:true,otKey:'ot-demo',action:f.calls.at(-1).body.accion,units:f.calls.at(-1).body.units.map(u=>u.key)});
test('cinco unidades ofrecen cinco series; cuatro completas no confirman ni guardan automáticamente',async()=>{const f=fixture(),task=f.open();assert.equal(status(f.document).textContent,'Cargando unidades…');await f.ready();assert.equal(series(f.document).length,5);fill(f.document,4);saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/Completá una serie/);assert.equal(f.document.activeElement,series(f.document)[4]);buttons(f.document).find(n=>n.textContent==='Cancelar').click();assert.equal(await task,null);assert.equal(f.document.listenerCount(),0);assert.equal(f.document.activeElement,f.trigger);});
test('confirmación espera acuse, bloquea doble clic y conserva sólo claves y series seleccionadas',async()=>{const f=fixture(),task=f.open();await f.ready();fill(f.document);saveButton(f.document).click();saveButton(f.document).click();await tick();assert.equal(f.calls.length,2);assert.equal(f.calls[1].body.units.length,5);assert.deepEqual(Object.keys(f.calls[1].body).sort(),['accion','otKey','revision','units']);assert.equal(buttons(f.document).find(n=>n.textContent==='Cancelar').disabled,true);f.pendingConfirm.resolve(receipt(f));assert.equal((await task).ok,true);assert.equal(withTag(f.document,'dialog').length,0);});
test('series repetidas se rechazan antes del HTTP',async()=>{const f=fixture(),task=f.open();await f.ready();fill(f.document);series(f.document)[4].value=' serie-0 ';saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);assert.match(status(f.document).textContent,/serie repetida/);f.api.close();await task;});
test('el escaneo sólo llena su unidad y no guarda; rechaza la misma serie en otra',async()=>{let options;const f=fixture({scan:value=>{options=value;}}),task=f.open();await f.ready();const readers=buttons(f.document).filter(n=>n.textContent==='Escanear serie');readers[0].click();await tick();options.onRead('SCAN-01');assert.equal(series(f.document)[0].value,'SCAN-01');assert.equal(f.calls.length,1);readers[1].click();await tick();options.onRead('scan-01');assert.equal(series(f.document)[1].value,'');assert.match(status(f.document).textContent,/serie ya está/);f.api.close();await task;});
test('cancelar retira lector y descarta una lectura tardía',async()=>{let options,closed=0;const f=fixture({scan:value=>{options=value;},closeScanner:()=>closed++}),task=f.open();await f.ready();buttons(f.document).find(n=>n.textContent==='Escanear serie').click();await tick();const field=series(f.document)[0];f.api.close();await task;assert.equal(closed,1);options.onRead('LATE');assert.equal(field.value,'');assert.equal(f.calls.length,1);});
for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange'])test('retira contexto sin confirmar: '+event,async()=>{const f=fixture(),task=f.open();await f.ready();if(event==='visibilitychange')f.document.visibilityState='hidden';f.document.emit(event);assert.equal(await task,null);assert.equal(f.document.listenerCount(),0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].signal.aborted,true);});
test('devolución requiere selección explícita y no solicita nuevamente series',async()=>{const p=prepared();p.registry=Object.fromEntries(p.units.map(u=>[u.key,{unitKey:u.key,serie:'SERIE-'+u.n,estado:'en_tecnico'}]));const f=fixture(),task=f.open('devolver');await f.ready(p);assert.equal(series(f.document).length,0);saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);checks(f.document)[2].checked=true;saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[{key:'unit_2'}]);f.pendingConfirm.resolve(receipt(f));await task;});
test('recepción muestra sólo devoluciones pendientes, sin incluir instaladas ni en técnico',async()=>{const p=prepared();p.registry={unit_0:{unitKey:'unit_0',serie:'RETURN',estado:'devolucion_pendiente'},unit_1:{unitKey:'unit_1',serie:'INSTALLED',estado:'instalado'},unit_2:{unitKey:'unit_2',serie:'TECH',estado:'en_tecnico'}};const f=fixture(),task=f.open('recibir');await f.ready(p);assert.equal(checks(f.document).length,1);checks(f.document)[0].checked=true;saveButton(f.document).click();await tick();assert.deepEqual(f.calls[1].body.units,[{key:'unit_0'}]);f.pendingConfirm.resolve(receipt(f));await task;});
test('identificación histórica exige elección y confirmación expresa',async()=>{const p=prepared();p.units=p.units.slice(0,1);delete p.units[0].materialKey;const f=fixture(),task=f.open();await f.ready(p);fill(f.document,1);saveButton(f.document).click();await tick();assert.equal(f.calls.length,1);selectors(f.document)[0].value='locks';checks(f.document)[1].checked=true;saveButton(f.document).click();await tick();assert.equal(f.calls[1].body.units[0].confirmLink,true);assert.equal(f.calls[1].body.units[0].materialKey,'locks');f.pendingConfirm.resolve(receipt(f));await task;});
test('sin permiso histórico no habilita un renglón ambiguo',async()=>{const p=prepared();p.units=p.units.slice(0,1);delete p.units[0].materialKey;p.capabilities.historicalMapping=false;const f=fixture(),task=f.open();await f.ready(p);assert.equal(checks(f.document)[0].disabled,true);assert.equal(saveButton(f.document).disabled,true);f.api.close();await task;});
test('un resultado atrasado tras cambiar contexto cierra sin mostrarlo',async()=>{const f=fixture(),task=f.open();f.invalidate();await f.ready();assert.equal(await task,null);assert.equal(f.calls.length,1);assert.equal(withTag(f.document,'dialog').length,0);});
test('fallo del servidor conserva las series para reintentar sin éxito falso',async()=>{const f=fixture(),task=f.open();await f.ready();fill(f.document);saveButton(f.document).click();await tick();f.pendingConfirm.reject(Error('Revisión cambiada'));await tick();assert.match(status(f.document).textContent,/Revisión cambiada/);assert.equal(series(f.document)[0].value,'SERIE-0');assert.equal(saveButton(f.document).disabled,false);f.api.close();await task;});

test('acuse de otras unidades no se presenta como guardado',async()=>{const f=fixture(),task=f.open();await f.ready();fill(f.document);saveButton(f.document).click();await tick();f.pendingConfirm.resolve({ok:true,otKey:'ot-demo',action:'entregar',units:['other']});await tick();assert.match(status(f.document).textContent,/No se pudo comprobar/);assert.equal(withTag(f.document,'dialog').length,1);f.api.close();await task;});
for(const reverse of [true,false])test('Tab conserva foco en los extremos: '+reverse,async()=>{const f=fixture(),task=f.open();await f.ready();const first=checks(f.document)[0],last=saveButton(f.document),dialog=withTag(f.document,'dialog')[0];(reverse?first:last).focus();let prevented=false;for(const fn of dialog.handlers.get('keydown'))fn({key:'Tab',shiftKey:reverse,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.document.activeElement,reverse?last:first);f.api.close();await task;});
