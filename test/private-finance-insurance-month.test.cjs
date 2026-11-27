'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui=fs.readFileSync(require.resolve('../js/modules/private-finance-ui.js'),'utf8');
const scope={M:{suggestCategory:m=>m.suggestion}};
vm.runInNewContext(ui.slice(ui.indexOf('function insuranceMonthMovements('),ui.indexOf("let insuranceMonth='';")),scope);
test('Seguros usa cada movimiento del mes una vez y separa pendencia de confirmados',()=>{
 const movement=(id,date,amount,extra={})=>({id,date,amount,currency:'ARS',...extra});
 const data={insurances:[
  {classification:'Seguro',amount:99999,charges:['oct','nov']},
  {classification:'Por confirmar',charges:{first:'nov'}},
  {classification:'No es seguro',charges:['excluded']},
  {classification:'Seguro',amount:99999,charges:[]}
 ],movements:[
  movement('oct','2026-10-28',100),
  movement('nov','2026-11-15',200),
  movement('pending','2026-11-20',800,{suggestion:'Seguro',currency:'USD'}),
  movement('excluded','2026-11-20',600,{suggestion:'Seguro'}),
  movement('unrelated','2026-11-20',300)
 ]};
 const before=JSON.stringify(data);
 const select=month=>Array.from(scope.insuranceMonthMovements(data,month),x=>[x.movement.id,x.movement.amount,x.movement.currency,x.confirmed]);
 assert.deepEqual(select('2026-10'),[['oct',100,'ARS',true]]);
 assert.deepEqual(select('2026-11'),[['nov',200,'ARS',true],['pending',800,'USD',false]]);
 assert.deepEqual(select('2026-12'),[]);
 assert.equal(JSON.stringify(data),before);
});
