(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardActivityHostFactory=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Root mounts an instance as SVDashboardActivityHost. Import/create/peek never read data.
function create(r,{enabled=()=>r.SV_DASHBOARD_READS_LOCAL===true,context,fetchImpl,allowLoopback=false,changed=()=>{},events=true}={}){
 if(!r||typeof enabled!=='function'||typeof changed!=='function')throw TypeError('Missing activity host ports');
 const key='dashboardActivity',domains=['ventas','pagos','ordenes_trabajo','presupuestos'],listeners=[];
 let ctx=null,owned=false,readiness=null,pin=null,pinMode=null,data=null,status='idle',error=null,pending=null,handle=null,blocked=false,demanded=false,disposed=false,queued=false,marker='';
 const retired=()=>Object.assign(Error('Dashboard activity context retired'),{code:'SV_ACTIVITY_CONTEXT_RETIRED'});
 const visible=()=>r.document?.querySelector?.('.page.active')?.id==='page-dashboard'&&r.document?.hidden!==true&&r.SVForegroundSession?.isVisible?.()!==false;
 const activityAllowed=()=>r.tienePermiso?.('dashboard.actividad')===true&&r.tienePermiso?.('interfaz.dashboard_admin_only')===true;
 function gate(){return !disposed&&enabled()===true&&r.isAuthenticated===true&&!!r.currentUserUid&&r.fbAuth?.currentUser?.uid===r.currentUserUid&&!!r.fbDB&&!r._impersonacionOriginal&&r.permisoModulo?.('dashboard')===true&&(activityAllowed()||r.tienePermiso?.('dashboard.miActividad')===true);}
 function mode(c){if(activityAllowed()&&domains.every(d=>['own','all'].includes(c.grants?.[d])))return 'activity';return r.tienePermiso?.('dashboard.miActividad')===true&&['own','all'].includes(c.grants?.ventas)?'ownMonthly':null;}
 const capture=()=>ctx.capture.call(ctx);
 function valid(c){return gate()&&r.SVDataReadiness===readiness&&ctx?.valid.call(ctx,c)===true&&mode(c)!==null&&(!pin||mode(c)===pinMode);}
 const view=()=>Object.freeze({status,authority:pin&&!blocked&&!disposed?'current':'retired',data,revalidating:status==='loading'&&data!==null});
 function notify(){try{changed(view());}catch(_){/* A consumer cannot change source state. */}}
 function finish(p,e,v){if(!p?.active)return;p.active=false;e?p.reject(e):p.resolve(v);}
 function retire(clearDemand=false){const p=pending;pending=null;handle?.cancel();if(pin||handle)readiness?.invalidate(key);handle=null;pin=null;pinMode=null;data=null;status='idle';error=null;blocked=false;if(clearDemand)demanded=false;finish(p,retired());notify();}
 function sync(){if(pin&&!valid(pin)){let same=false;try{const c=capture();same=c.uid===pin.uid&&c.user===pin.user;}catch(_){}retire(!same);}return !!pin;}
 function getContext(){
  const supplied=typeof context==='function'?context():context||r._svDashboardHostContext;
  if(supplied&&ctx!==supplied){if(pin)retire();if(owned)ctx?.dispose?.();ctx=supplied;owned=false;}
  if(!supplied&&(!ctx||owned&&readiness&&readiness!==r.SVDataReadiness)){if(pin)retire();if(owned)ctx?.dispose?.();ctx=r.SVDashboardHostContext.create(r,{timeZone:'America/Argentina/Buenos_Aires',sourceLocale:'es-AR'});owned=true;}
  if(typeof ctx?.capture!=='function'||typeof ctx?.valid!=='function'||typeof r.SVDataReadiness?.beginSource!=='function'||typeof r.SVDataReadiness?.snapshotEpoch!=='function')throw retired();
  readiness=r.SVDataReadiness;
 }
 function load(explicit=false){
  try{
   sync();if(!gate())throw retired();getContext();sync();const c=capture();if(c.allowed!==true||!valid(c))throw retired();
   if(pending)return pending.promise;
   if(pin&&!explicit){if(error)throw error;if(data)return Promise.resolve(data);}
   if(!visible()||!c.connected||c.foreground===false)throw retired();
   const selected=mode(c),Aggregate=r.SVDashboardActivityAggregateProposal,HTTP=r.SVDashboardHTTPPortsProposal;if(typeof Aggregate?.snapshot!=='function'||selected==='activity'&&typeof Aggregate?.create!=='function'||typeof HTTP?.create!=='function')throw Error('Missing verified activity ports');
   demanded=true;pinMode=selected;pin=c;blocked=false;marker=JSON.stringify([true,c.connected,c.connectionEpoch]);handle?.cancel();handle=readiness.beginSource(key,'verified-dashboard-activity');status='loading';error=null;
   const p={active:true,promise:null,resolve:null,reject:null};p.promise=new Promise((resolve,reject)=>{p.resolve=resolve;p.reject=reject;});pending=p;
   const live=q=>pending===p&&p.active&&valid(q),http=HTTP.create({enabled:true,host:r,baseURL:r.SISVENTAS_FUNCTIONS?.cotizadorProveedor,capture,valid:live,fetchImpl:fetchImpl||r.fetch?.bind(r),allowLoopback});
   async function read(){
    if(selected==='activity')return Aggregate.create({enabled:true,capture,valid:live,ports:http.ports,requireNotices:false}).read();
    const response=await http.ports.commercial.read({schema:1,context:Aggregate.snapshot(c),domain:'ventas'}),sales=response.value,m=sales.creatorMonthly,complete=m?.schema===1&&m.complete===true&&m.creator===c.employeeLabel&&m.month===c.month&&m.scope===(c.grants.ventas==='all'?'all':'u_'+c.uid)&&typeof m.generation==='string'&&m.generation&&Number.isSafeInteger(m.revision)&&m.revision>=1&&Number.isSafeInteger(m.count)&&m.count>=0;
    const latest=sales.creatorLatest,latestComplete=latest?.schema===1&&latest.complete===true&&latest.creator===c.employeeLabel&&latest.month===c.month&&latest.scope===(c.grants.ventas==='all'?'all':'u_'+c.uid)&&latest.locale===c.sourceLocale&&typeof latest.generation==='string'&&latest.generation&&Number.isSafeInteger(latest.revision)&&latest.revision>=1&&Number.isSafeInteger(latest.count)&&latest.count>=0&&Array.isArray(latest.rows)&&latest.rows.length===Math.min(5,latest.count);
    return {schema:1,mode:'ownMonthly',uid:c.uid,role:c.role,permissionRevision:c.permissionRevision,sessionEpoch:c.sessionEpoch,dataEpoch:c.dataEpoch,activity:null,monthly:null,counts:null,badge:null,notices:null,salesAuthorMonthly:complete?m:null,salesAuthorMonthlyComplete:!!complete,salesAuthorLatest:latestComplete?latest:null,salesAuthorLatestComplete:!!latestComplete,consumersComplete:false,budgetNoticesComplete:false,dashboardComplete:false,originalCollectionComplete:false,notificationCenterComplete:false};
   }
   notify();Promise.resolve().then(()=>{if(!live(c))throw retired();return read();}).then(value=>{
    if(!p.active)return;if(!live(c)){retire();return;}data=value;status='ready';error=null;handle.ready();pending=null;finish(p,null,value);notify();
   }).catch(e=>{
    if(!p.active)return;if(!valid(c)){retire();return;}pending=null;error=e;status='error';if([401,403].includes(e?.statusCode)){data=null;blocked=true;handle.cancel();readiness.invalidate(key);}else if(data)handle.ready();else handle.error('No se pudo actualizar la actividad.');finish(p,e);notify();
   });return p.promise;
  }catch(e){if(pending){const p=pending;pending=null;status='error';error=e;handle?.error('No se pudo actualizar la actividad.');finish(p,e);return p.promise;}return Promise.reject(e);}
 }
 function queue(){if(queued||!demanded||!visible()||!gate())return;queued=true;Promise.resolve().then(()=>{queued=false;if(!demanded||!visible()||!gate())return;try{const c=capture();marker=JSON.stringify([true,c.connected,c.connectionEpoch]);if(!c.connected||c.foreground===false)return;}catch(_){return;}load(true).catch(()=>{});});}
 function event(name){
  if(disposed)return;if(name==='sisventas:session-ended'){retire(true);return;}
  const hadPin=!!pin;sync();if(!demanded||!gate())return;if(hadPin&&!pin){queue();return;}
  if(name==='sisventas:data-state-changed'||!ctx)return;
  const c=capture(),next=JSON.stringify([visible(),c.connected,c.connectionEpoch]);if(!['sisventas:budget-write','sisventas:permissions-changed','sisventas:commercial-write'].includes(name)&&next===marker)return;marker=next;queue();
 }
 if(events){for(const name of ['sisventas:session-ended','sisventas:session-ready','sisventas:session-changed','sisventas:role-changed','sisventas:permissions-changed','sisventas:data-state-changed','sisventas:page-changed','visibilitychange','sisventas:budget-write','sisventas:commercial-write']){const fn=()=>event(name);r.document?.addEventListener?.(name,fn);listeners.push([r.document,name,fn]);}for(const name of ['online','offline','sisventas:connection-lost','sisventas:connection-restored']){const fn=()=>event(name);r.addEventListener?.(name,fn);listeners.push([r,name,fn]);}}
 return Object.freeze({peek(){sync();return view();},ensure:()=>load(),refresh:()=>load(true),dispose(){if(disposed)return;disposed=true;retire(true);for(const [target,name,fn]of listeners)target?.removeEventListener?.(name,fn);if(owned)ctx?.dispose?.();ctx=null;}});
}
return Object.freeze({create});
});
