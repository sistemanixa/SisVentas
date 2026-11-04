(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVBudgetNoticeLegacyProposal=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const fail=message=>Object.assign(Error(message),{code:'SV_BUDGET_NOTICE_LEGACY_RECONCILE',statusCode:409});
 const check=(ok,message)=>{if(!ok)throw fail(message);};
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 // Both actual string parsers inspect at most dd/mm/yyyy or yyyy-mm-dd.
 // Trim before bounding so arbitrary leading whitespace cannot hide the prefix.
 const prefix=v=>typeof v==='number'?v:String(v||'').trim().slice(0,32);
 function validate(value){
  check(object(value),'Missing legacy notice evidence');const v={sentTs:null,...value};
  const fields=['schema','idPresent','sentTs','sentRaw','auditSentRaw',...(v.idPresent===true?['idValue']:[])];
  check(Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k))&&v.schema===1&&typeof v.idPresent==='boolean'&&(v.idPresent===false||typeof v.idValue==='string'&&v.idValue.length<=128)&&(v.sentTs===null||typeof v.sentTs==='number'&&Number.isFinite(v.sentTs)&&v.sentTs>0)&&['sentRaw','auditSentRaw'].every(k=>typeof v[k]==='string'&&v[k].length<=32||typeof v[k]==='number'&&Number.isFinite(v[k])),'Invalid legacy notice evidence');
  return Object.freeze({...v});
 }
 function capture(original){
  check(object(original),'An individual original is required');
  const idPresent=Object.hasOwn(original,'id'),raw=original.enviadoEn||original.fechaEnvio||'',audit=Array.isArray(original.audit)?original.audit.slice().reverse():[],event=audit.find(e=>/enviado al cliente/i.test(String(e?.accion||'')));
  const sentTs=typeof original.enviadoTs==='number'&&original.enviadoTs>0?original.enviadoTs:null;
  return validate({schema:1,idPresent,...(idPresent?{idValue:String(original.id)}:{}),sentTs,sentRaw:prefix(raw),auditSentRaw:prefix(event?.fecha)});
 }
 function restore(value){
  const v=validate(value);
  return {...(v.idPresent?{id:v.idValue}:{}),enviadoTs:v.sentTs,enviadoEn:v.sentRaw,...(v.auditSentRaw!==''?{audit:[{accion:'Enviado al cliente',fecha:v.auditSentRaw}]}:{})};
 }
 return Object.freeze({capture,validate,restore});
});
