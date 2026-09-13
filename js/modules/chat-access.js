(function(){
  'use strict';
  var owner='', stops=[], cache={};
  window.chatDirectoId=function(uid){return 'directo_'+[currentUserUid,uid].sort().join('_');};
  window.chatDirectoParaNombre=function(nombre){var entry=Object.entries(window._chatDirectorio||{}).find(function(pair){return pair[1].nombre===nombre;});return entry?window.chatDirectoId(entry[0]):'';};
  window.chatDirectosSnapshot=function(){return Promise.resolve({val:function(){return cache;}});};
  window.chatIniciarDirectosSeguros=function(){
    if(!window.fbDB||!currentUserUid||owner===currentUserUid)return;
    stops.forEach(function(stop){stop();});stops=[];cache={};owner=currentUserUid;
    var uid=owner;
    stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat_roles/'+uid),function(snap){
      if(currentUserUid!==uid)return;
      var role=snap.val();window._chatRolServidor=role&&role.activo!==false?role.rol:'';
      if(typeof chatAplicarAccesos==='function')chatAplicarAccesos();
      if(typeof chatActualizarBadges==='function')chatActualizarBadges();
    }));
    var channels={};
    stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat_directorio'),function(snap){
      if(currentUserUid!==uid)return;
      window._chatDirectorio=snap.val()||{};
      Object.keys(window._chatDirectorio).filter(function(peer){return peer!==uid;}).forEach(function(peer){
        var channel=window.chatDirectoId(peer);if(channels[channel])return;
        channels[channel]=true;
        stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat/'+channel),function(messages){
          if(currentUserUid!==uid)return;
          cache[channel]=messages.val()||{};
          var list=Object.values(cache[channel]);
          _chatNoLeidos[channel]=list.filter(function(m){return m.autor!==currentUser&&!_chatFueLeido(m,currentUser);}).length;
          chatActualizarBadges();
          var nuevos=chatDetectarMensajesNuevos(channel,list);
          if(!chatEstaLeyendo(channel)&&nuevos.length){var last=nuevos[nuevos.length-1];chatReproducirSonidoNuevo();chatMostrarNotif('Mensaje de '+last.autor,last.texto||'Nuevo adjunto',channel);}
          if(_chatCanal==='directos'&&document.getElementById('chat-modal').classList.contains('open'))chatAbrirDirectos(true);
        }));
      });
    }));
  };
  window.cambiarEstadoUsuarioConAccesoChat=function(key,activo){
    var user=(window.usuariosData||[]).find(function(u){return u.fbKey===key;});
    var uid=user&&user.uid||Object.keys(window._chatDirectorio||{}).find(function(id){return window._chatDirectorio[id].usuarioKey===key;});
    if(!key||!uid)return Promise.reject(new Error('No se encontró la identidad de acceso del usuario.'));
    var changes={};
    changes[window.svRutaUsuarios()+'/'+key+'/activo']=activo;
    changes['sv_chat_roles/'+uid+'/activo']=activo;
    changes['sv_chat_directorio/'+uid+'/activo']=activo;
    return window.fbUpdate(window.fbRef(window.fbDB),changes);
  };
  window.guardarUsuarioConAccesoChat=function(datos,key){
    var ref=window.fbRef(window.fbDB,window.svRutaUsuarios());
    key=key||window.fbPush(ref).key;
    var existing=(window.usuariosData||[]).find(function(u){return u.fbKey===key;})||{};
    var uid=datos.uid||existing.uid||Object.keys(window._chatDirectorio||{}).find(function(id){return window._chatDirectorio[id].usuarioKey===key;});
    if(!uid)return Promise.reject(new Error('No se encontró la identidad de acceso del usuario.'));
    var changes={};changes[window.svRutaUsuarios()+'/'+key]=Object.assign({},existing,datos,{uid:uid});
    delete changes[window.svRutaUsuarios()+'/'+key].fbKey;
    changes['sv_chat_roles/'+uid]={rol:datos.rol,activo:datos.activo!==false};
    changes['sv_chat_directorio/'+uid]={nombre:datos.nombre,usuarioKey:key,activo:datos.activo!==false};
    return window.fbUpdate(window.fbRef(window.fbDB),changes);
  };
  setInterval(function(){if(!currentUserUid){owner='';window._chatRolServidor='';}else window.chatIniciarDirectosSeguros();},1000);
})();
