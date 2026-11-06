'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {render}=require('./helpers/budget-print-fixture.cjs');
async function setup({failure=false}={}){
 const {html}=await render(),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 const script=scripts.find(m=>m[1].includes('function generarPdfPresupuesto('))[1];
 let removed=0,shareCalls=0,removedAtShare=-1,resolveShare,rejectShare;
 const button={innerHTML:'Compartir PDF',textContent:'Compartir PDF',disabled:false};
 const host={remove(){removed++;}},blob=new Blob(['fictitious PDF'],{type:'application/pdf'});
 const c={Promise,Blob,File:class{constructor(parts,name,opts){this.parts=parts;this.name=name;this.type=opts.type;}},requestAnimationFrame:f=>f(),document:{body:{dataset:{}},getElementById:()=>({})},window:{SVPrintLayout:{}},html2pdf(){},navigator:{canShare:()=>true,share(){shareCalls++;removedAtShare=removed;return new Promise((res,rej)=>{resolveShare=res;rejectShare=rej;});}},alert:message=>{c.alerts.push(message);},alerts:[]};
 vm.createContext(c);vm.runInContext(script,c);
 c.esperarRecursosPresupuesto=async()=>{};c.crearClonCapturaPresupuesto=()=>({host,clon:{scrollHeight:1100}});
 c.crearPdfCompleto=async()=>{if(failure)throw Error('Fictitious PDF failure');return blob;};
 return{c,button,blob,removed:()=>removed,shareCalls:()=>shareCalls,removedAtShare:()=>removedAtShare,resolve:()=>resolveShare(),abort:()=>rejectShare(Object.assign(Error('Cancelled'),{name:'AbortError'}))};
}
test('pending native share never retains the full-screen capture clone',async()=>{
 const f=await setup(),pending=f.c.generarPdfPresupuesto('compartir',f.button);
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(f.shareCalls(),1);assert.equal(f.removedAtShare(),1);assert.equal(f.removed(),1);
 f.resolve();await pending;assert.equal(f.removed(),1);assert.equal(f.button.disabled,false);assert.equal(f.button.innerHTML,'Compartir PDF');
});
test('cancel native sharing restores the action without error or duplicate export',async()=>{
 const f=await setup(),pending=f.c.generarPdfPresupuesto('compartir',f.button);
 for(let i=0;i<10;i++)await Promise.resolve();f.abort();await pending;
 assert.equal(f.removed(),1);assert.equal(f.button.disabled,false);assert.deepEqual(f.c.alerts,[]);
});
test('PDF generation failure removes its capture and restores the action',async()=>{
 const f=await setup({failure:true});await f.c.generarPdfPresupuesto('compartir',f.button);
 assert.equal(f.removed(),1);assert.equal(f.shareCalls(),0);assert.equal(f.button.disabled,false);assert.match(f.c.alerts[0],/Fictitious PDF failure/);
});
