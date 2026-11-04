'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {runFlow}=require('./helpers/sale-return-flow.cjs');
function fixture(){
 const record={items:[{code:'FIXTURE',quantity:2,price:150.25,cost:90.125}],photos:['fixture-photo'],total:300.5};
 return {openColdList:async()=>({ready:true,complete:true,fixtureKey:'fixture-original'}),openDetail:async()=>structuredClone(record),duplicate:async()=>{},waitDependencies:async()=>({catalog:true,directory:true}),inspectForm:async()=>({...structuredClone(record),editable:true}),save:async()=>({confirmed:true,key:'fixture-copy'}),reopen:async()=>structuredClone(record),returnToBudget:async key=>({confirmed:true,saleKey:key,budgetKey:'fixture-budget'}),inspectPresentation:async()=>({saleVisible:false,budgetVisible:true,pending:false,error:null}),inspectInvariants:async()=>({originalUnchanged:true,paymentsUnchanged:true,stockUnchanged:true,commissionsUnchanged:true,returnCommits:1})};
}
test('self-test only: complete adapter transcript satisfies flow contract',async()=>{assert.deepEqual(await runFlow(fixture()),{savedKey:'fixture-copy',budgetKey:'fixture-budget'});});
for(const [name,method,result]of [['directory pending','waitDependencies',{catalog:true,directory:false}],['lost prices','inspectForm',{items:[],photos:[],editable:true}],['unconfirmed save','save',{confirmed:false}],['ACK presentation error','inspectPresentation',{saleVisible:false,budgetVisible:true,pending:false,error:'fixture ACK failure'}],['double return','inspectInvariants',{originalUnchanged:true,paymentsUnchanged:true,stockUnchanged:true,commissionsUnchanged:true,returnCommits:2}]])test('self-test rejects '+name,async()=>{const adapter=fixture();adapter[method]=async()=>result;await assert.rejects(runFlow(adapter));});
