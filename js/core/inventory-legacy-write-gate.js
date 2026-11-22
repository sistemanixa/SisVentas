(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVInventoryLegacyWriteGate=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const fail=(code,message)=>Object.assign(Error(message),{code});
// Internal verifier/session injection; never install from a client body or plain flag.
function create({loadVerifiedAdmission,session,expectedCohortDigest}={}){
 if(typeof loadVerifiedAdmission!=='function'||typeof session!=='function'||!/^[a-f0-9]{64}$/.test(expectedCohortDigest||''))throw TypeError('Falta verificar admisión, cohorte común y sesión.');
 async function assertWritable(){
  const initial=session();if(!initial)throw fail('SV_INVENTORY_LEGACY_SESSION','La sesión cambió.');
  const proof=await loadVerifiedAdmission();if(session()!==initial)throw fail('SV_INVENTORY_LEGACY_SESSION','La sesión cambió.');
  if(proof?.schema!==1||proof.verified!==true||proof.cohortDigest!==expectedCohortDigest||!Number.isSafeInteger(proof.revision)||proof.revision<0||typeof proof.sdkClosed!=='boolean')throw fail('SV_INVENTORY_LEGACY_UNVERIFIED','No se pudo verificar el ingreso de inventario.');
  if(proof.sdkClosed)throw fail('SV_INVENTORY_LEGACY_CLOSED','Este recuento fue reemplazado por el ingreso protegido de Stock.');
  return {assertCurrent(){if(session()!==initial)throw fail('SV_INVENTORY_LEGACY_SESSION','La sesión cambió.');},async assertAfter(){if(session()!==initial)throw fail('SV_INVENTORY_LEGACY_SESSION','La sesión cambió. Verificá el recuento antes de repetirlo.');const latest=await loadVerifiedAdmission();if(session()!==initial||latest?.schema!==1||latest.verified!==true||latest.cohortDigest!==expectedCohortDigest||latest.sdkClosed!==false||latest.revision!==proof.revision)throw fail('SV_INVENTORY_LEGACY_CHANGED','El ingreso de inventario cambió. Verificá el recuento antes de repetirlo.');}};
 }
 return {assertWritable};
}
return {create};
});
