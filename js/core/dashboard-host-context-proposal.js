(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./domain-read-policy'):root.SVDomainReads,typeof module==='object'&&module.exports?require('./dashboard-budget-transport-plan-proposal'):root.SVDashboardBudgetTransportPlan);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardHostContext=api;})(typeof globalThis==='object'?globalThis:this,function(Policy,Transport){
'use strict';
const domains=['ventas','pagos','ordenes_trabajo','presupuestos'];
const fields=['uid','role','auth','user','db','permissionRevision','permissionSignature','sessionEpoch','dataEpoch','timeZone','sourceLocale','month','asOfDay','employeeLabel'];
function create(r,{timeZone='America/Argentina/Buenos_Aires',sourceLocale='es-AR',now=()=>new Date()}={}){
 if(!r||typeof now!=='function'||typeof r.SVDataReadiness?.snapshotEpoch!=='function')throw Error('Falta la generación real de lectura');
 const readiness=r.SVDataReadiness,calendar=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),listeners=[];let connectionEpoch=0,disposed=false;
 for(const name of ['offline','online','sisventas:connection-lost','sisventas:connection-restored']){const handler=()=>{connectionEpoch++;};r.addEventListener?.(name,handler);listeners.push([name,handler]);}
 function capture(){
  const role=String(r.currentRole||''),uid=r.currentUserUid,auth=r.fbAuth,user=auth?.currentUser,db=r.fbDB,config=r.PERMISOS_ROLES?.[role];
  const parts=Object.fromEntries(calendar.formatToParts(now()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value])),asOfDay=parts.year+'-'+parts.month+'-'+parts.day;
  const moduleAllowed=m=>r.permisoModulo?.(m)===true,actionAllowed=a=>r.tienePermiso?.(a)===true;
  const viewing=!!r._impersonacionOriginal,allowed=!disposed&&r.SVDataReadiness===readiness&&r.isAuthenticated===true&&!!uid&&user?.uid===uid&&!!db&&!viewing&&Policy.internalRoles.includes(role)&&moduleAllowed('dashboard')&&config?.indiceVersion===2&&Number.isSafeInteger(config.indiceRevision)&&config.indiceRevision>=0;
  const grants=Object.freeze(Object.fromEntries(domains.map(d=>[d,allowed&&Policy.allows(d,role,moduleAllowed,actionAllowed)?(d==='ordenes_trabajo'||role==='admin'?'all':'own'):null])));
  const raw=r._svDashboardRawBlockedPresence?.[role],rawBlockedExists=raw&&raw.revision===config?.indiceRevision?raw.present:true;
  return {allowed,viewing,uid,role,auth,user,db,permissionRevision:config?.indiceRevision,permissionSignature:JSON.stringify(config||null),sessionEpoch:r._svOperacionesSesionEpoch??0,dataEpoch:r.SVDataReadiness.snapshotEpoch(),timeZone,sourceLocale,asOfDay,month:asOfDay.slice(0,7),employeeLabel:String(r.currentUser||''),grants,connectionEpoch,connected:r.navigator?.onLine!==false&&r.fbOnline===true&&r.SVConnectionMonitor?.canSync?.()!==false,foreground:r.document?.hidden!==true&&r.SVForegroundSession?.isVisible?.()!==false,rawBlockedExists};
 }
 function valid(c){try{const current=capture();return !!c&&current.allowed&&fields.every(k=>c[k]===current[k])&&domains.every(d=>c.grants?.[d]===current.grants[d]);}catch(_){return false;}}
 function decision(){const c=capture();if(!c.allowed)return {kind:'denied',reason:'current-session'};return Transport.plan({role:c.role,config:r.PERMISOS_ROLES?.[c.role],rawBlockedExists:c.rawBlockedExists});}
 return Object.freeze({capture,valid,decision,dispose(){disposed=true;for(const [name,handler]of listeners)r.removeEventListener?.(name,handler);}});
}
return Object.freeze({create});
});
