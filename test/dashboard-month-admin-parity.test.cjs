'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{functionSource}=require('./helpers/app-functions.cjs');
const Reader=require('../cotizador/dashboard-budget-activity-reader-proposal'),{activitySeed,memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs'),{budget,authFixture,request}=require('./helpers/dashboard-budget-reader-fixture.cjs');
test('admin monthly result preserves actual legacy label filtering across the authorized all scope',async()=>{
 const records={mine:budget({empleado:'Admin ficticio',responsableUid:'a',estado:'convertido'}),reassigned:budget({empleado:'Admin ficticio',responsableUid:'v'}),otherLabel:budget({empleado:'Uno',responsableUid:'a'})},state=activitySeed(records),nodes=new Map(['dash-adm-pptos','dash-adm-pptos-sub','dash-adm-ventas','dash-adm-ventas-sub','dash-adm-conv'].map(id=>[id,{}]));
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-04T15:00:00Z']));}}
 const sandbox={Date:Clock,currentUser:'Admin ficticio',pptoData:Object.values(records),ventasList:[],document:{getElementById:id=>nodes.get(id)||null}};vm.createContext(sandbox);vm.runInContext(functionSource('renderDashAdministrativo'),sandbox);sandbox.renderDashAdministrativo();assert.equal(nodes.get('dash-adm-pptos').textContent,2);
 const c=state.sv_dashboard_budget_proposal.v1.coverage,reader=Reader.createActivityReader({auth:authFixture('a'),db:memoryDb(state),enabled:true,getAsOfDay:()=> '2026-11-04',getLegacyContext:()=>({timeZone:c.activityTimeZone,sourceLocale:c.activitySourceLocale})}),result=await reader.read(request({url:Reader.ROUTE}));
 assert.equal(result.scope,'all');assert.equal(result.monthly.records,nodes.get('dash-adm-pptos').textContent);assert.equal(result.monthly.converted,1);assert.equal(result.monthly.conversionPercent,50);assert.equal(result.monthly.scope,'all');
});
