(function(root){
 'use strict';
 let generation=0,key='',timer=null;const subscriptions=new Map();
 const context=()=>({epoch:generation,user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole});
 const valid=c=>c.epoch===generation&&c.user===root.fbAuth?.currentUser&&c.uid===root.currentUserUid&&c.role===root.currentRole;
 const clean=r=>{const value=Object.fromEntries(Object.entries(r||{}).filter(([k])=>k!=='fbKey'&&!k.startsWith('_sv')));if(r?._svDerivedFechaOrden)delete value.fechaOrden;return value;};
 async function request(domain,path='',body,validator){
  const c=context();if(!c.user)throw Error('Sesión requerida');const token=await c.user.getIdToken();if(!valid(c))throw Error('La sesión cambió');
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio comercial no disponible');
  const view=c.user.uid!==c.uid?'?verComo='+encodeURIComponent(c.uid):'';
  const res=await fetch(base+'/comerciales/'+domain+(path?'/'+path:'')+view,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(validator?.etag&&!body&&!path?{'If-None-Match':validator.etag}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!valid(c))throw Error('La sesión cambió');
  if(res.status===304){if(!validator?.etag||body||path)throw Error('Validación comercial inesperada');return {_svNotModified:true};}
  const data=await res.json();if(!valid(c))throw Error('La sesión cambió');if(!res.ok||!data.ok)throw Object.assign(Error(data.mensaje||'No se pudo confirmar la operación'),{status:res.status});return {...data,_svEtag:res.headers?.get?.('etag')||''};
 }
 function forgetDetail(domain,records){
  const keys=Object.keys(records||{}),values=Object.values(records||{});let missing=false;
  if(domain==='ventas'&&root._ventaDetalleActual){missing=!keys.includes(root._ventaDetalleActual.fbKey);if(missing)root._ventaDetalleActual=null;}
  if(domain==='presupuestos'&&root.pptoActualId){missing=!keys.includes(root.pptoActualId)&&!values.some(r=>r.id===root.pptoActualId);if(missing)root.pptoActualId='';}
  if(!missing)return;const detail=document.getElementById?.(domain==='ventas'?'venta-detalle-view':'ppto-detalle-view'),list=document.getElementById?.(domain==='ventas'?'ventas-list-view':'ppto-list-view');if(detail)detail.style.display='none';if(list)list.style.display='';
 }
 async function refresh(domain){const s=subscriptions.get(domain);if(!s)return;if(s.pending){s.again=true;return s.pending;}const c=context();s.pending=(async()=>{try{const data=await request(domain,'',undefined,s.etag?{etag:s.etag}:undefined);if(valid(c)&&subscriptions.get(domain)===s){if(!data._svNotModified){const snapshot=JSON.stringify(data.records||{});if(snapshot!==s.snapshot){await s.callback({val:()=>data.records});if(!valid(c)||subscriptions.get(domain)!==s)return;s.snapshot=snapshot;if(c.role!=='admin')forgetDetail(domain,data.records);}s.etag=data._svEtag;}s.loading?.ready();}}catch(e){if(valid(c)&&subscriptions.get(domain)===s){s.loading?.error();if([401,403].includes(e.status)){delete s.snapshot;delete s.etag;s.callback({val:()=>({})});forgetDetail(domain,{});}s.error?.(e);}}})().finally(()=>{s.pending=null;if(s.again&&subscriptions.get(domain)===s){s.again=false;refresh(domain);}});return s.pending;}
 function stop(){generation++;for(const s of subscriptions.values())s.loading?.cancel();subscriptions.clear();clearInterval(timer);timer=null;root._ventasListenerActivo=false;root._pptoListenerActivo=false;root.ventasList=[];root.pptoData=[];root.ventasPendientesHistoricasList=[];}
 function contextChanged(){const next=[root.fbAuth?.currentUser?.uid,root.currentUserUid,root.currentRole,root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision||0].join('|');if(next!==key){const reload=subscriptions.size>0;stop();key=next;if(reload)queueMicrotask(()=>{root.fbCargarVentas?.();root.fbCargarPresupuestos?.();});}}
 function onValue(domain,callback,error){contextChanged();subscriptions.get(domain)?.loading?.cancel();const s={callback,error,loading:root.SVDataReadiness?.beginSource(domain)};subscriptions.set(domain,s);if(!timer)timer=setInterval(()=>{if(!document.hidden)for(const d of subscriptions.keys())refresh(d);},15000);refresh(domain);return ()=>{if(subscriptions.get(domain)===s){s.loading?.cancel();subscriptions.delete(domain);}};}
 function belongs(r){return !!r&&(r.responsableUid||r._svOwnerUid)===root.currentUserUid;}
 function author(r){return r?._svOriginalAuthor?.name||r?.creadorOriginalNombre||r?.creadaPor||r?.creadoPor||r?.usuario||'Sin registrar';}
 function stamp(r){r=root.SVCommissionGeneration?.snapshotCosts(r)||r;return {...clean(r),responsableUid:root.currentUserUid,responsableNombre:root.currentUser||root.currentUserEmail||'Usuario',responsableRol:root.currentRole,responsableRevision:1,creadorOriginalUid:root.currentUserUid,creadorOriginalNombre:root.currentUser||root.currentUserEmail||'Usuario',creadoEn:r?.ts||Date.now()};}
 async function prepare(domain,id,baseline){const result=await request(domain,'preparar',{id});const current=result.record,metadata=['responsableUid','responsableNombre','responsableRol','responsableRevision','responsableActualizadoEn','creadorOriginalUid','creadorOriginalNombre','creadoEn','audit'];const base=baseline?clean(baseline):null;if(base)for(const k of metadata){if(current[k]!==undefined)base[k]=current[k];}return {record:current,baseline:base};}
 async function assign(domain,record,uid){const result=await request(domain,'reasignar',{id:record.fbKey,uid,revision:Number(record.responsableRevision||0),owner:record.responsableUid||''});refresh(domain);return result.record;}
 document.addEventListener('sisventas:session-ended',stop);document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const d of subscriptions.keys())refresh(d);});
 root.SVCommercialOwnership={onValue,request,refresh,stop,contextChanged,belongs,author,stamp,clean,prepare,assign,options:async domain=>(await request(domain,'opciones')).users};
})(window);
