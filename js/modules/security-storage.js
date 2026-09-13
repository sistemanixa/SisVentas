(function(){
  'use strict';
  // La activación requiere copiar/verificar los datos y publicar las reglas V2.
  // Mientras no se active explícitamente, se conserva la ubicación publicada.
  var enabled = window.SV_SECURITY_STORAGE_V2 === true;
  var protectedStorage = false;
  var stopWatching = null;
  window.svPrepararRutasSeguridad = async function(user){
    if(stopWatching){stopWatching();stopWatching=null;}
    if(!enabled||!user)return;
    var target=window.fbRef(window.fbDB,'sv_usuarios');
    var snapshot=await window.fbGet(target);
    protectedStorage=snapshot.exists();
    // Las publicaciones pueden llegar antes que la migración. El cambio de
    // ruta solo se activa cuando aparece la copia protegida completa.
    stopWatching=window.fbOnValue(target,function(next){
      if(protectedStorage||!next.exists())return;
      protectedStorage=true;
      if(typeof window.fbCargarUsuarios==='function')window.fbCargarUsuarios();
      if(typeof window.cargarPermisosRoles==='function')window.cargarPermisosRoles();
    });
  };
  window.svRutaUsuarios = function(){return protectedStorage ? 'sv_usuarios' : 'sisventas/usuarios';};
  window.svRutaPermisos = function(){return protectedStorage ? 'sv_permisos' : 'sisventas/config/permisos';};
})();
