(function(root){
 'use strict';
 let generation=0,key='',lastContext=null;const subscriptions=new Map(),readControllers=new Set(),accessRevisions=new Map(),accessBlocked=new Set(),observers=new Map(),httpReads=new Map();
 function effectiveUid(){const view=root._impersonacionOriginal;if(!view)return root.currentUserUid||'';const users=Array.isArray(root.usuariosData)?root.usuariosData:Object.values(root.usuariosData||{}),profile=users.find(user=>String(user?.fbKey||'')===String(view.usuarioFbKey||'')),uid=profile?.uid;return typeof uid==='string'&&uid&&uid.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(uid)&&uid!==root.fbAuth?.currentUser?.uid?uid:'';}
 const permissionKey=()=>JSON.stringify(root.PERMISOS_ROLES?.[root.currentRole]||null);
 const context=()=>({epoch:generation,user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,permissions:permissionKey(),view:root._impersonacionOriginal,operationEpoch:root._svOperacionesSesionEpoch||0,dataEpoch:root._svDataEpoch||0,effectiveUid:effectiveUid()});
 const valid=c=>c.epoch===generation&&c.user===root.fbAuth?.currentUser&&c.uid===root.currentUserUid&&c.role===root.currentRole&&c.permissions===permissionKey()&&c.view===root._impersonacionOriginal&&c.operationEpoch===(root._svOperacionesSesionEpoch||0)&&c.dataEpoch===(root._svDataEpoch||0)&&c.effectiveUid===effectiveUid();
 function invalidateAccess(domain){accessRevisions.set(domain,(accessRevisions.get(domain)||0)+1);accessBlocked.add(domain);}
 const clean=r=>{const value=Object.fromEntries(Object.entries(r||{}).filter(([k])=>k!=='fbKey'&&!k.startsWith('_sv')));if(r?._svDerivedFechaOrden)delete value.fechaOrden;return value;};
 async function performRequest(domain,path='',body,validator){
  const c=context();if(!c.user)throw Error('Sesión requerida');if(c.view&&!c.effectiveUid)throw Object.assign(Error('La cuenta seleccionada necesita un UID vinculado para esta vista.'),{code:'SV_COMMERCIAL_PREVIEW_UID',status:403,statusCode:403});const check=()=>{if(!valid(c))throw Error('La sesión cambió');validator?.check?.();};check();
  if(!body&&root.SVForegroundSession){await root.SVForegroundSession.waitVisible();if(!valid(c))throw Error('La sesión cambió');}
  check();const tokenTask=c.user.getIdToken(),token=await(root.SVSessionRecovery?.deadline?root.SVSessionRecovery.deadline(tokenTask):tokenTask);if(!valid(c))throw Error('La sesión cambió');
  if(!body&&root.SVForegroundSession){await root.SVForegroundSession.waitVisible();if(!valid(c))throw Error('La sesión cambió');}
  const base=root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base)throw Error('Servicio comercial no disponible');
  const view=c.user.uid!==c.effectiveUid?'?verComo='+encodeURIComponent(c.effectiveUid):'';
  const controller=!body&&typeof AbortController==='function'&&typeof AbortSignal.any==='function'?new AbortController():null;if(controller)readControllers.add(controller);
  const signal=controller?AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000);
  check();if(body&&validator?.transport)validator.transport.started=true;const res=await fetch(base+'/comerciales/'+domain+(path?'/'+path:'')+view,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(validator?.etag&&!body&&!path?{'If-None-Match':validator.etag}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal}).catch(error=>{console.warn('[SisVentas] fallo de lectura comercial',{resource:domain,method:body?'POST':'GET',error:error.name,online:root.navigator?.onLine,time:new Date().toISOString()});throw error;}).finally(()=>{if(controller)readControllers.delete(controller);});
  if(!valid(c))throw Error('La sesión cambió');
  if(res.status===304){root.SVConnectionMonitor?.success(domain);if(!validator?.etag||body||path)throw Error('Validación comercial inesperada');return {_svNotModified:true};}
  check();const data=await res.json();check();if(!res.ok||!data.ok){const error=Object.assign(Error(data.mensaje||'No se pudo confirmar la operación'),{status:res.status,statusCode:res.status,httpStatus:res.status,code:data.code,svLaborAttempted:!!body});if([401,403].includes(res.status)){invalidateAccess(domain);error._svAccessRevoked=true;}throw error;}root.SVConnectionMonitor?.success(domain);return {...data,_svEtag:res.headers?.get?.('etag')||''};
 }
 function request(domain,path='',body,validator){
  if(body){const transport={started:false};return performRequest(domain,path,body,{...validator,transport}).catch(error=>{if(error&&typeof error==='object'&&error.svLaborAttempted===undefined)error.svLaborAttempted=transport.started;throw error;});}
  const c=context(),id=JSON.stringify([generation,c.uid,c.effectiveUid,c.role,c.permissions,domain,path,validator?.etag||'']);let pending=httpReads.get(id);
  if(!pending){pending=performRequest(domain,path,undefined,validator).finally(()=>{if(httpReads.get(id)===pending)httpReads.delete(id);});httpReads.set(id,pending);}
  return pending.then(result=>{if(!valid(c))throw Error('La sesión cambió');validator?.check?.();return JSON.parse(JSON.stringify(result));});
 }
 function notify(domain,records){for(const observer of Array.from(observers.get(domain)||[])){try{observer.callback({val:()=>JSON.parse(JSON.stringify(records||{}))});}catch(error){observer.error?.(error);}}}
 function notifyError(domain,error){const entries=observers.get(domain);observers.delete(domain);for(const observer of Array.from(entries||[]))try{observer.error?.(error);}catch(_){};}
 function subscribe(domain,callback,error){
  if(!['ventas','presupuestos'].includes(domain)||typeof callback!=='function')throw Error('Suscripción comercial inválida');contextChanged();const source=subscriptions.get(domain);
  if(!source)throw Object.assign(Error('Abrí el listado comercial para activar esta lectura.'),{code:'SV_COMMERCIAL_SUBSCRIPTION'});
  const observer={callback,error};let entries=observers.get(domain);if(!entries){entries=new Set();observers.set(domain,entries);}entries.add(observer);
  const cached=cachedRecords(domain);if(cached!==null)callback({val:()=>JSON.parse(JSON.stringify(cached))});
  return ()=>{entries.delete(observer);if(!entries.size)observers.delete(domain);};
 }
 function forgetDetail(domain,records){
  const keys=Object.keys(records||{}),values=Object.values(records||{});let missing=false;
  if(domain==='ventas'&&root._ventaDetalleActual){missing=!keys.includes(root._ventaDetalleActual.fbKey);if(missing)root._ventaDetalleActual=null;}
  if(domain==='presupuestos'&&root.pptoActualId){missing=!keys.includes(root.pptoActualId)&&!values.some(r=>r.id===root.pptoActualId);if(missing)root.pptoActualId='';}
  if(!missing)return;const detail=document.getElementById?.(domain==='ventas'?'venta-detalle-view':'ppto-detalle-view'),list=document.getElementById?.(domain==='ventas'?'ventas-list-view':'ppto-list-view');if(detail)detail.style.display='none';if(list)list.style.display='';
 }
 async function refresh(domain,{joinPending=false}={}){
  const s=subscriptions.get(domain);if(!s||root.navigator?.onLine===false)return;
  if(root.SVConnectionMonitor?.canSync()===false){await root.SVConnectionMonitor.check?.();if(subscriptions.get(domain)!==s||root.SVConnectionMonitor.canSync()===false)return;joinPending=true;}
  if(s.pending){if(!joinPending)s.again=true;return s.pending;}
  const c=context(),writeRevision=s.writeRevision||0,permissionRevision=root.PERMISOS_ROLES?.[c.role]?.indiceRevision||0;
  const current=()=>valid(c)&&subscriptions.get(domain)===s;
  const currentRead=()=>current()&&writeRevision===(s.writeRevision||0);
  s.pending=(async()=>{try{
   const data=await request(domain,'',undefined,s.etag?{etag:s.etag}:undefined);
   // Una lectura iniciada antes del acuse de escritura no puede reponer el
   // estado anterior en la lista ni restaurar su ETag.
   if(!currentRead())return;
   if(!data._svNotModified){
    accessBlocked.delete(domain);
    const snapshot=JSON.stringify(data.records||{});
    if(snapshot!==s.snapshot){await s.callback({val:()=>data.records});if(!currentRead())return;s.snapshot=snapshot;notify(domain,data.records);if(c.role!=='admin')forgetDetail(domain,data.records);}
    s.etag=data._svEtag;s.cachedContext=c;s.cachedPermissionRevision=permissionRevision;
   }
   s.loading?.ready();
  }catch(e){
   // Una revocación conserva prioridad incluso si la lectura precedió al
   // guardado. Los errores tardíos de red no degradan un acuse posterior.
   if(current()&&(currentRead()||[401,403].includes(e.status))){
    s.loading?.error();root.SVConnectionMonitor?.failure(domain,e);notifyError(domain,e);
    if([401,403].includes(e.status)){if(!e._svAccessRevoked)invalidateAccess(domain);delete s.snapshot;delete s.etag;s.callback({val:()=>({})});notify(domain,{});forgetDetail(domain,{});}
    if(s.snapshot===undefined||[401,403].includes(e.status))s.error?.(e);
   }
  }})().finally(()=>{s.pending=null;if(s.again&&subscriptions.get(domain)===s){s.again=false;refresh(domain);}});
  return s.pending;
 }
 function stop(){generation++;for(const controller of readControllers)controller.abort();readControllers.clear();httpReads.clear();for(const entries of observers.values())for(const observer of entries)try{observer.error?.(Object.assign(Error('La sesión comercial terminó.'),{code:'SV_COMMERCIAL_SESSION'}));}catch(_){}observers.clear();for(const s of subscriptions.values())s.loading?.cancel();subscriptions.clear();accessBlocked.clear();root._ventasListenerActivo=false;root._pptoListenerActivo=false;root.ventasList=[];root.pptoData=[];root.ventasPendientesHistoricasList=[];}
 function contextChanged(){const next=[root.fbAuth?.currentUser?.uid,root.currentUserUid,effectiveUid(),root._impersonacionOriginal?.usuarioFbKey||'',root.currentRole,permissionKey(),root._svOperacionesSesionEpoch||0,root._svDataEpoch||0].join('|');if(next!==key||!lastContext||!valid(lastContext)){const reload=subscriptions.size>0;stop();key=next;lastContext=context();if(reload)queueMicrotask(()=>{root.fbCargarVentas?.();root.fbCargarPresupuestos?.();});}}
 // Avisos del mismo regreso comparten la lectura pendiente. Las llamadas
 // explícitas a refresh conservan again para no perder un cambio real.
 function refreshVisible(){if(document.hidden||root.navigator?.onLine===false)return;for(const domain of subscriptions.keys())refresh(domain,{joinPending:true});}
 function onValue(domain,callback,error){contextChanged();subscriptions.get(domain)?.loading?.cancel();const s={callback,error,loading:root.SVDataReadiness?.beginSource(domain)};subscriptions.set(domain,s);refresh(domain);return ()=>{if(subscriptions.get(domain)===s){s.loading?.cancel();subscriptions.delete(domain);notifyError(domain,Object.assign(Error('La lectura comercial se retiró.'),{code:'SV_COMMERCIAL_SUBSCRIPTION'}));}};}
 function belongs(r){return !!r&&(r.responsableUid||r._svOwnerUid)===effectiveUid();}
 // Sólo devuelve la proyección ya autorizada de esta sesión. No inicia lecturas
 // ni permite que una advertencia del catálogo dependa de acceso global a ventas.
 function cachedRecords(domain){
  const s=subscriptions.get(domain);
  if(!s?.snapshot||!s.cachedContext||!valid(s.cachedContext)||accessBlocked.has(domain)||s.cachedPermissionRevision!==(root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision||0))return null;
  try{return JSON.parse(s.snapshot);}catch(_){return null;}
 }
 function author(r){return r?._svOriginalAuthor?.name||r?.creadorOriginalNombre||r?.creadaPor||r?.creadoPor||r?.usuario||'Sin registrar';}
 function stamp(r){r=root.SVCommissionGeneration?.snapshotCosts(r)||r;return {...clean(r),responsableUid:root.currentUserUid,responsableNombre:root.currentUser||root.currentUserEmail||'Usuario',responsableRol:root.currentRole,responsableRevision:1,creadorOriginalUid:root.currentUserUid,creadorOriginalNombre:root.currentUser||root.currentUserEmail||'Usuario',creadoEn:r?.ts||Date.now()};}
 function captureWriteContext(domain='presupuestos'){return Object.freeze({...context(),domain,accessRevision:accessRevisions.get(domain)||0,permissionRevision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision||0});}
 function isWriteContext(c){return !!c&&!!c.user&&!!c.uid&&c.user.uid===c.uid&&valid(c)&&!accessBlocked.has(c.domain)&&c.accessRevision===(accessRevisions.get(c.domain)||0)&&c.permissionRevision===(root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision||0);}
 function confirmWrite(domain,record,c){
  if(!isWriteContext(c))throw Error('La sesión cambió. El guardado confirmado pertenece a la sesión anterior.');
  if(!['ventas','presupuestos'].includes(domain)||c.domain!==domain||!record||typeof record!=='object'||Array.isArray(record))throw Error('Acuse de presupuesto inválido');
  const id=typeof record.fbKey==='string'?record.fbKey:'';
  if(!id||/[.#$\[\]\/\x00-\x1f\x7f]/.test(id))throw Error('El acuse requiere la clave técnica del presupuesto');
  const saved=JSON.parse(JSON.stringify(clean(record)));if(record._svCommercial)saved._svCommercial=JSON.parse(JSON.stringify(record._svCommercial));const list=domain==='ventas'?(Array.isArray(root.ventasList)?root.ventasList:[]):(Array.isArray(root.pptoData)?root.pptoData:[]),at=list.findIndex(r=>r&&r.fbKey===id);
  const projection=Object.fromEntries(Object.entries(at<0?{}:list[at]).filter(([k])=>k.startsWith('_sv')));
  // Reemplazar con el snapshot completo permite también quitar campos que la
  // transacción eliminó. La coincidencia es únicamente por fbKey.
  const visible={...projection,...saved,fbKey:id},next=list.slice();
  if(at<0)next.unshift(visible);else next[at]=visible;
  if(domain==='ventas')root.ventasList=next;else root.pptoData=next;
  const s=subscriptions.get(domain);
  if(s){
   let records={};try{records=JSON.parse(s.snapshot||'{}');}catch(_){}
   records[id]={...projection,...saved};s.snapshot=JSON.stringify(records);
   s.writeRevision=(s.writeRevision||0)+1;delete s.etag;notify(domain,records);
  }
  return visible;
 }
 function confirmDelete(domain,id,c){
  if(!isWriteContext(c))throw Error('La sesión cambió. La eliminación confirmada pertenece a la sesión anterior.');
  if(!['ventas','presupuestos'].includes(domain)||c.domain!==domain||typeof id!=='string'||!id||/[.#$\[\]\/\x00-\x1f\x7f]/.test(id))throw Error('Acuse de eliminación de presupuesto inválido');
  // El remove ya fue confirmado. Aplicar sólo esa clave, sin descargar otra
  // vez el historial ni depender de una escucha RTDB que esta lista no usa.
  const property=domain==='ventas'?'ventasList':'pptoData';root[property]=(Array.isArray(root[property])?root[property]:[]).filter(record=>record?.fbKey!==id);
  const s=subscriptions.get(domain);
  if(s){
   let records={};try{records=JSON.parse(s.snapshot||'{}');}catch(_){}
   delete records[id];s.snapshot=JSON.stringify(records);notify(domain,records);
   s.writeRevision=(s.writeRevision||0)+1;delete s.etag;
  }
  return id;
 }
 async function prepare(domain,id,baseline){const result=await request(domain,'preparar',{id});const current=result.record,metadata=['responsableUid','responsableNombre','responsableRol','responsableRevision','responsableActualizadoEn','creadorOriginalUid','creadorOriginalNombre','creadoEn','audit'];const base=baseline?clean(baseline):null;if(base){for(const k of metadata){if(current[k]!==undefined)base[k]=current[k];}if(baseline._svCommercial?.revision)base._svCommercial=JSON.parse(JSON.stringify(baseline._svCommercial));else if(current._svCommercial){const technical=value=>Array.isArray(value)?value.map(technical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([name])=>!name.startsWith('_sv')&&name!=='fbKey'&&!metadata.includes(name)).map(([name,v])=>[name,technical(v)])):value;const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(name=>[name,stable(value[name])])):value;if(JSON.stringify(stable(technical(baseline)))!==JSON.stringify(stable(technical(current))))throw Object.assign(Error('La ficha cambió. Volvé a abrirla antes de guardar.'),{code:'SV_COMMERCIAL_VERSION'});base._svCommercial=JSON.parse(JSON.stringify(current._svCommercial));if(Array.isArray(base.items)&&Array.isArray(current.items))base.items=base.items.map((line,index)=>({...line,...(current.items[index]?._svLineRef?{_svLineRef:current.items[index]._svLineRef}:{})}));}}return {record:current,baseline:base};}
 async function assign(domain,record,uid){const result=await request(domain,'reasignar',{id:record.fbKey,uid,revision:Number(record.responsableRevision||0),owner:record.responsableUid||''});refresh(domain);return result.record;}
 document.addEventListener('sisventas:session-ended',stop);document.addEventListener('visibilitychange',refreshVisible);root.addEventListener?.('online',refreshVisible);root.addEventListener?.('sisventas:connection-restored',refreshVisible);root.addEventListener?.('sisventas:connection-lost',()=>{for(const controller of readControllers)controller.abort();});
 root.SVCommercialOwnership={document:async (id,kind,reference,validator)=>(await request('ventas','documento/'+encodeURIComponent(id)+'/'+encodeURIComponent(kind)+(reference===undefined?'':'/'+encodeURIComponent(reference)),undefined,validator)).document,onValue,subscribe,request,refresh,stop,contextChanged,belongs,cachedRecords,author,stamp,clean,prepare,assign,captureWriteContext,isWriteContext,confirmWrite,confirmDelete,options:async domain=>(await request(domain,'opciones')).users};
})(window);
