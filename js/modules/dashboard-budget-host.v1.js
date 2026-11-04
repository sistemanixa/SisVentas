(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetHost=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Lazy wiring only. Root owns rendering, rollout and all real session/readiness epochs.
function create(r,{enabled=()=>r.SV_DASHBOARD_READS_LOCAL===true,noticesEnabled=()=>r.SV_BUDGET_NOTICES_LOCAL===true,changed=()=>{},context,fetchImpl,allowLoopback=false,events=true}={}){
 if(!r||typeof enabled!=='function'||typeof noticesEnabled!=='function'||typeof changed!=='function')throw TypeError('Missing dashboard budget host ports');
 const kinds=['dashboard','notices'],slots=['_svDashboardBudgetSource','_svBudgetNoticeConsumerHost','_svBudgetNoticeDetailHost'],demanded=new Set(),listeners=[];
 let ctx=null,ownsContext=false,readiness=null,source=null,consumer=null,detail=null,pin=null,marker='',disposed=false,queued=false,retiring=false;
 const retired=()=>Object.assign(Error('Dashboard budget host retired'),{code:'SV_BUDGET_SOURCE_RETIRED'});
 function claimed(kind='dashboard'){return !disposed&&kinds.includes(kind)&&enabled()===true&&(kind!=='notices'||noticesEnabled()===true);}
 function basic(){const u=r.fbAuth?.currentUser,c=r.PERMISOS_ROLES?.[r.currentRole];return r.isAuthenticated===true&&u&&u.uid===r.currentUserUid&&r.fbDB&&!r._impersonacionOriginal&&c?.indiceVersion===2&&Number.isSafeInteger(c.indiceRevision)&&r.permisoModulo?.('dashboard')===true&&r.permisoModulo?.('presupuesto')===true&&typeof r.SVDataReadiness?.snapshotEpoch==='function';}
 function getContext(){
  const supplied=typeof context==='function'?context():context||r._svDashboardHostContext;
  if(supplied){if(ctx&&ownsContext&&ctx!==supplied)ctx.dispose?.();ctx=supplied;ownsContext=false;}
  else if(!ctx||ownsContext&&readiness&&readiness!==r.SVDataReadiness){if(ownsContext)ctx?.dispose?.();const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Buenos_Aires'}).resolvedOptions().timeZone;ctx=r.SVDashboardHostContext.create(r,{timeZone:zone,sourceLocale:'es-AR'});ownsContext=true;}
  if(typeof ctx?.capture!=='function'||typeof ctx?.valid!=='function'||typeof ctx?.decision!=='function')throw retired();
  return ctx;
 }
 function capture(){return ctx.capture.call(ctx);}
 function valid(c){return claimed()&&ctx?.valid.call(ctx,c)===true;}
 function current(c){const now=capture();return valid(c)&&c.connected===true&&now.connected===true&&c.connectionEpoch===now.connectionEpoch&&c.auth?.currentUser===now.auth?.currentUser;}
 function notify(kind,view){try{changed(kind,view);}catch(_){/* Root rendering cannot change a verified Source result. */}}
 function unpublish(){for(const [i,value]of [source,consumer,detail].entries())if(r[slots[i]]===value)delete r[slots[i]];}
 function retire(clearDemand=false){if(retiring)return;retiring=true;const old=[source,consumer,detail];unpublish();source=consumer=detail=null;pin=null;if(clearDemand)demanded.clear();try{old[0]?.invalidate();old[1]?.reset();old[2]?.dispose();}finally{retiring=false;}}
 function prepare(kind){
  if(retiring||!claimed(kind)||!basic())throw retired();getContext();const c=capture();if(c.allowed!==true||!valid(c)||c.grants?.presupuestos!==(c.role==='admin'?'all':'own'))throw retired();
  if(source&&readiness!==r.SVDataReadiness)retire();
  if(pin&&!ctx.valid.call(ctx,pin)){const principalChanged=pin.uid!==c.uid||pin.user!==c.user;retire(principalChanged);}
  if(!source){
   if(slots.some(s=>r[s]))throw Error('Dashboard budget host slots already owned');
   for(const name of ['SVDashboardBudgetSource','SVDashboardBudgetNoticeConsumer','SVDashboardBudgetNoticeDetail'])if(typeof r[name]?.create!=='function')throw Error('Missing '+name);
   readiness=r.SVDataReadiness;
   source=r.SVDashboardBudgetSource.create({capture,valid,read:readConsumer,readiness,changed:notify});
   consumer=r.SVDashboardBudgetNoticeConsumer.create({capture,valid,source,enabled:()=>claimed('notices')});
   detail=r.SVDashboardBudgetNoticeDetail.create(r,{capture,valid,enabled:()=>claimed('notices')});
   pin=c;marker=JSON.stringify([String(r.document?.querySelector?.('.page.active')?.id||''),c.foreground,c.connected,c.connectionEpoch]);r[slots[0]]=source;r[slots[1]]=consumer;r[slots[2]]=detail;
  }
  return c;
 }
 async function readConsumer(kind){
  const c=capture();if(!claimed(kind)||!current(c)||!c.foreground)throw retired();
  const decision=ctx.decision.call(ctx),fetcher=fetchImpl||r.fetch?.bind(r);
  if(decision.kind==='authorized-server'){
   const http=r.SVDashboardHTTPPortsProposal.create({enabled:true,host:r,baseURL:r.SISVENTAS_FUNCTIONS?.cotizadorProveedor,capture,valid,fetchImpl:fetcher,allowLoopback});
   const result=await http.read(kind);if(kind==='dashboard'&&r.tienePermiso?.('dashboard.miActividad')===true&&!result.monthly)throw Error('Missing authorized monthly contribution');return result;
  }
  if(decision.kind!=='direct-rtdb')throw Object.assign(Error('Current dashboard access denied'),{statusCode:403});
  const databaseURL=c.db.app?.options?.databaseURL;if(typeof databaseURL!=='string')throw Error('Missing trusted Firebase database URL');
  const expectedOrigin=new URL(databaseURL).origin,fresh=r.SVDashboardBudgetFreshRTDB.create({databaseURL,expectedOrigin,allowLoopback,auth:c.auth,fetchImpl:fetcher});let header;
  const readFresh=async spec=>{const result=await fresh(spec);if(spec.path===r.SVDashboardBudgetSDKProposal.ROOT+'/read/'+c.uid)header=result.val();return result;};
  const sdk=r.SVDashboardBudgetSDKProposal.create({readFresh,capture,valid,getAsOfDay:()=>capture().asOfDay});
  if(kind==='notices')return sdk.notices();
  const result=await sdk.read();
  if(r.tienePermiso?.('dashboard.miActividad')===true){
   const monthFresh=r.SVDashboardBudgetMonthPortProposal.createFresh({databaseURL,expectedOrigin,allowLoopback,auth:c.auth,capture,valid,fetchImpl:fetcher});
   const month=r.SVDashboardBudgetMonthPortProposal.create({enabled:true,readFresh:monthFresh,capture,valid});
   const envelope=await month.read({schema:1,context:r.SVDashboardActivityAggregateProposal.snapshot(c)}),m=envelope.value;
   if(!current(c)||r.tienePermiso?.('dashboard.miActividad')!==true)throw retired();
   if(m.uid!==result.uid||m.role!==result.role||m.permissionRevision!==result.permissionRevision||m.generation!==result.generation||m.revision!==result.revision||m.policyHash!==header?.policyHash)throw Error('Monthly contribution changed across dashboard read');
   return {...result,monthly:m};
  }
  if(!current(c))throw retired();return result;
 }
 function load(kind,explicit){
  if(!kinds.includes(kind))return Promise.reject(Error('Invalid budget consumer'));
  try{const c=prepare(kind);if(!c.connected||!c.foreground)throw retired();demanded.add(kind);return source[explicit?'refresh':'ensure'](kind);}catch(error){if(pin&&!valid(pin))retire(true);return Promise.reject(error);}
 }
 function queueRefresh(){if(queued||!source||!demanded.size)return;const scheduled=source;queued=true;Promise.resolve().then(()=>{queued=false;if(source!==scheduled||disposed||!basic()||!claimed())return;const c=capture();marker=JSON.stringify([String(r.document?.querySelector?.('.page.active')?.id||''),c.foreground,c.connected,c.connectionEpoch]);if(!c.connected||!c.foreground)return;for(const kind of [...demanded])if(claimed(kind))load(kind,true).catch(()=>{});});}
 function event(name){
  if(disposed||!claimed())return;
  if(name==='sisventas:session-ended'){retire(true);return;}
  if(!source)return;
  if(!basic()){retire(true);return;}
  const c=capture();if(pin&&!ctx.valid.call(ctx,pin)){const demand=[...demanded],sameUser=pin.uid===c.uid&&pin.user===c.user;retire(!sameUser);if(sameUser)for(const k of demand)demanded.add(k);if(demanded.size)try{prepare(demanded.has('dashboard')?'dashboard':'notices');}catch(_){return;}queueRefresh();return;}
  if(name==='sisventas:data-state-changed')return; // Source begin/ready is not a new database epoch.
  const route=String(r.document?.querySelector?.('.page.active')?.id||''),next=JSON.stringify([route,c.foreground,c.connected,c.connectionEpoch]);
  if(!['sisventas:budget-write','sisventas:permissions-changed'].includes(name)&&next===marker)return;marker=next;queueRefresh();
 }
 if(events){for(const name of ['sisventas:session-ready','sisventas:session-ended','sisventas:session-changed','sisventas:role-changed','sisventas:permissions-changed','sisventas:data-state-changed','sisventas:page-changed','visibilitychange','sisventas:budget-write']){const fn=()=>event(name);r.document?.addEventListener?.(name,fn);listeners.push([r.document,name,fn]);}for(const name of ['online','offline','sisventas:connection-lost','sisventas:connection-restored']){const fn=()=>event(name);r.addEventListener?.(name,fn);listeners.push([r,name,fn]);}}
 return Object.freeze({claimed,ensure:(kind='dashboard')=>load(kind,false),refresh:(kind='dashboard')=>load(kind,true),invalidate(){retire(true);},dispose(){if(disposed)return;retire(true);disposed=true;for(const [target,name,fn]of listeners)target?.removeEventListener?.(name,fn);if(ownsContext)ctx?.dispose?.();ctx=null;}});
}
return Object.freeze({create});
});
