(function(root){
  'use strict';
  function canView(){return typeof root.tienePermiso==='function'&&root.tienePermiso('dashboard.novedades');}
  function apply(){
    const allowed=canView();
    root.document.querySelectorAll('[data-permiso="dashboard.novedades"]').forEach(el=>{el.style.display=allowed?'':'none';});
    if(!allowed)for(const id of ['modal-historial-actualizaciones','popup-actualizado'])root.document.getElementById(id)?.remove();
  }
  for(const name of ['abrirHistorialActualizaciones','abrirNovedadVersion','abrirNovedadHistorial','_mostrarNovedadActualizacionPendiente','_mostrarPopupActualizacion']){
    const original=root[name];
    if(typeof original!=='function'||original._svReleasePermission)continue;
    const guarded=function(){if(!canView())return;return original.apply(this,arguments);};
    guarded._svReleasePermission=true;root[name]=guarded;
  }
  root.SVReleasePermissions={canView,apply};
  for(const event of ['sisventas:role-changed','sisventas:page-changed','DOMContentLoaded'])root.document.addEventListener(event,apply);
  apply();
})(window);
