(function(){
  'use strict';
  // La activación requiere copiar/verificar los datos y publicar las reglas V2.
  // Mientras no se active explícitamente, se conserva la ubicación publicada.
  var enabled = window.SV_SECURITY_STORAGE_V2 === true;
  var protectedStorage = false;
  var stopWatching = null;
  var preparation = null;
  var generation = 0;
  window.svInvalidarPreparacionSeguridad = function(){
    generation++;
    preparation = null;
    protectedStorage = false;
    if(stopWatching){stopWatching();stopWatching=null;}
  };
  window.svPreparacionSeguridadVigente = function(result, user){
    return !!result && result.uid === user.uid && result.generation === generation;
  };
  window.svPrepararRutasSeguridad = async function(user){
    if(!enabled||!user){window.svInvalidarPreparacionSeguridad();return;}
    // Compartir sólo trabajo en curso; un nuevo ingreso siempre vuelve a verificar.
    if(preparation && preparation.uid === user.uid)return preparation.promise;
    var epoch = ++generation;
    protectedStorage = false;
    if(stopWatching){stopWatching();stopWatching=null;}
    var task = {uid:user.uid};
    preparation = task;
    task.promise = (async function(){
      function check(){if(epoch !== generation)throw Error('La sesión cambió durante la verificación de acceso.');}
      var identitySnapshot=await window.fbGet(window.fbRef(window.fbDB,'sv_chat_roles/'+user.uid));
      check();
      var identity=identitySnapshot.val();
      var result={uid:user.uid,generation:epoch,identitySnapshot:identitySnapshot};
      if(identity && ['compras_paraguay','distribuidora'].includes(identity.rol)) { protectedStorage=true;return result; }
      var target=window.fbRef(window.fbDB,'sv_usuarios');
      var snapshot=await window.fbGet(target);
      check();
      protectedStorage=snapshot.exists();
      result.usuariosSnapshot=snapshot;
      // Las publicaciones pueden llegar antes que la migración. El cambio de
      // ruta solo se activa cuando aparece la copia protegida completa.
      // Con la copia ya publicada, fbCargarUsuarios mantiene la sincronización.
      // No abrir una segunda suscripción completa sólo para comprobar existencia.
      if(!protectedStorage)stopWatching=window.fbOnValue(target,function(next){
        if(epoch !== generation||protectedStorage||!next.exists())return;
        protectedStorage=true;
        if(typeof window.fbCargarUsuarios==='function')window.fbCargarUsuarios();
        if(typeof window.cargarPermisosRoles==='function')window.cargarPermisosRoles();
      });
      return result;
    })();
    try{return await task.promise;}
    finally{if(preparation === task)preparation=null;}
  };
  window.svRutaUsuarios = function(){return protectedStorage ? 'sv_usuarios' : 'sisventas/usuarios';};
  window.svRutaPermisos = function(){return protectedStorage ? 'sv_permisos' : 'sisventas/config/permisos';};
})();
