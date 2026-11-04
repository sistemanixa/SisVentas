(function(root){'use strict';
 const domains=['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos'];let installed=null;
 function policy(){const uid=root.currentUserUid,auth=root.fbAuth?.currentUser,role=root.currentRole,moduleAllowed=name=>root.permisoModulo?.(name)===true,actionAllowed=name=>root.tienePermiso?.(name)===true;return {active:!!uid&&auth?.uid===uid,uid,authUid:auth?.uid,role,viewing:!!root._impersonacionOriginal,passwordResetRequired:false,moduleAllowed,actionAllowed,financialHistoryAccess:{ventas:['venta','detalle','cobranzas'].some(moduleAllowed),pagos:['venta','detalle','cobranzas'].some(moduleAllowed),presupuestos:moduleAllowed('presupuesto')}};}
 function capture(){const value=policy();return {epoch:root._svOperacionesSesionEpoch||0,uid:value.uid,auth:root.fbAuth?.currentUser,role:value.role,db:root.fbDB,permissionRevision:root.PERMISOS_ROLES?.[value.role]?.indiceRevision,route:root._svPaginaDesdeRuta?.()||String(root.location?.hash||'').replace(/^#\//,''),hidden:root.document.hidden,viewing:value.viewing,online:root.navigator?.onLine!==false&&root.SVConnectionMonitor?.canSync?.()!==false,canReadClients:root.SVDomainReads?.allows('clientes',value.role,value.moduleAllowed,value.actionAllowed)===true,allowedDomains:domains.filter(domain=>root.SVClientHistoryAudience?.plan(value,domain))};}
 const same=(left,right)=>left&&right&&left.uid&&left.auth?.uid===left.uid&&right.uid===left.uid&&right.epoch===left.epoch&&right.auth===left.auth&&right.role===left.role&&right.db===left.db&&right.permissionRevision===left.permissionRevision&&right.route===left.route&&!right.hidden&&!right.viewing&&right.online!==false&&right.canReadClients;
 async function headers(initial){if(typeof root.SVServiceAuth?.headers!=='function')throw Error('No se pudo verificar la sesión del historial.');return root.SVServiceAuth.headers(initial);}
 function install(){
  const rollout=root.SV_CLIENT_HISTORY_ROLLOUT;
  if(rollout?.schema!==1||rollout.enabled!==true){installed?.dispose();installed=null;return null;}
  if(installed)return installed;
  if(!root.SVClientHistoryServiceReader?.create||!root.SVClientHistoryHost?.install||!root.SVClientHistoryAudience||!root.SVDomainReads||!root.SVClientHistoryTimelineReader||!root.SVClientHistoryCredentialsContext||!root.SVClientHistoryCredentialsHost)throw Error('Falta completar la aplicación del historial.');
  const base=String(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');if(!base)throw Error('No está disponible la consulta del historial.');
  const previousBudgetReturn=root.volverListaPpto;let returnContext=null,budgetIntent=0;
  const sameIdentity=actor=>{const now=capture();return same({...actor,route:now.route},now);};
  const budgetReturn=function(){const origin=returnContext,matching=origin&&root.pptoActualId===origin.key;returnContext=null;const result=previousBudgetReturn?.apply(this,arguments);if(matching&&sameIdentity(origin.actor))return root.verHistorialCliente?.(origin.clientId);return result;};
  if(typeof previousBudgetReturn==='function')root.volverListaPpto=budgetReturn;
  const reader=root.SVClientHistoryServiceReader.create({capture,fetch:(...args)=>root.fetch(...args),endpoint:base+'/clientes/historial',headers,readiness:root.SVDataReadiness});
  const previousClientEditor=root.editarClienteDesdeHistorial;
  const pointActions=root.SVClientHistoryOriginalActions?.create(root,{capture,canNavigate:domain=>capture().allowedDomains.includes(domain),editClientOriginal:previousClientEditor});
  const clientEditor=()=>pointActions?.editClient(root.clienteActualId);
  if(pointActions&&typeof previousClientEditor==='function')root.editarClienteDesdeHistorial=clientEditor;
  const canReadCredentials=()=>{const actor=capture();return actor.uid&&actor.auth?.uid===actor.uid&&!actor.hidden&&!actor.viewing&&actor.route==='historialcliente'&&actor.canReadClients&&Number.isSafeInteger(actor.permissionRevision)&&(root.tienePermiso?.('credenciales.ver')===true||root.tienePermiso?.('ot.editarCredenciales')===true);};
  const credentialsContext=root.SVClientHistoryCredentialsContext.create({captureContext:()=>({...capture(),epoch:root._svOperacionesSesionEpoch||0}),canRead:canReadCredentials,canEdit:()=>canReadCredentials()&&root.tienePermiso?.('credenciales.editar')===true});
  const credentials=root.SVClientHistoryCredentialsHost.create(root,{context:credentialsContext}),credentialRequests=new WeakMap();
  const timelineReader=root.SVClientHistoryTimelineReader.create({reader,allowedDomains:()=>capture().allowedDomains});
  const ticketReader=root.SVClientHistoryTimelineReader.create({reader,allowedDomains:()=>capture().allowedDomains.filter(domain=>['tickets','reclamos'].includes(domain))});

  async function resolveClient(clientKey){
   const actor={...capture()},credentialRequest=canReadCredentials()?credentials.begin():null;if(!same(actor,capture()))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});
   const auth=await headers({'Content-Type':'application/json'});if(!same(actor,capture()))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});
   const response=await root.fetch(base+'/clientes/historial/cliente',{method:'POST',headers:auth,body:JSON.stringify({clientKey}),cache:'no-store',signal:AbortSignal.timeout(20000)}),result=await response.json();if(!same(actor,capture()))throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});
   if(!response.ok||result?.ok!==true)throw Error(result?.mensaje||'No se pudo verificar el cliente. Volvé a intentar.');
   if(!/^[a-f0-9]{64}$/.test(result.accountId||'')||result.identity?.status!=='linked'||typeof result.identity.label!=='string'||typeof result.identity.recordKey!=='string'||result.addressesComplete!==true||!Array.isArray(result.addresses)||result.addresses.length>100||result.selectedClientKey!==clientKey||result.addresses.some(row=>typeof row.key!=='string'||typeof row.label!=='string')||new Set(result.addresses.map(row=>row.key)).size!==result.addresses.length)throw Error('No se pudo verificar el grupo completo de domicilios.');if(credentialRequest)credentialRequests.set(result,credentialRequest);return result;
  }
  async function navigateOriginal(domain,key,origin){
   const actor={...capture()};if(!same(actor,capture())||!actor.allowedDomains.includes(domain))return;
   if(domain==='ventas')return root.abrirVentaDesdeHistorialCliente?.(key);
   if(pointActions?.canNavigate(domain))return pointActions.navigate(domain,key,origin);
   if(domain!=='presupuestos')return;const intent=++budgetIntent;
   try{
    if(typeof root.SVCommercialOwnership?.request!=='function')throw Error('No se pudo verificar el presupuesto.');
    const response=await root.SVCommercialOwnership.request('presupuestos','registro/'+encodeURIComponent(key));if(intent!==budgetIntent||!same(actor,capture()))return;
    const record=response?.record;if(!record||typeof record!=='object'||Array.isArray(record)||record.fbKey&&record.fbKey!==key)throw Error('No se encontró el presupuesto autorizado.');
    const value={...record,fbKey:key};
    returnContext={...origin,actor,key};return root.svNavegarDirecto?.('presupuesto',()=>{if(!sameIdentity(actor)||returnContext?.key!==key)return;const rows=Array.isArray(root.pptoData)?root.pptoData:[],index=rows.findIndex(row=>row.fbKey===key),next=rows.slice();if(index<0)next.push(value);else next[index]=value;root.pptoData=next;root.verPpto?.(key);},null);
   }catch(error){if(same(actor,capture()))root.notify?.(error.message||'No se pudo abrir el presupuesto.');}
  }
  installed=root.SVClientHistoryHost.install(root,{reader,resolveClient,getAllowedDomains:()=>capture().allowedDomains,navigateOriginal,canNavigateOriginal:domain=>['ventas','presupuestos'].includes(domain)||pointActions?.canNavigate(domain)===true,timelineReader,ticketReader,canReadCredentials,openCredentials:()=>credentials.open(),onReset:()=>{budgetIntent++;credentials.reset();},onResolved:(result,address)=>{const request=credentialRequests.get(result);if(request&&canReadCredentials())credentials.bind(result,address,request);}} );
  const pageChanged=event=>{if(returnContext&&!['presupuesto','historialcliente'].includes(event.detail?.page))returnContext=null;};root.document.addEventListener?.('sisventas:page-changed',pageChanged);
  const dispose=installed.dispose?.bind(installed);installed={...installed,dispose(){budgetIntent++;returnContext=null;pointActions?.dispose();if(root.editarClienteDesdeHistorial===clientEditor)root.editarClienteDesdeHistorial=previousClientEditor;credentials.dispose();timelineReader.reset();ticketReader.reset();root.document.removeEventListener?.('sisventas:page-changed',pageChanged);if(root.volverListaPpto===budgetReturn)root.volverListaPpto=previousBudgetReturn;dispose?.();}};return installed;
 }
 root.SVClientHistoryBootstrap=Object.freeze({install,capture});
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
