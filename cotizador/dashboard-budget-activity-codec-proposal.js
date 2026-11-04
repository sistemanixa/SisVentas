'use strict';
const Core=require('./commercial-models/dashboard-activity-model.v2'),Instant=require('./commercial-models/dashboard-activity-instant.v1'),Model=require('./dashboard-budget-projection-proposal'),{digest}=require('./labor-guard');
const fail=message=>Object.assign(Error(message),{code:'SV_BUDGET_ACTIVITY_RECONCILE',statusCode:409});
function check(value,message){if(!value)throw fail(message);}
function canonicalZone(timeZone){try{return Instant.canonicalZone(timeZone);}catch(_){throw fail('Activity timezone is invalid');}}
const sortInputs=original=>digest({fecha:original.fecha??null,ts:original.ts??null});
function point({key,original,ownerUid,offsetMinutes,timeZone}={}){
 canonicalZone(timeZone);const row=Model.projectRecord({key,original,ownerUid,offsetMinutes}),ms=Core.legacyMs(original.fecha,original.ts,timeZone);
 check(!ms||Number.isFinite(ms),'Truthy nonfinite legacy instant cannot be certified');
 return {schema:3,order:Core.SOURCE_ORDER,sourceHash:row.sourceHash,sortInputs:sortInputs(original),ms:Number.isNaN(ms)?null:ms,included:!!ms};
}
function eventRow(record){const row=record.row,event=record.activity;check(event?.schema===3&&event.order===Core.SOURCE_ORDER&&!Object.hasOwn(event,'ranks')&&event.sourceHash===record.sourceHash&&typeof event.included==='boolean','Activity stable-key point evidence missing');check(event.included===!!event.ms&&Number.isFinite(event.ms),'Activity instant evidence invalid');if(!event.included)return null;return {key:row.key,date:row.date,ms:event.ms,sort:Core.eventSort(event.ms,row.key),number:row.number,client:row.client,status:row.status,ownerUid:row.ownerUid,amountCents:null};}
module.exports={SCHEMA:3,ORDER:Core.SOURCE_ORDER,canonicalZone,sortInputs,point,eventRow,check};
