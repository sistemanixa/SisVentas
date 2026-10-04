(function(){
  'use strict';
  var owner='', ownerName='', readyUid='', stops=[], cache={}, groupStops={}, generation=0;
  function sessionName(){return String((window._chatDirectorio||{})[currentUserUid]?.nombre || window._impersonacionOriginal?.user || currentUser || '');}
  document.addEventListener('sisventas:session-ready',function(event){
    readyUid=String(event.detail&&event.detail.uid||'');
    window.chatIniciarDirectosSeguros();
  });
  function clearSession(){
    readyUid='';owner='';ownerName='';generation++;
    Object.values(groupStops).forEach(function(stop){stop();});groupStops={};
    stops.forEach(function(stop){stop();});stops=[];cache={};
    window._chatRolServidor='';window._chatDirectorio={};
    Object.keys(_chatNoLeidos).forEach(function(channel){delete _chatNoLeidos[channel];});
    if(typeof _chatUltimoTsPorCanal!=='undefined')_chatUltimoTsPorCanal={};
    if(typeof chatActualizarBadges==='function')chatActualizarBadges();
  }
  document.addEventListener('sisventas:session-ended',clearSession);
  document.addEventListener('sisventas:chat-disabled',clearSession);
  function refreshUnreadIdentity(){
    var name=sessionName();
    if(ownerName===name)return;
    ownerName=name;
    Object.keys(cache).forEach(function(channel){
      _chatNoLeidos[channel]=Object.values(cache[channel]||{}).filter(function(m){return m.autor!==name&&!_chatFueLeido(m,name);}).length;
    });
    if(typeof chatActualizarBadges==='function')chatActualizarBadges();
  }
  window.chatDirectoId=function(uid){return 'directo_'+[currentUserUid,uid].sort().join('_');};
  window.chatDirectoParaNombre=function(nombre){var entry=Object.entries(window._chatDirectorio||{}).find(function(pair){return pair[1].nombre===nombre;});return entry?window.chatDirectoId(entry[0]):'';};
  window.chatDirectosSnapshot=function(){return Promise.resolve({val:function(){return Object.fromEntries(Object.entries(cache).filter(function(pair){return pair[0].startsWith('directo_');}));}});};
  window.chatIniciarDirectosSeguros=function(){
    // Firebase entrega el UID antes de que se resuelvan el nombre y el rol.
    if(!window.fbDB||!currentUserUid||readyUid!==currentUserUid||!currentUser)return;
    if(owner===currentUserUid){refreshUnreadIdentity();return;}
    stops.forEach(function(stop){stop();});stops=[];cache={};
    Object.values(groupStops).forEach(function(stop){stop();});groupStops={};
    Object.keys(_chatNoLeidos).forEach(function(channel){delete _chatNoLeidos[channel];});
    owner=currentUserUid;ownerName=String(currentUser||'');
    var uid=owner, epoch=++generation, roleReady=false, directoryReady=false;
    function valid(){return generation===epoch&&currentUserUid===uid&&readyUid===uid;}
    function receive(channel,messages){
      if(!valid())return;
      cache[channel]=messages.val()||{};
      var list=Object.values(cache[channel]),name=sessionName();
      _chatNoLeidos[channel]=list.filter(function(m){return m.autor!==name&&!_chatFueLeido(m,name);}).length;
      chatActualizarBadges();
      var nuevos=chatDetectarMensajesNuevos(channel,list);
      if(!chatEstaLeyendo(channel)&&nuevos.length){var last=nuevos[nuevos.length-1];chatReproducirSonidoNuevo();chatMostrarNotif('Mensaje de '+last.autor,last.texto||'Nuevo adjunto',channel);}
      if(_chatCanal==='directos'&&document.getElementById('chat-modal')?.classList.contains('open'))chatAbrirDirectos(true);
    }
    function syncGroups(){
      if(!valid()||!roleReady||!directoryReady||typeof chatPuedeAccederCanal!=='function')return;
      ['general','tecnicos','admin'].forEach(function(channel){
        if(!window._chatRolServidor||!chatPuedeAccederCanal(channel)){
          if(groupStops[channel])groupStops[channel]();
          delete groupStops[channel];delete cache[channel];delete _chatNoLeidos[channel];return;
        }
        if(groupStops[channel])return;
        groupStops[channel]=window.fbOnValue(window.fbRef(window.fbDB,'sv_chat/'+channel),function(messages){
          if(!valid()||!window._chatRolServidor||!chatPuedeAccederCanal(channel))return;
          receive(channel,messages);
        });
      });
      chatActualizarBadges();
    }
    stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat_roles/'+uid),function(snap){
      if(!valid())return;
      var role=snap.val();window._chatRolServidor=role&&role.activo!==false?role.rol:'';
      roleReady=true;syncGroups();
      if(typeof chatAplicarAccesos==='function')chatAplicarAccesos();
      if(typeof chatActualizarBadges==='function')chatActualizarBadges();
    }));
    var channels={};
    stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat_directorio'),function(snap){
      if(!valid())return;
      window._chatDirectorio=snap.val()||{};
      directoryReady=true;syncGroups();refreshUnreadIdentity();
      Object.keys(window._chatDirectorio).filter(function(peer){return peer!==uid;}).forEach(function(peer){
        var channel=window.chatDirectoId(peer);if(channels[channel])return;
        channels[channel]=true;
        stops.push(window.fbOnValue(window.fbRef(window.fbDB,'sv_chat/'+channel),function(messages){
          if(!valid())return;
          receive(channel,messages);
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
