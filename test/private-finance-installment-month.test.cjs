'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ui=fs.readFileSync(require.resolve('../js/modules/private-finance-ui.js'),'utf8');
const {shift}=require('../js/core/private-finance-model.js');
const scope={};
vm.runInNewContext(ui.slice(ui.indexOf('function installmentForMonth('),ui.indexOf('function quotaMonthResults(')),scope);
test('Las cuotas históricas usan el importe informado y el mes sin resumen se estima sin persistir',()=>{
 const q={id:'q',period:'2026-11',current:3,total:4,amount:12750,origin:'PDF',movement:'nov',observations:{
  october:{statement:'oct',movement:'oct',period:'2026-10',current:2,total:4,amount:10000},
  november:{statement:'nov',movement:'nov',period:'2026-11',current:3,total:4,amount:12750}
 }};
 const original=JSON.stringify(q);
 const select=p=>scope.installmentForMonth(q,p,shift);
 assert.equal(select('2026-09'),null);
 assert.equal(select('2026-10').amount,10000);
 assert.equal(select('2026-10').current,2);
 assert.equal(select('2026-10').confirmed,true);
 assert.equal(select('2026-11').amount,12750);
 assert.equal(select('2026-12').current,4);
 assert.equal(select('2026-12').confirmed,false);
 assert.equal(select('2027-01'),null);
 assert.equal(scope.installmentForMonth({...q,status:'Anulada'},'2026-12',shift),null);
 assert.equal(JSON.stringify(q),original);
});

test('El mes agrupa cierres de distintos bancos por vencimiento e incluye cuotas sin ficha',()=>{
 const data={statements:[
  {id:'p',period:'2026-10',due:'2026-11-11'},
  {id:'g',period:'2026-11',due:'2026-11-13'}
 ],movements:[
  {id:'p1',statement:'p',kind:'Cuota',concept:'Provincia',current:1,total:3,amount:10000},
  {id:'g1',statement:'g',kind:'Cuota',concept:'Galicia',current:2,total:4,amount:20000}
 ],installments:[
  {id:'qp',movement:'p1',period:'2026-10',current:1,total:3,amount:10000},
  {id:'future',period:'2026-10',current:1,total:3,amount:30000,origin:'Manual'}
 ]};
 const nov=Array.from(scope.installmentRowsForCycle(data,'2026-11',shift),q=>[q.concept||q.id,q.current,q.confirmed]);
 assert.deepEqual(nov,[['Provincia',1,true],['Galicia',2,true],['future',2,false]]);
 assert.deepEqual(Array.from(scope.installmentRowsForCycle(data,'2026-12',shift),q=>[q.id,q.current]),[['qp',2],['future',3]]);
});

test('Un movimiento verificado reemplaza una proyección histórica equivalente y conserva coincidencias ambiguas',()=>{
 const statement={id:'recent',card:'x',due:'2026-11-02',period:'2026-10'};
 const movement={id:'m',statement:'recent',card:'x',kind:'Cuota',concept:'COMPRA ANTIGUA C.06/06',current:6,total:6,amount:7095316,currency:'ARS'};
 const estimate={id:'old',card:'x',origin:'Manual',period:'2026-10',concept:'COMPRA ANTIGUA',current:5,total:6,amount:7095316,currency:'ARS'};
 const select=(installments,movements)=>Array.from(scope.installmentRowsForCycle({statements:[statement],movements,installments},'2026-11',shift),q=>[q.movement||q.id,q.confirmed]);
 assert.deepEqual(select([estimate],[movement]),[['m',true]]);
 assert.deepEqual(select([estimate],[{...movement,amount:7095317}]),[['m',true],['old',false]]);
 assert.deepEqual(select([estimate],[movement,{...movement,id:'m2'}]),[['m',true],['m2',true],['old',false]]);
});
