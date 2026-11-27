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
