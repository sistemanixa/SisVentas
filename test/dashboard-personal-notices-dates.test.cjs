'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../js/core/dashboard-personal-notices.v1');
const stamp=(day,time='12:00:00.000')=>new Date(day+'T'+time).getTime();
const record=(overrides={})=>({id:'cta:commission',employeeId:'employee',type:'comision',sourceRefs:{ctaKey:'commission',gastoKey:'expense'},amount:81.23,paidAmount:81.23,status:'pagado',visible:true,approvedTs:stamp('2026-10-24'),createdTs:stamp('2026-10-01'),grantDate:'2026-10-01',periodoComputo:'',description:'Comisión ficticia',...overrides});
const pair=()=>[record(),record({id:'gasto:commission',periodoComputo:'2026-10',approvedTs:stamp('2026-10-24')+500})];
const build=records=>Model.build({employeeId:'employee',records,now:'2026-10-24',complete:true});
test('exact linked mirrors reconcile approval stamps 500ms apart on the same local calendar day without changing inputs',()=>{
 const input=pair(),before=structuredClone(input),result=build(input);assert.equal(result.status,'ready');assert.equal(result.issues.length,0);assert.equal(result.items.length,1);assert.equal(result.items[0].date,'2026-10-24');assert.equal(result.items[0].period,'2026-10');assert.equal(result.items[0].paidAmount,81.23);assert.deepEqual(build(input.toReversed()),result);assert.deepEqual(input,before);
});
test('500ms across local midnight remains an approval-date conflict',()=>{
 const input=pair();input[0].approvedTs=stamp('2026-10-23','23:59:59.750');input[1].approvedTs=stamp('2026-10-24','00:00:00.250');assert.equal(input[1].approvedTs-input[0].approvedTs,500);assert.equal(build(input).issues[0].code,'CONFLICTING_DATE');
});
test('approval still takes precedence over divergent creation and grant dates',()=>{const input=pair();input[1].createdTs=stamp('2025-01-01');input[1].grantDate='2025-01-01';assert.equal(build(input).status,'ready');});
test('without approval the creation-timestamp rule remains strict',()=>{const input=pair();input.forEach(x=>delete x.approvedTs);input[1].createdTs+=500;assert.equal(build(input).issues[0].code,'CONFLICTING_DATE');});
for(const [change,code] of [[{amount:81.24},'CONFLICTING_DETAIL'],[{paidAmount:81.22},'CONFLICTING_DETAIL'],[{status:'aprobado'},'CONFLICTING_STATE'],[{sourceRefs:{ctaKey:'commission',gastoKey:'other'}},'CONFLICTING_LINKS'],[{visible:false},'CONFLICTING_VISIBILITY'],[{amount:81.231},'INVALID_DETAIL']])test('same-day approval never hides '+code+' '+Object.keys(change)[0],()=>{const input=pair();Object.assign(input[1],change);const result=build(input);assert.equal(result.status,'incomplete');assert.equal(result.items.length,0);assert.equal(result.issues[0].code,code);});
test('valid approval from one mirror completes absent approval on the other',()=>{const input=pair();delete input[0].approvedTs;input[0].createdTs=stamp('2025-01-01');assert.equal(build(input).status,'ready');});
test('future approval does not become a recent event through creation fallback',()=>{const input=pair();input.forEach(x=>x.approvedTs=stamp('2026-10-25'));assert.deepEqual(build(input),{status:'ready',items:[],issues:[]});});
test('the 30-day window uses local days after reconciling approvals',()=>{const input=pair();input[0].approvedTs=stamp('2026-09-25','00:00:00.000');input[1].approvedTs=input[0].approvedTs+500;assert.equal(build(input).items.length,1);input[0].approvedTs=stamp('2026-09-24','23:59:59.000');input[1].approvedTs=input[0].approvedTs+500;assert.equal(build(input).items.length,0);});
