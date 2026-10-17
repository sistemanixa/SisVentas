'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function fixture(){
 const listeners=new Map();let document;
 function element(tag){return {tagName:tag.toUpperCase(),children:[],style:{},className:'',isConnected:true,setAttribute(){},appendChild(n){n.parentElement=this;this.children.push(n);return n;},remove(){this.isConnected=false;this.parentElement.children=this.parentElement.children.filter(n=>n!==this);},contains(n){return n===this||this.children.some(c=>c.contains(n));},getClientRects(){return this.isConnected?[{}]:[];},closest(selector){return selector.includes('button')&&this.tagName==='BUTTON'?this:null;},focus(){document.activeElement=this;},querySelectorAll(){return this.children.flatMap(n=>[...(['BUTTON','INPUT','TEXTAREA','A'].includes(n.tagName)?[n]:[]),...n.querySelectorAll()]);}};}
 document={body:element('body'),activeElement:element('button'),createElement:element,querySelectorAll:()=>[],addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
 const before=document.activeElement;
 const c=load({document,setTimeout:fn=>fn(),svSincronizarPilaModales(){}},['_svCrearDialogoSistema']);
 function key(target,key,extra={}){const ev={target,key,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){},...extra};listeners.get('keydown')?.(ev);return ev;}
 return {document,before,open:o=>c._svCrearDialogoSistema(o),buttons:()=>document.body.querySelectorAll().filter(n=>n.tagName==='BUTTON'),key};
}
test('Enter en Cancelar conserva la cancelación; no confirma una operación',async()=>{const f=fixture(),p=f.open({mensaje:'Confirmación ficticia'}),cancel=f.buttons()[0];cancel.focus();const e=f.key(cancel,'Enter');assert.equal(e.prevented,undefined);cancel.onclick();assert.equal(await p,false);});
test('cerrar restaura el foco al control de origen conectado',async()=>{const f=fixture(),p=f.open({});f.buttons()[0].onclick();assert.equal(await p,false);assert.equal(f.document.activeElement,f.before);});
test('Tab y Shift+Tab circulan dentro de la confirmación',async()=>{const f=fixture(),p=f.open({});const [first,last]=f.buttons();last.focus();assert.equal(f.key(last,'Tab').prevented,true);assert.equal(f.document.activeElement,first);assert.equal(f.key(first,'Tab',{shiftKey:true}).prevented,true);assert.equal(f.document.activeElement,last);first.onclick();await p;});
test('Enter de otra ventana y composición no cierran la confirmación',async()=>{const f=fixture(),p=f.open({tipo:'prompt',valor:'ficticio'});assert.equal(f.key(f.before,'Enter').prevented,undefined);const input=f.document.activeElement;assert.equal(f.key(input,'Enter',{isComposing:true}).prevented,undefined);assert.equal(f.document.body.children.length,1);f.buttons()[0].onclick();assert.equal(await p,null);});
test('Enter en campo simple confirma el valor y Escape cancela',async()=>{const f=fixture(),p=f.open({tipo:'prompt',valor:'ficticio'});f.key(f.document.activeElement,'Enter');assert.equal(await p,'ficticio');const q=f.open({tipo:'prompt'});f.key(f.document.activeElement,'Escape');assert.equal(await q,null);});
test('un campo multilínea conserva Enter como salto de línea',async()=>{const f=fixture(),p=f.open({tipo:'prompt',multilinea:true});assert.equal(f.key(f.document.activeElement,'Enter').prevented,undefined);f.buttons()[0].onclick();await p;});
