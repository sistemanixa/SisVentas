'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/keyboard-actions.js','utf8');
function fixture({disabled=false,busy=false,modal=false}={}){
 let handler,clicks=0;const notices=[];
 const confirm={textContent:'Confirmar venta',disabled,getAttribute:name=>name==='aria-busy'&&busy?'true':null,getClientRects:()=>[1],click(){clicks++;this.disabled=true;}};
 const page={id:'page-venta',querySelector:s=>s==='button[onclick="confirmarVenta()"]'?confirm:null,querySelectorAll:()=>[confirm]};
 const dialog={id:'modal-aviso',tagName:'DIV',getClientRects:()=>[1],querySelector:()=>null,querySelectorAll:()=>[]};
 const c={document:{querySelectorAll:()=>modal?[dialog]:[],querySelector:()=>page,addEventListener:(_,fn)=>{handler=fn;}},getComputedStyle:()=>({visibility:'visible',zIndex:'0'}),notify:message=>notices.push(message)};c.window=c;vm.runInNewContext(source,c);
 return {notices,get clicks(){return clicks;},key(extra={}){handler({key:'F5',repeat:false,preventDefault(){},stopImmediatePropagation(){},...extra});}};
}
test('F5 ejecuta Confirmar venta visible y no duplica una operación ocupada',()=>{const f=fixture();f.key();f.key();assert.equal(f.clicks,1);assert.deepEqual(f.notices,[]);});
for(const state of [{disabled:true},{busy:true}])test('F5 respeta el estado de Confirmar venta '+JSON.stringify(state),()=>{const f=fixture(state);f.key();assert.equal(f.clicks,0);assert.deepEqual(f.notices,[]);});
test('F5 no confirma la venta detrás de un modal',()=>{const f=fixture({modal:true});f.key();assert.equal(f.clicks,0);assert.match(f.notices[0],/no tiene un botón Guardar/);});
test('F5 repetido y con modificadores no confirma la venta',()=>{const f=fixture();f.key({repeat:true});f.key({ctrlKey:true});assert.equal(f.clicks,0);});
