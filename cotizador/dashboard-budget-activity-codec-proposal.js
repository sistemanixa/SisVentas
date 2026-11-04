'use strict';
const Core=require('../js/core/dashboard-activity-model.v2'),Model=require('./dashboard-budget-projection-proposal'),{digest}=require('./labor-guard');
const fail=message=>Object.assign(Error(message),{code:'SV_BUDGET_ACTIVITY_RECONCILE',statusCode:409});
function check(value,message){if(!value)throw fail(message);}
function canonicalZone(timeZone){try{return new Intl.DateTimeFormat('en',{timeZone}).resolvedOptions().timeZone;}catch(_){throw fail('Activity timezone is invalid');}}
function assertRuntimeZone(timeZone){const expected=canonicalZone(timeZone);check(canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone)===expected,'Runtime timezone differs from the certified legacy browser timezone');return expected;}
const sortInputs=original=>digest({id:original.id??null,numero:original.numero??null,fecha:original.fecha??null,ts:original.ts??null});
function sourceOrder(rows,{maxPairChecks=100000,sourceLocale=Intl.Collator().resolvedOptions().locale}={}){
 check(rows.every(({original})=>!original.fecha||typeof original.fecha==='string'),'Source date is not comparable by the legacy loader');
 const number=r=>parseInt((String(r.original.id||r.original.numero||'').match(/^PP-(\d{4})$/i)||[])[1],10)||0;
 const mixed=rows.some(r=>number(r))&&rows.some(r=>!number(r));
 const sorted=rows.slice().sort((a,b)=>Core.budgetCompare(a.original,b.original,sourceLocale));
 // A mixed legacy comparator can be cyclic. Certify a total preorder before publishing ranks.
 if(mixed){
  check(rows.length*(rows.length-1)/2<=maxPairChecks,'Mixed legacy source order exceeds offline comparison budget');
  const sign=(a,b)=>Math.sign(Core.budgetCompare(a.original,b.original))||0,groups=[0];
  for(let i=1;i<sorted.length;i++)groups[i]=groups[i-1]+Number(sign(sorted[i-1],sorted[i])!==0);
  for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){const expected=groups[i]===groups[j]?0:-1;check(sign(sorted[i],sorted[j])===expected&&sign(sorted[j],sorted[i])===-expected,'Mixed legacy source order is inconsistent');}
 }
 return sorted;
}
function point({key,original,ownerUid,offsetMinutes,timeZone}={}){
 assertRuntimeZone(timeZone);const row=Model.projectRecord({key,original,ownerUid,offsetMinutes}),ms=Core.legacyMs(original.fecha,original.ts);
 check(!ms||Number.isFinite(ms),'Truthy nonfinite legacy instant cannot be certified');
 return {schema:2,sourceHash:row.sourceHash,sortInputs:sortInputs(original),ms:Number.isNaN(ms)?null:ms,included:!!ms,ranks:{}};
}
function eventRow(record,scope){const row=record.row,event=record.activity,ordinal=event?.ranks?.[scope];check(event?.schema===2&&event.sourceHash===record.sourceHash&&typeof event.included==='boolean','Activity point evidence missing');if(!event.included)return null;check(Number.isFinite(event.ms)&&event.ms!==0&&Number.isSafeInteger(ordinal)&&ordinal>=0,'Activity source ordinal missing');return {key:row.key,date:row.date,ms:event.ms,sourceOrdinal:ordinal,sort:Core.eventSort(event.ms,ordinal),number:row.number,client:row.client,status:row.status,ownerUid:row.ownerUid,amountCents:null};}
module.exports={ORDER:Core.SOURCE_ORDER,canonicalZone,assertRuntimeZone,sortInputs,sourceOrder,point,eventRow,check};
