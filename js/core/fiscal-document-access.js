(function(root){
 'use strict';
 const pending=new Map();
 const protectedRecord=record=>record?._svCommercial?.schema===1;
 const allowed=()=>!root._impersonacionOriginal&&root.tienePermiso?.('facturas.verEmitidas')===true;
 const capture=()=>({user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,permissions:JSON.stringify(root.PERMISOS_ROLES?.[root.currentRole]||null),view:root._impersonacionOriginal,operation:root._svOperacionesSesionEpoch||0,data:root._svDataEpoch||0,route:root.location?.hash||''});
 const same=c=>c.user===root.fbAuth?.currentUser&&c.uid===root.currentUserUid&&c.role===root.currentRole&&c.permissions===JSON.stringify(root.PERMISOS_ROLES?.[root.currentRole]||null)&&c.view===root._impersonacionOriginal&&c.operation===(root._svOperacionesSesionEpoch||0)&&c.data===(root._svDataEpoch||0)&&c.route===(root.location?.hash||'')&&root.document?.visibilityState!=='hidden'&&allowed();
 function open(record,kind='factura',reference,button){
  if(!allowed()||!root.fbAuth?.currentUser||root.document?.visibilityState==='hidden'){root.notify?.('No tenés permiso para ver esta factura.');return Promise.resolve(false);}
  const id=record?.fbKey;if(typeof id!=='string'||!id||!root.SVCommercialOwnership?.document){root.notify?.('Volvé a abrir la venta para ver su factura.');return Promise.resolve(false);}
  const key=JSON.stringify([id,kind,reference]),context=capture(),running=pending.get(key);if(running&&same(running.context))return running.promise;
  let retired=false;const events=['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','visibilitychange'];
  const changed=()=>{if(!same(context))retired=true;};for(const name of events)root.document.addEventListener(name,changed);
  const check=()=>{if(retired||!same(context))throw Object.assign(Error('La pantalla cambió. Volvé a abrir la factura.'),{code:'SV_FISCAL_CONTEXT'});};
  const oldHtml=button?.innerHTML,oldDisabled=button?.disabled;
  if(button){button.disabled=true;button.innerHTML='<i class="ti ti-loader-2 ti-spin" aria-hidden="true"></i> Abriendo factura…';}
  const entry={context,promise:null};entry.promise=Promise.resolve().then(async()=>{
   check();const file=await root.SVCommercialOwnership.document(id,kind,reference,{check});check();
   if(file?.tipo==='application/pdf'&&file?.render==='fiscal-snapshot'&&kind==='factura'&&file.factura?.datos_fiscales?.cae){
    if(typeof root.imprimirVentaActual!=='function')throw Error('No se pudo preparar la copia fiscal.');
    const previous=root._ventaDetalleActual,copy={...record,factura:file.factura};root._ventaDetalleActual=copy;
    try{root.imprimirVentaActual(true);}finally{if(root._ventaDetalleActual===copy)root._ventaDetalleActual=previous;}
    return true;
   }
   const source=file?.data||file?.url;
   if(file?.tipo!=='application/pdf'||typeof source!=='string'||!/^https:\/\//i.test(source)&&!/^data:application\/pdf;base64,/i.test(source))throw Error('El PDF no está disponible.');
   root.abrirVisorComprobanteSistema({data:source,nombre:file.nombre||'Factura.pdf',tipo:'application/pdf'},kind==='nota-credito'?'Nota de crédito':'Factura');return true;
  }).catch(error=>{if(!retired&&same(context))root.notify?.(error.message||'No se pudo abrir la factura.');return false;}).finally(()=>{
   if(pending.get(key)===entry)pending.delete(key);for(const name of events)root.document.removeEventListener(name,changed);
   if(button){button.disabled=oldDisabled;button.innerHTML=oldHtml;}
  });pending.set(key,entry);return entry.promise;
 }
 root.SVFiscalDocuments={open,protectedRecord,allowed};
})(typeof window==='undefined'?globalThis:window);
