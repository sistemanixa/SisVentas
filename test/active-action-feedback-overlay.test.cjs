'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {readActiveApp}=require('./helpers/active-app');
const overlay=require('../scripts/lib/active-action-feedback-overlay.cjs');
const original=readActiveApp().source,patched=overlay.apply(original);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
for(const name of overlay.names)test(name+' patch is scoped and compiles',()=>{
 const before=overlay.extract(original,name).text,after=overlay.extract(patched,name).text;
 new vm.Script(after);assert.notEqual(after,before);
 if(!['spAgregarNota','guardarDatosEmpresa'].includes(name))assert.equal(after.replace(/return (window\.fb(?:Get|Set|Push|Update)\(|operacion\.then|op\.then)/g,'$1'),before);
});
test('unknown source fails closed',()=>assert.throws(()=>overlay.apply(original.replace('function guardarKit() {','function guardarKit() {\n// changed')),/review required/));
for(const name of ['guardarAlicuotaIVA','guardarImpuestosGenerales'])test(name+' awaits GET and SET and preserves prior fields',async()=>{
 const get=deferred(),set=deferred(),writes=[],notes=[];
 const context={document:{getElementById:()=>({value:'21'})},notify:x=>notes.push(x),fbDB:{},fbRef:(_,p)=>p,fbGet:()=>get.promise,fbSet:(p,v)=>{writes.push({p,v});return set.promise;}};context.window=context;vm.createContext(context);vm.runInContext(overlay.extract(patched,name).text,context);
 const result=context[name]('input','iva');let done=false;result.then(()=>done=true);get.resolve({val:()=>({historical:'keep'})});await new Promise(setImmediate);assert.equal(done,false);assert.equal(writes[0].v.historical,'keep');set.resolve();await result;assert.equal(done,true);assert.equal(notes.length,1);
});
for(const helper of [false,true])test('support note dedupes and preserves draft/history; helper='+helper,async()=>{
 const wait=deferred(),writes=[],calls=[];const inp={value:'Prueba ficticia',parentElement:{querySelector:()=>({})}};
 const context={document:{getElementById:()=>inp},SP_MODAL_KEY:'claim',SP_DATA:{claim:{historial:[{texto:'original'}]}},currentUser:'Ficticio',notify:()=>{},fbDB:{},fbRef:(_,p)=>p,fbUpdate:(p,v)=>{writes.push({p,v});return wait.promise;}};context.window=context;
 if(helper)context.SisVentas={carga:{ejecutarAccion:(opts,task)=>{calls.push(opts);return task();}}};vm.createContext(context);vm.runInContext(overlay.extract(patched,'spAgregarNota').text,context);
 const a=context.spAgregarNota(),b=context.spAgregarNota();assert.equal(a,b);await new Promise(setImmediate);assert.equal(writes.length,1);assert.equal(writes[0].v.historial.length,2);assert.equal(context.SP_DATA.claim.historial.length,1);inp.value='Nuevo borrador';context.SP_MODAL_KEY='another';wait.resolve();await a;assert.equal(inp.value,'Nuevo borrador');assert.equal(inp._svSupportNotePending,undefined);if(helper)assert.equal(calls[0].clave,'support-note:claim');
});
for(const file of ['catalog-promotions-config.js','paraguay-budget-margin.js'])test(file+' shared helper and fallback lock until ACK',async()=>{
 const source=fs.readFileSync('js/modules/'+file,'utf8');const helperSource=source.slice(source.indexOf('function saveAction('),source.indexOf('\n}',source.indexOf('function saveAction('))+2);
 const context={window:{}};vm.createContext(context);vm.runInContext(helperSource,context);
 const wait=deferred(),attrs={},button={textContent:'Guardar',disabled:false,setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k]};let count=0;
 const a=context.saveAction(button,'key',()=>{count++;return wait.promise;}),b=context.saveAction(button,'key',()=>{count++;});assert.equal(a,b);assert.equal(button.disabled,true);assert.equal(button.textContent,'Guardando…');await new Promise(setImmediate);assert.equal(count,1);wait.reject(new Error('ficticio'));await assert.rejects(a);assert.equal(button.disabled,false);assert.equal(button.textContent,'Guardar');assert.equal(attrs['aria-busy'],undefined);
});
