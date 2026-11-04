(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleReturnCapability=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
 const PURPOSE='sale-return-to-budget';
 function fail(message,code='SV_SALE_RETURN_UPDATE_REQUIRED'){return Object.assign(Error(message),{code});}
 function validate(payload){
  const capability=payload?.saleReturn;
  if(payload?.ok!==true||typeof payload.revision!=='string'||!payload.revision||payload.revision==='local'||capability?.version!==1||capability.enabled!==true||capability.purpose!==PURPOSE||capability.coordinated!==true||capability.rules?.version!==1||capability.rules.verified!==true||typeof capability.rules.digest!=='string'||!/^[a-f0-9]{64}$/.test(capability.rules.digest))throw fail('Volver a presupuesto requiere completar la actualización del servidor y sus reglas. La venta se conserva.');
  return Object.freeze({purpose:PURPOSE,revision:payload.revision,rulesDigest:capability.rules.digest});
 }
 async function check({request,capture,isCurrent}){
  if(typeof request!=='function'||typeof capture!=='function'||typeof isCurrent!=='function')throw fail('No está disponible la comprobación de compatibilidad.');
  const context=capture();
  if(!isCurrent(context))throw fail('La sesión cambió.','SV_SALE_RETURN_SESSION');
  const response=await request();
  if(!isCurrent(context))throw fail('La sesión cambió.','SV_SALE_RETURN_SESSION');
  if(!response?.ok)throw fail('No se pudo comprobar la actualización para volver a presupuesto. La venta se conserva.','SV_SALE_RETURN_CAPABILITY_UNAVAILABLE');
  const payload=await response.json();
  if(!isCurrent(context))throw fail('La sesión cambió.','SV_SALE_RETURN_SESSION');
  return validate(payload);
 }
 return Object.freeze({PURPOSE,validate,check});
});
