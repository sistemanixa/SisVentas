(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetNoticeModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const check=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'SV_BUDGET_NOTICES_INCOMPLETE',statusCode:409});};
const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const sort=id=>'k_'+Array.from({length:id.length},(_,i)=>id.charCodeAt(i).toString(16).padStart(4,'0')).join('');
const fields=['key','sourceHash','ownerUid','number','client','status','date','ts','employeeLabel','dueRaw','dueDay','sentDay','admits','approvalStamp','approvedBy','reason','amount'];
function project(row,recordKey,actor){
 check(object(row),'Invalid notice candidate');
 row={ts:null,dueDay:null,sentDay:null,amount:null,...row};
 check(object(row)&&Object.keys(row).length===fields.length&&fields.every(f=>Object.hasOwn(row,f))&&key(row.key)&&sort(row.key)===recordKey&&row.admits===true,'Invalid notice candidate');
 check(typeof row.ownerUid==='string'&&(actor.role==='admin'||row.ownerUid===actor.uid),'Notice candidate outside scope');
 for(const [field,max]of [['number',128],['client',200],['status',80],['date',80],['employeeLabel',160],['dueRaw',80],['approvalStamp',80],['approvedBy',160],['reason',500]])check(typeof row[field]==='string'&&row[field].length<=max,'Invalid notice text');
 check(/^[a-f0-9]{64}$/.test(row.sourceHash)&&[row.dueDay,row.sentDay].every(v=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))&&(row.ts===null||['string','number'].includes(typeof row.ts))&&(row.amount===null||typeof row.amount==='number'&&Number.isFinite(row.amount)),'Invalid notice evidence');
 // Original row hashes and private fields are not transported to the browser.
 return Object.fromEntries(fields.filter(f=>f!=='sourceHash').map(f=>[f,structuredClone(row[f])]));
}
return Object.freeze({project,sort});
});
