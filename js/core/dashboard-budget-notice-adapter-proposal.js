(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports?require('./dashboard-budget-notice-legacy-proposal'):root.SVBudgetNoticeLegacyProposal);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVBudgetNoticeAdapterProposal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Legacy){
 'use strict';
 // Inactive proposal: no reads, writes, clock, fallback or global list assignment.
 const fail=message=>Object.assign(Error(message),{code:'SV_BUDGET_NOTICE_SNAPSHOT'});
 const check=(ok,message)=>{if(!ok)throw fail(message);};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 const textFields={number:128,client:200,status:80,date:80,employeeLabel:160,dueRaw:80,approvalStamp:80,approvedBy:160,reason:500};
 const fields=['key','ownerUid',...Object.keys(textFields),'ts','dueDay','sentDay','admits','amount','noticeLegacy'];
 function calendar(v){
  if(v===null)return true;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const date=new Date(v+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;
 }
 function pin(c){
  check(object(c)&&key(c.uid)&&['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(c.role)&&Number.isSafeInteger(c.permissionRevision)&&c.permissionRevision>=0&&Number.isSafeInteger(c.sessionEpoch)&&c.sessionEpoch>=0&&c.auth?.currentUser?.uid===c.uid&&c.db&&c.connected===true&&Number.isSafeInteger(c.connectionEpoch)&&c.connectionEpoch>=0,'Invalid notice session');
  return Object.freeze({uid:c.uid,role:c.role,permissionRevision:c.permissionRevision,sessionEpoch:c.sessionEpoch,auth:c.auth,user:c.auth.currentUser,db:c.db,connectionEpoch:c.connectionEpoch,timeZone:c.timeZone,sourceLocale:c.sourceLocale,...Object.fromEntries(['ventas','pagos','ordenes_trabajo','presupuestos'].map(d=>[d+'Grant',c.grants?.[d]]))});
 }
 function row(r,scope,uid){
  check(object(r)&&Object.keys(r).length===fields.length&&fields.every(f=>Object.hasOwn(r,f))&&key(r.key)&&typeof r.ownerUid==='string'&&(scope==='all'||r.ownerUid===uid)&&r.admits===true,'Invalid notice scope or fields');
  check(Object.entries(textFields).every(([field,max])=>typeof r[field]==='string'&&r[field].length<=max)&&calendar(r.dueDay)&&calendar(r.sentDay)&&(r.ts===null||typeof r.ts==='string'||typeof r.ts==='number'&&Number.isFinite(r.ts))&&(r.amount===null||typeof r.amount==='number'&&Number.isFinite(r.amount)),'Invalid notice values');
  // Preserve raw expiry for the UI's independent historical parser and lexical badge.
  // amount already carries parseFloat semantics; never round or calculate an amount.
  const restored=Legacy.restore(r.noticeLegacy);if(restored.audit){restored.audit.forEach(Object.freeze);Object.freeze(restored.audit);}
  return Object.freeze({fbKey:r.key,cliente:r.client,estado:r.status,fecha:r.date,ts:r.ts,empleado:r.employeeLabel,responsableUid:r.ownerUid,vence:r.dueRaw,aprobadoEn:r.approvalStamp,aprobadoPor:r.approvedBy,motivo:r.reason,total:r.amount,...restored});
 }
 function order(a,b){
  const number=r=>parseInt((String(r.number||'').match(/^PP-(\d{4})$/i)||[])[1],10)||0,na=number(a),nb=number(b);if(na&&nb&&na!==nb)return nb-na;
  const ta=parseInt(a.ts,10)||0,tb=parseInt(b.ts,10)||0;if(ta!==tb)return tb-ta;
  return b.date.split('/').reverse().join('-').localeCompare(a.date.split('/').reverse().join('-'));
 }
 function adapt(envelope,context,{expectedGeneration,expectedRevision}={}){
  const c=pin(context);
  // Both existing server schema1 and fresh direct schema2 keep their wire format.
  if(envelope?.schema===2){check(object(envelope.notices),'Missing notice consumer');envelope={schema:1,uid:envelope.uid,role:envelope.role,permissionRevision:envelope.permissionRevision,scope:envelope.scope,generation:envelope.generation,revision:envelope.revision,complete:envelope.notices.complete,rows:envelope.notices.rows};}
  check(object(envelope)&&envelope.schema===1&&envelope.complete===true&&Array.isArray(envelope.rows)&&envelope.uid===c.uid&&envelope.role===c.role&&envelope.permissionRevision===c.permissionRevision&&envelope.scope===(c.role==='admin'?'all':'own')&&key(envelope.generation)&&Number.isSafeInteger(envelope.revision)&&envelope.revision>=1,'Incomplete or foreign notice snapshot');
  check((expectedGeneration===undefined||expectedGeneration===envelope.generation)&&(expectedRevision===undefined||expectedRevision===envelope.revision),'Retired notice generation or revision');
  const validated=envelope.rows.map(r=>({candidate:r,value:row(r,envelope.scope,c.uid)}));check(new Set(validated.map(r=>r.value.fbKey)).size===validated.length,'Duplicate notice candidate');validated.sort((a,b)=>order(a.candidate,b.candidate));
  return Object.freeze({schema:1,kind:'budget-notice-candidates',domain:'presupuestos',context:c,scope:envelope.scope,generation:envelope.generation,revision:envelope.revision,complete:true,completeForBudgetList:false,completeForLegacyNotices:true,rows:Object.freeze(validated.map(r=>r.value))});
 }
 function rowsFor(snapshot,context){
  const c=pin(context),p=snapshot?.context;
  check(snapshot?.kind==='budget-notice-candidates'&&snapshot.complete===true&&p&&Object.keys(c).every(k=>c[k]===p[k]),'Retired notice snapshot');
  check(snapshot.completeForLegacyNotices===true,'Legacy notice codec is not certified');
  // Expiry marking mutates _alertado48h in the legacy consumer, not the snapshot.
  return snapshot.rows.map(r=>({...r,...(r.audit?{audit:r.audit.map(e=>({...e}))}:{})}));
 }
 return Object.freeze({adapt,rowsFor});
});
