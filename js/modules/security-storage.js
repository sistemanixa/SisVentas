(function(){
  'use strict';
  // La activación requiere copiar/verificar los datos y publicar las reglas V2.
  // Mientras no se active explícitamente, se conserva la ubicación publicada.
  var enabled = window.SV_SECURITY_STORAGE_V2 === true;
  var protectedStorage = false;
  var stopWatching = null;
  var preparation = null;
  var generation = 0;
  function abortable(task,signal){
    if(!signal)return Promise.resolve(task);
    if(signal.aborted)return Promise.reject(Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'}));
    var abort;var cancelled=new Promise(function(_,reject){abort=function(){reject(Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'}));};signal.addEventListener('abort',abort,{once:true});});
    return Promise.race([Promise.resolve(task),cancelled]).finally(function(){signal.removeEventListener('abort',abort);});
  }
  window.svInvalidarPreparacionSeguridad = function(){
    generation++;
    preparation = null;
    protectedStorage = false;
    if(stopWatching){stopWatching();stopWatching=null;}
  };
  window.svPreparacionSeguridadVigente = function(result, user){
    return !!result && result.uid === user.uid && result.generation === generation;
  };
  window.svPrepararRutasSeguridad = async function(user,options){
    var signal=options&&options.signal;
    if(signal&&signal.aborted)throw Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'});
    if(!enabled||!user){window.svInvalidarPreparacionSeguridad();return;}
    // Compartir sólo trabajo en curso; un nuevo ingreso siempre vuelve a verificar.
    if(preparation && preparation.uid === user.uid && !preparation.signal?.aborted)return abortable(preparation.promise,signal);
    var epoch = ++generation;
    protectedStorage = false;
    if(stopWatching){stopWatching();stopWatching=null;}
    var task = {uid:user.uid,signal:signal};
    preparation = task;
    task.promise = (async function(){
      function check(){if(signal&&signal.aborted)throw Object.assign(Error('La preparación fue cancelada'),{name:'AbortError'});if(epoch !== generation)throw Error('La sesión cambió durante la verificación de acceso.');}
      if(window.SVUserDirectory?.enabled){
        // /usuarios/perfil valida token/revocación, identidad activa y ficha/rol
        // en servidor. No anteponer una segunda conexión RTDB que pueda quedar
        // pendiente e impedir llegar a esa validación autorizada.
        var profile=await window.SVUserDirectory.profile(user,{signal:signal});check();
        if(profile?.uid!==user.uid||typeof profile.fbKey!=='string'||!profile.fbKey||profile.activo===false||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor','compras_paraguay','distribuidora'].includes(profile.rol))throw Error('Perfil de acceso no válido');
        protectedStorage=true;
        var own={};own[profile.fbKey]=profile;
        return {uid:user.uid,generation:epoch,identitySnapshot:{val:function(){return {rol:profile.rol,activo:true};}},usuariosSnapshot:{exists:function(){return true;},val:function(){return own;}}};
      }
      var identitySnapshot=await abortable(window.fbGet(window.fbRef(window.fbDB,'sv_chat_roles/'+user.uid)),signal);
      check();
      var identity=identitySnapshot.val();
      var result={uid:user.uid,generation:epoch,identitySnapshot:identitySnapshot};
      if(identity && ['compras_paraguay','distribuidora'].includes(identity.rol)) { protectedStorage=true;return result; }
      var target=window.fbRef(window.fbDB,'sv_usuarios');
      var snapshot=await abortable(window.fbGet(target),signal);
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
