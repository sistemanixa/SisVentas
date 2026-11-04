(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetSource=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const kinds=['dashboard','notices'],keys={dashboard:'dashboardBudgets',notices:'dashboardBudgetNotices'};
const cancelled=()=>Object.assign(Error('Budget source retired'),{name:'AbortError',code:'SV_BUDGET_SOURCE_RETIRED'});
const fields=['uid','role','permissionRevision','permissionSignature','sessionEpoch','auth','db','timeZone','sourceLocale'];
function create({capture,valid,read,readiness,changed=()=>{}}={}){
 if(typeof capture!=='function'||typeof valid!=='function'||typeof read!=='function'||typeof changed!=='function'||typeof readiness?.beginSource!=='function'||typeof readiness?.invalidate!=='function')throw Error('Missing budget source host contract');
 const entries=new Map();let sequence=0,blocked=null;
 function scope(){try{const c=capture(),user=c?.auth?.currentUser;if(!c||c.allowed!==true||c.viewing||!user||typeof c.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(c.uid)||user.uid!==c.uid||typeof c.role!=='string'||!c.role||typeof c.permissionSignature!=='string'||!Number.isSafeInteger(c.permissionRevision)||c.permissionRevision<0||!Number.isSafeInteger(c.sessionEpoch)||c.sessionEpoch<0||!c.db||!valid(c))return null;return Object.freeze({...Object.fromEntries(fields.map(f=>[f,c[f]])),user});}catch(_){return null;}}
 function same(a,b){return !!a&&!!b&&fields.every(f=>a[f]===b[f])&&a.user===b.user;}
 function live(entry){return entries.get(entry.kind)===entry&&same(entry.scope,scope());}
 function view(entry){return entry?Object.freeze({status:entry.status,data:entry.data,error:entry.error,revalidating:entry.status==='loading'&&entry.data!==null,sequence:entry.sequence}):Object.freeze({status:'idle',data:null,error:null,revalidating:false,sequence:0});}
 function notify(entry){try{changed(entry.kind,view(entry));}catch(_){/* A renderer cannot start another read or alter source readiness. */}}
 function finish(pending,error,value){if(!pending.active)return;pending.active=false;if(error)pending.reject(error);else pending.resolve(value);}
 function retire(kind){const entry=entries.get(kind);if(!entry)return;entries.delete(kind);entry.source?.cancel();if(entry.pending)finish(entry.pending,cancelled());entry.data=null;entry.error=null;entry.status='idle';readiness.invalidate(keys[kind]);notify(entry);}
 function invalidate(){for(const kind of kinds)retire(kind);}
 function peek(kind='dashboard'){if(!kinds.includes(kind))throw Error('Invalid budget consumer');const entry=entries.get(kind);if(entry&&!live(entry)){invalidate();return view(null);}if(blocked&&same(blocked.scope,scope()))return view({status:'error',data:null,error:blocked.error,sequence:0});return view(entry);}
 function load(kind='dashboard',explicit=false){
  if(!kinds.includes(kind))return Promise.reject(Error('Invalid budget consumer'));
  const captured=scope();if(!captured){invalidate();return Promise.reject(cancelled());}
  if(blocked&&same(blocked.scope,captured)&&!explicit)return Promise.reject(blocked.error);blocked=null;
  let entry=entries.get(kind);if(entry&&!same(entry.scope,captured)){invalidate();entry=null;}
  if(entry?.pending?.active)return entry.pending.promise;
  if(entry&&!explicit){if(entry.error)return Promise.reject(entry.error);if(entry.status==='ready')return Promise.resolve(entry.data);}
  if(!entry){entry={kind,scope:captured,data:null,error:null,pending:null,source:null,status:'idle',sequence:++sequence};entries.set(kind,entry);}
  // Cancel only the previous readiness handle; preserve valid visible data while revalidating.
  entry.source?.cancel();entry.source=readiness.beginSource(keys[kind],'verified-budget-'+kind);entry.error=null;entry.status='loading';
  const pending={active:true,promise:null,resolve:null,reject:null};pending.promise=new Promise((resolve,reject)=>{pending.resolve=resolve;pending.reject=reject;});entry.pending=pending;notify(entry);
  Promise.resolve().then(()=>{if(!pending.active||!live(entry))throw cancelled();return read(kind);}).then(value=>{
   if(!pending.active)return;if(!live(entry)){invalidate();return;}
   if(!value||value.uid!==entry.scope.uid||value.role!==entry.scope.role||value.permissionRevision!==entry.scope.permissionRevision||typeof value.generation!=='string'||!value.generation||!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('Unverified budget result');
   if(kind==='notices'?(value.notices?.complete!==true||!Array.isArray(value.notices.rows)):(!value.counts||!['active','converted','totalNonCancelled'].every(f=>Number.isSafeInteger(value.counts[f])&&value.counts[f]>=0)||value.counts.active+value.counts.converted>value.counts.totalNonCancelled||!Number.isSafeInteger(value.counts.conversionPercent)||value.counts.conversionPercent<0||value.counts.conversionPercent>100))throw Error('Unverified budget consumer payload');
   entry.data=value;entry.error=null;entry.status='ready';entry.source.ready();if(!live(entry)){invalidate();return;}entry.pending=null;notify(entry);if(!live(entry)){invalidate();finish(pending,cancelled());return;}finish(pending,null,value);
  }).catch(error=>{
   if(!pending.active)return;if(!live(entry)){invalidate();return;}
   entry.pending=null;
   if([401,403].includes(error?.statusCode)||['SV_BUDGET_SDK_RETIRED','SV_BUDGET_SOURCE_RETIRED'].includes(error?.code)){blocked={scope:entry.scope,error};invalidate();finish(pending,error);return;}
   entry.error=error;entry.status='error';entry.source.error('No se pudo actualizar la información de presupuestos.');notify(entry);finish(pending,error);
  });
  return pending.promise;
 }
 return Object.freeze({ensure:kind=>load(kind,false),refresh:kind=>load(kind,true),peek,invalidate});
}
return Object.freeze({create,keys});
});
