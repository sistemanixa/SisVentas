'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/private-finance-ui.js','utf8'),code=source.slice(source.indexOf('async function viewPDF('),source.indexOf('function storageBadge('));
const deferred=()=>{let resolve,reject;return {promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve:x=>resolve(x),reject:e=>reject(e)};};
function fixture({pages=3,getPage,opening,clock=false}={}){
 const nodes={},events={},timers=[],calls=[],stats={destroy:0,cancel:0};
 const node=()=>({textContent:'',disabled:false,hidden:false,style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]??null;},removeAttribute(k){delete this.attributes[k];},append(){},getContext:()=>({})});
 for(const selector of ['h2','.close','.modalfoot','canvas','[data-prev]','[data-next]','[data-retry]','[data-pdf-status]'])nodes[selector]=node();
 nodes['[data-prev]'].disabled=nodes['[data-next]'].disabled=true;
 const dialog={attributes:{},setAttribute(key,value){this.attributes[key]=value;},showModal(){},remove(){dialog.removed=true;},querySelector:s=>nodes[s],addEventListener:(name,fn)=>events[name]=fn};
 const sheet={getViewport:()=>({width:200,height:300}),render:()=>({promise:Promise.resolve(),cancel:()=>stats.cancel++})};
 const pdf={numPages:pages,getPage:async n=>{calls.push(n);return getPage?getPage(n,sheet):sheet;},destroy:async()=>stats.destroy++};
 const context={pdfRequestGeneration:0,pdfDispose:null,dead:false,window:{SVPrivateFinancePDF:{open:()=>opening?.promise||Promise.resolve(pdf)}},document:{body:{style:{overflow:'auto'},append(){}},createElement:name=>name==='dialog'?dialog:node()},AbortController,setTimeout:clock?fn=>(timers.push(fn),timers.length):setTimeout,clearTimeout:clock?()=>{}:clearTimeout,urls:new Set(),Blob,URL};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const buttonActivities='),source.indexOf('const paths=')),context);vm.runInContext(code,context);return {context,pdf,sheet,nodes,dialog,events,timers,calls,stats,open:()=>context.viewPDF(new Uint8Array([1]).buffer,'Ejemplo.pdf')};
}
test('última página queda indicada y deshabilita Siguiente; no pide una página inexistente',async()=>{const f=fixture();await f.open();assert.equal(f.nodes['[data-prev]'].disabled,true);await f.nodes['[data-next]'].onclick();await f.nodes['[data-next]'].onclick();assert.match(f.nodes['[data-pdf-status]'].textContent,/Página 3 de 3.*Última página/);assert.equal(f.nodes['[data-next]'].disabled,true);await f.nodes['[data-next]'].onclick();assert.deepEqual(f.calls,[1,2,3]);await f.nodes['[data-prev]'].onclick();assert.equal(f.nodes['[data-next]'].disabled,false);f.context.pdfDispose();});
test('doble clic durante carga no superpone render ni avanza dos páginas',async()=>{const page2=deferred(),f=fixture({getPage:(n,sheet)=>n===2?page2.promise:sheet});await f.open();const task=f.nodes['[data-next]'].onclick();assert.equal(f.nodes['[data-next]'].disabled,true);await f.nodes['[data-next]'].onclick();assert.deepEqual(f.calls,[1,2]);page2.resolve(f.sheet);await task;assert.match(f.nodes['[data-pdf-status]'].textContent,/Página 2 de 3/);f.context.pdfDispose();});
test('PDF de una página desactiva ambas flechas y cerrar restaura scroll',async()=>{const f=fixture({pages:1});await f.open();assert.equal(f.nodes['[data-prev]'].disabled,true);assert.equal(f.nodes['[data-next]'].disabled,true);f.nodes['.close'].onclick();assert.equal(f.context.document.body.style.overflow,'auto');assert.equal(f.dialog.removed,true);assert.equal(f.stats.destroy,1);});
test('fallo al leer una página no deja carga eterna y se puede reintentar',async()=>{let fail=true;const f=fixture({getPage:(n,sheet)=>{if(fail&&n===2)throw Error('Página ilegible');return sheet;}});await f.open();await f.nodes['[data-next]'].onclick();assert.match(f.nodes['[data-pdf-status]'].textContent,/No se pudo mostrar la página 2/);assert.equal(f.nodes['[data-retry]'].hidden,false);fail=false;await f.nodes['[data-retry]'].onclick();assert.match(f.nodes['[data-pdf-status]'].textContent,/Página 2 de 3/);assert.equal(f.nodes['[data-retry]'].hidden,true);f.context.pdfDispose();});
test('cerrar durante apertura descarta documento tardío y no vuelve a mostrar modal',async()=>{const opening=deferred(),f=fixture({opening});const task=f.open();f.nodes['.close'].onclick();await task;opening.resolve(f.pdf);await new Promise(r=>setImmediate(r));assert.equal(f.stats.destroy,1);assert.equal(f.dialog.removed,true);assert.equal(f.context.pdfDispose,null);});
test('límite de apertura informa error y libera PDF que llega tarde',async()=>{const opening=deferred(),f=fixture({opening,clock:true}),task=f.open();f.timers[0]();await task;assert.match(f.nodes['[data-pdf-status]'].textContent,/No se pudo mostrar el original/);assert.equal(f.nodes['[data-next]'].disabled,true);opening.resolve(f.pdf);await new Promise(r=>setImmediate(r));assert.equal(f.stats.destroy,1);f.context.pdfDispose();});

test('última página deshabilitada no queda marcada como una carga pendiente',async()=>{
 const f=fixture({pages:1});await f.open();assert.equal(f.dialog.className,'private-pdf-viewer');assert.equal(f.dialog.attributes['aria-busy'],'false');assert.equal(f.nodes['[data-next]'].disabled,true);assert.equal(f.nodes['[data-next]'].title,'Llegaste a la última página');await f.nodes['[data-next]'].onclick();assert.deepEqual(f.calls,[1]);assert.equal(f.dialog.attributes['aria-busy'],'false');f.context.pdfDispose();
});
test('estado ocupado sólo dura la carga real y se libera incluso ante error',async()=>{
 const pending=deferred(),f=fixture({pages:2,getPage:(n,s)=>n===2?pending.promise:s});await f.open();const task=f.nodes['[data-next]'].onclick();assert.equal(f.dialog.attributes['aria-busy'],'true');pending.reject(Error('Error ficticio'));await task;assert.equal(f.dialog.attributes['aria-busy'],'false');assert.equal(f.nodes['[data-retry]'].hidden,false);f.context.pdfDispose();
});
test('error de apertura tampoco deja el indicador de carga activo',async()=>{
 const opening=deferred(),f=fixture({opening});const task=f.open();assert.equal(f.dialog.attributes['aria-busy'],'true');opening.reject(Error('Error ficticio'));await task;assert.equal(f.dialog.attributes['aria-busy'],'false');f.context.pdfDispose();
});

test('círculo del botón dura sólo la lectura de página y no reactiva Siguiente al llegar al final',async()=>{
 const pending=deferred(),f=fixture({pages:2,getPage:(n,s)=>n===2?pending.promise:s});await f.open();const next=f.nodes['[data-next]'],task=next.onclick();assert.equal(next.getAttribute('aria-busy'),'true');assert.equal(next.disabled,true);await next.onclick();assert.deepEqual(f.calls,[1,2]);pending.resolve(f.sheet);await task;assert.equal(next.getAttribute('aria-busy'),null);assert.equal(next.disabled,true);assert.equal(next.textContent,'Última página');f.context.pdfDispose();
});
