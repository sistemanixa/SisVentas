'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {readActiveApp}=require('./helpers/active-app'),{extract}=require('../scripts/lib/active-action-feedback-overlay.cjs');
const overlay=require('../scripts/lib/active-action-feedback-remainder-overlay.cjs'),changes=require('../scripts/lib/active-action-feedback-remainder-patch.json');
const source=readActiveApp().source,patched=overlay.apply(source);
for(const change of changes)test(change.name+' exact active action patch preserves existing operations',()=>{
 const actual=extract(patched,change.name).text;assert.equal(actual,change.after);new vm.Script(actual);
 const before=extract(source,change.name).text;if(before===actual)return;
 const canonical=s=>s.replace(/\breturn\s+/g,'').replace(/\s*var _svPromesaAccion;/g,'').replace(/_svPromesaAccion = /g,'').replace(/\s*_svPromesaAccion;(?=\s*}$)/,'').replace(/\breturn\s*;/g,'').replace(/\s+/g,'');
 if(!['guardarTipoCambio','guardarFilaConfig'].includes(change.name))assert.equal(canonical(actual),canonical(before));
 else {assert.equal(actual.slice(0,actual.lastIndexOf('}')).replace('return window.fbSet','window.fbSet').trim(),before.slice(0,before.indexOf(change.name==='guardarTipoCambio'?'  var orig =':'  var icon =')).trim());}
});
test('patches are idempotent and reject unknown edits',()=>{assert.equal(overlay.apply(patched),patched);assert.throws(()=>overlay.apply(source.replace('function cargosGuardar() {','function cargosGuardar() {\n// unreviewed')),/review required/);});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function load(name,extra){const c={console,Date,Promise,notify(){},...extra};c.window=c;vm.createContext(c);vm.runInContext(extract(patched,name).text,c);return c;}
for(const name of ['eliminarClienteDesdeHistorial','eliminarProductoDesdeDetalle','imprimirPresupuestoActual'])test(name+' returns delegated operation with original arguments',()=>{
 const pending=deferred(),args=[];const c=load(name,{clienteActualId:'ficticio',editingProdId:'p',eliminarCliente:x=>{args.push(x);return pending.promise;},eliminarProductoPorId:(...x)=>{args.push(x);return pending.promise;},_pptoRegistroFormularioImpresion:()=>({items:[{qty:1}]}),imprimirPresupuesto:x=>{args.push(x);return pending.promise;}});
 assert.equal(c[name](),pending.promise);assert.equal(args.length,1);if(name==='eliminarProductoDesdeDetalle')assert.equal(args[0][1],true);if(name==='eliminarClienteDesdeHistorial')assert.equal(args[0].dataset.cid,'ficticio');
});
test('checklist stays pending until ACK and preserves rollback/history on failure',async()=>{
 const pending=deferred(),ot={id:'OT-FICTICIA',fbKey:'ot',checks:{preparacion:[false]},audit:[{accion:'original'}]},updates=[];
 const c=load('toggleChecklistFase',{otData:[ot],otActualId:'ot',CHECKLISTS:{preparacion:['a']},_otChecklistGuardando:{},otEstaCerrada:()=>false,normalizarChecklistOT(){},actualizarProgreso(){},renderChecklist(){},fbGuardarOT:o=>{updates.push(o);return pending.promise;},currentUser:'Ficticio'});
 const result=c.toggleChecklistFase('preparacion');assert.equal(typeof result.then,'function');assert.equal(c._otChecklistGuardando['ot:preparacion'],true);c.toggleChecklistFase('preparacion');assert.equal(updates.length,1);pending.reject(Error('ficticio'));await result;assert.deepEqual(ot.checks.preparacion,[false]);assert.equal(ot.audit.length,1);assert.equal(c._otChecklistGuardando['ot:preparacion'],undefined);
});
test('configuration returns actual write instead of a premature saved label',async()=>{
 const pending=deferred(),writes=[],button={innerHTML:'Guardar',disabled:false};const c=load('guardarTipoCambio',{document:{getElementById:()=>({value:'1600'})},fbDB:{},fbRef:(_,p)=>p,fbSet:(...x)=>{writes.push(x);return pending.promise;},actualizarDolarDashboard(){}});
 const result=c.guardarTipoCambio(button);assert.equal(typeof result.then,'function');assert.equal(button.innerHTML,'Guardar');assert.equal(writes[0][0],'sisventas/config/tipoCambio');pending.resolve();await result;assert.equal(writes.length,1);
});
test('wizard module patch returns existing commit and keeps rollback intact',()=>{const file='js/modules/ot-workflow.js',before=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),after=overlay.applyModule(file,before);assert.equal(overlay.applyModule(file,after),after);assert.ok(after.includes('return prom.then('));if(before!==after)assert.equal(after.replace('return prom.then(','prom.then('),before);new vm.Script(after);});
