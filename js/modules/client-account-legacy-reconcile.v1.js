(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientAccountLegacyReconcile=api.install(root);})(typeof window==='object'?window:globalThis,function(){'use strict';
function install(root){
 const doc=root.document,events=['sisventas:data-state-changed','sisventas:page-changed','sisventas:role-changed','sisventas:session-ready','sisventas:session-ended','visibilitychange'];
 let ticket=0,pending=null,last=null,ended=false,disposed=false;
 function capture(){
  const host=root.SVClientAccountHost;
  if(disposed||ended||doc.hidden||root._impersonacionOriginal||root.permisoModulo?.('cuentacorriente')!==true||root._svEsPaginaActiva?.('cuentacorriente')!==true||host?.claimed===true||host?.active?.()===true||host?.coordinated?.()===true)return null;
  const keys=['ventas','pagos','clientes'].filter(key=>typeof root.svPuedeLeerDominio!=='function'||root.svPuedeLeerDominio(key));
  if(!keys.length)return null;
  const auth=root.fbAuth?.currentUser,uid=root.currentUserUid;
  if(!uid||auth?.uid!==uid||!root.fbDB||!root.SVDataReadiness?.status)return null;
  // No source is started or marked ready here. The legacy renderer owns its
  // existing calculation and its loading/error presentation.
  return [uid,root.currentRole,auth,root.fbDB,root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision||0,root.SVDataReadiness.snapshotEpoch?.(),JSON.stringify(keys)];
 }
 const same=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((value,i)=>value===b[i]);
 function signature(actor){
  const keys=['ventas','pagos','clientes'].filter(key=>typeof root.svPuedeLeerDominio!=='function'||root.svPuedeLeerDominio(key));
  const state=root.SVDataReadiness.status(keys);
  return actor.concat([JSON.stringify([keys,state.ready,state.missing||[],state.errors||[],state.messages||[]]),root._ccMapActual,root._historialPagosCompleto]);
 }
 function schedule(event){
  if(event?.type==='sisventas:session-ended')ended=true;
  if(event?.type==='sisventas:session-ready')ended=false;
  // Security lifecycle events retire old work; only a subsequent data event
  // may reconcile the replacement actor's data.
  if(['sisventas:session-ended','sisventas:session-ready','sisventas:role-changed'].includes(event?.type)){ticket++;pending=null;last=null;return;}
  const actor=capture();
  if(!actor){ticket++;pending=null;last=null;return;}
  if(event&&event.type!=='sisventas:data-state-changed')last=null;
  if(same(pending,actor))return;
  pending=actor;const at=++ticket;
  const enqueue=fn=>root.requestAnimationFrame?root.requestAnimationFrame(fn):root.setTimeout(fn,0);
  enqueue(function(){
   if(at!==ticket)return;pending=null;
   if(!same(actor,capture())){last=null;return;}
   const next=signature(actor);if(same(last,next))return;
   const state=root.SVDataReadiness.status(['ventas','pagos','clientes'].filter(key=>typeof root.svPuedeLeerDominio!=='function'||root.svPuedeLeerDominio(key)));
   if(state.ready&&!(state.errors||[]).length)root.actualizarConciliacionComercial?.();
   else root.renderTablaCuentaCorriente?.();
   last=same(actor,capture())?signature(actor):null;
  });
 }
 events.forEach(event=>doc.addEventListener(event,schedule));
 schedule();
 return {dispose(){disposed=true;ticket++;events.forEach(event=>doc.removeEventListener(event,schedule));last=null;}};
}
return {install};
});
