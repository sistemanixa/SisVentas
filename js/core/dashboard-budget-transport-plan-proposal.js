(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./domain-read-policy'):root.SVDomainReads);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetTransportPlan=api;})(typeof globalThis==='object'?globalThis:this,function(Policy){
'use strict';
function prunedJSON(value,seen=new Set(),depth=0){
 if(value===null)return true;
 if(!value||typeof value!=='object'||depth>32||!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value))||seen.has(value))return false;
 seen.add(value);try{return Object.keys(value).every(k=>k.length>0&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(k)&&prunedJSON(value[k],seen,depth+1));}catch(_){return false;}finally{seen.delete(value);}
}
function plan({role,config,rawBlockedExists}={}){
 const denied={kind:'denied',reason:'current-permissions'};
 if(!Policy?.internalRoles.includes(role)||!config||config.indiceVersion!==2||!Number.isSafeInteger(config.indiceRevision)||config.indiceRevision<0)return denied;
 const blocked=Object.values(config.bloqueados||{}),allowed=m=>config.indiceModulos?.[m]===true&&!blocked.includes(m);
 if(!allowed('dashboard')||!allowed('presupuesto'))return denied;
 const present=Object.hasOwn(config,'bloqueados'),pruned=present&&prunedJSON(config.bloqueados),knownAbsent=rawBlockedExists===false&&(!present||pruned)||rawBlockedExists===undefined&&!present;
 return knownAbsent?{kind:'direct-rtdb',reason:'certified-absent-raw-block-field',permissionRevision:config.indiceRevision}:{kind:'authorized-server',reason:'legacy-or-unverified-normalized-block-field',permissionRevision:config.indiceRevision};
}
function read({decision,direct,authorized}={}){
 if(decision?.kind==='direct-rtdb'&&typeof direct==='function')return direct();
 if(decision?.kind==='authorized-server'&&typeof authorized==='function')return authorized();
 throw Object.assign(Error('Current budget access denied'),{code:'SV_BUDGET_PLAN_DENIED'});
}
return Object.freeze({plan,read});
});
