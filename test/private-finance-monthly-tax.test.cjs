'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui=fs.readFileSync(require.resolve('../js/modules/private-finance-ui.js'),'utf8');
const scope={};
vm.runInNewContext(ui.slice(ui.indexOf('function monthlyTaxCharges('),ui.indexOf('function taxesResults(')),scope);
test('Impuestos e intereses agrupa por vencimiento y excluye pagos externos duplicados o pendientes',()=>{
 const data={statements:[{id:'s',card:'visa',due:'2026-11-02'}],movements:[
  {id:'i',statement:'s',kind:'Impuesto',date:'2026-10-22',amount:100,currency:'ARS'},
  {id:'f',statement:'s',kind:'Interés',date:'2026-10-22',amount:200,currency:'USD'},
  {id:'x',statement:'s',kind:'Cuota',date:'2026-10-22',amount:300,currency:'ARS'}
 ],expenses:[
  {id:'e',status:'Pagado',date:'2026-11-11',category:'Impuestos',amount:400},
  {id:'dup',status:'Pagado',date:'2026-11-11',category:'Impuestos',linkedMovement:'i'},
  {id:'pending',status:'Pendiente',date:'2026-11-11',category:'Impuestos'}
 ]};
 const monthly=scope.monthlyTaxCharges(data,'2026-11');
 assert.equal(Array.from(monthly.get('visa'),r=>r.id).join(','),'i,f');
 assert.equal(Array.from(monthly.get(null),r=>r.id).join(','),'e');
 assert.equal(scope.monthlyTaxCharges(data,'2026-10').size,0);
});
