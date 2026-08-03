(function initNotifications(global){
  'use strict';
  function svEsc(v){ if(typeof escapeHTML==='function') return escapeHTML(v); return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function svLocalISO(date){
    var d=date instanceof Date?date:new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function svToday(){ return svLocalISO(new Date()); }
  function sessionContext(){
    if(typeof global.obtenerContextoSesionSisVentas==='function'){
      return global.obtenerContextoSesionSisVentas()||{};
    }
    return { usuario:global.currentUserName||global.currentUser||'', rol:global.currentRole||'', email:global.currentUserEmail||'' };
  }
  function svCurrentUserName(){ var ctx=sessionContext(); return String(ctx.usuario||ctx.email||'Sistema'); }
  function notifPermitidaTecnico(n){
    var txt=[n.tipo,n.titulo,n.title,n.descripcion,n.mensaje,n.body,n.modulo,n.categoria].join(' ').toLowerCase();
    var bloqueadas=['stock','presupuesto','iva','deuda','caja','tesorer','factur','proveedor','orden de compra','compra','cliente con saldo','vencimiento presupuesto'];
    if(bloqueadas.some(function(x){return txt.indexOf(x)>=0;})) return false;
    var permitidas=['ot','orden de trabajo','reclamo','soporte','garant','pago','pagado','hora extra','hs extra','comision','comisión','asignad','tecnico','técnico'];
    return permitidas.some(function(x){return txt.indexOf(x)>=0;});
  }
  function notifSource(){
    var source=typeof global.obtenerNotificacionesSisVentas==='function'
      ? global.obtenerNotificacionesSisVentas()
      : (Array.isArray(global.todasNotifs)?global.todasNotifs:[]);
    if(!Array.isArray(source)) source=[];
    var tecnico=global.SisVentas&&global.SisVentas.Access&&global.SisVentas.Access.is('tecnico');
    return tecnico?source.filter(notifPermitidaTecnico):source;
  }
  // Notificaciones: urgent filter + estados persistidos por usuario
  function currentIdentity(){
    var ctx=sessionContext();
    var authEmail = global.fbAuth && global.fbAuth.currentUser && global.fbAuth.currentUser.email;
    var id = ctx.email || authEmail || ctx.usuario || global.currentUserName || 'local';
    return String(id || 'local').toLowerCase();
  }
  function notifStorageKey(){
    var u = currentIdentity().replace(/[^a-z0-9]+/g,'_');
    return 'sv_notif_state_v3_' + u;
  }
  function nKey(id){ return String(id||'').replace(/[.#$\[\]/]/g,'_'); }
  function loadState(){ try{return JSON.parse(localStorage.getItem(notifStorageKey())||'{}')||{};}catch(e){return {};} }
  function saveState(st){ try{localStorage.setItem(notifStorageKey(), JSON.stringify(st||{}));}catch(e){} }
  var notifState=loadState();
  var notifStateUnsubscribe=null;
  var notifStateUser='';
  var avisoCriticoTimer=null;
  var avisoCriticoGestion=null;
  var avisoCriticoLote=null;
  var avisosCriticosActuales={};
  var avisoCriticoObserver=null;
  function getN(id){
    var estado=notifState[nKey(id)]||{};
    // "Recordar mañana" deja de ser una posposición al comenzar el día
    // elegido. Antes la tarjeta volvía a la lista, pero el aviso central seguía
    // leyéndola como pospuesta y la retiraba al llegar la sincronización remota.
    if(estado.estado==='pospuesta'&&estado.reaparece&&estado.reaparece<=svToday()){
      return Object.assign({},estado,{estado:'',reaparecida:true});
    }
    return estado;
  }
  function stateTime(value){ var t=Date.parse(value&&value.updatedAt||''); return isNaN(t)?0:t; }
  function refreshNotifUI(){
    if(typeof renderNotificaciones==='function') renderNotificaciones((document.getElementById('notif-filtro')||{}).value||'');
    if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif();
    programarAvisoCriticoPresupuesto();
  }

  function avisosCriticosPendientes(){
    return notifSource().filter(function(n){ return esAvisoCriticoPresupuesto(n)&&visibleNotif(n,'')&&!getN(n.id).estado; });
  }

  function iniciarLoteAvisosCriticos(){
    if(!avisoCriticoLote){
      avisoCriticoLote={ total:avisosCriticosPendientes().length, atendidos:0 };
    }
    return avisoCriticoLote;
  }

  function avanzarLoteAvisosCriticos(){
    var lote=iniciarLoteAvisosCriticos();
    lote.atendidos=Math.min(lote.total,lote.atendidos+1);
  }

  function reanudarColaAvisosCriticos(){
    if(!avisoCriticoGestion) return;
    avisoCriticoGestion=null;
    if(!avisosCriticosPendientes().length) avisoCriticoLote=null;
    programarAvisoCriticoPresupuesto();
  }

  window.reanudarColaAvisosImportantes=reanudarColaAvisosCriticos;

  function esAvisoCriticoPresupuesto(n){
    var id=String(n&&n.id||'');
    // Toda notificación marcada como urgente debe interrumpir visualmente.
    // Los presupuestos aprobados también se anuncian aunque no sean urgentes,
    // porque requieren que el administrativo continúe el circuito comercial.
    return !!(n&&n.urgente) || id.indexOf('ppto_aprob_')===0 || id.indexOf('ppto_aprobado_int_')===0;
  }
  function programarAvisoCriticoPresupuesto(){
    clearTimeout(avisoCriticoTimer);
    avisoCriticoTimer=setTimeout(mostrarAvisoCriticoPresupuesto,450);
  }
  function avisoCriticoCardId(id){ return 'sv-important-alert-'+nKey(id); }
  function quitarTarjetaAvisoCritico(id){
    var tarjeta=document.getElementById(avisoCriticoCardId(id));
    if(tarjeta) tarjeta.remove();
    delete avisosCriticosActuales[String(id||'')];
    var stack=document.getElementById('sv-important-alert-stack');
    if(stack&&!stack.children.length) stack.remove();
  }
  function mostrarAvisoCriticoPresupuesto(){
    // Retirar el formato central legado. Los avisos importantes viven en la
    // pila lateral, uno debajo del otro, sin bloquear el trabajo del usuario.
    var modalLegado=document.getElementById('modal-aviso-critico-presupuesto');
    if(modalLegado) modalLegado.remove();
    var paginaActiva=document.querySelector('.page.active');
    if(paginaActiva&&paginaActiva.id==='page-notificaciones'){
      var stackEnListado=document.getElementById('sv-important-alert-stack');
      if(stackEnListado) stackEnListado.remove();
      return;
    }
    var ctx=sessionContext();
    if(!ctx.usuario||!ctx.rol||document.getElementById('modal-comunicado-global')){
      if(document.getElementById('modal-comunicado-global')) programarAvisoCriticoPresupuesto();
      return;
    }
    var pendientes=avisosCriticosPendientes();
    pendientes.forEach(function(aviso){ avisosCriticosActuales[String(aviso.id)]=aviso; });
    Object.keys(avisosCriticosActuales).forEach(function(id){
      if(getN(id).estado) quitarTarjetaAvisoCritico(id);
    });
    var avisos=Object.keys(avisosCriticosActuales).map(function(id){return avisosCriticosActuales[id];}).filter(Boolean);
    if(!avisos.length){ avisoCriticoLote=null; return; }
    var stack=document.getElementById('sv-important-alert-stack');
    if(!stack){
      stack=document.createElement('div');
      stack.id='sv-important-alert-stack';
      stack.className='sv-action-alert-stack sv-important-alert-stack';
      stack.setAttribute('aria-live','assertive');
      document.body.appendChild(stack);
    }
    avisos.forEach(function(aviso,indice){
      if(document.getElementById(avisoCriticoCardId(aviso.id))) return;
      var aprobado=String(aviso.id).indexOf('ppto_aprobado_int_')===0;
      var tarjeta=document.createElement('section');
      tarjeta.id=avisoCriticoCardId(aviso.id);
      tarjeta.dataset.notificacionId=String(aviso.id);
      tarjeta.className='sv-action-alert sv-important-alert '+(aprobado?'is-success':(aviso.urgente?'is-urgent':''));
      tarjeta.innerHTML=
        '<div class="sv-action-alert-icon"><i class="ti '+svEsc(aviso.icono||'ti-bell')+'"></i></div>'+
        '<div class="sv-action-alert-content">'+
          '<div class="sv-action-alert-heading"><span>'+(aviso.urgente?'Urgente':'Aviso importante')+'</span>'+(avisos.length>1?'<span class="sv-action-alert-badge">'+(indice+1)+' de '+avisos.length+'</span>':'')+'</div>'+
          '<div class="sv-action-alert-title">'+svEsc(aviso.titulo||'Notificación importante')+'</div>'+
          '<div class="sv-action-alert-meta">'+svEsc(aviso.sub||'')+'</div>'+
          (aviso.accion&&aviso.accion.fn?'<div class="sv-action-alert-actions"><button type="button" class="btn btn-sm btn-primary sv-important-alert-open"><i class="ti ti-external-link"></i> '+svEsc(aviso.accion.label||'Abrir')+'</button></div>':'')+
        '</div>'+
        '<button type="button" class="sv-action-alert-close" aria-label="Marcar como leída y cerrar" title="Marcar como leída"><i class="ti ti-x"></i></button>';
      tarjeta.querySelector('.sv-action-alert-close').addEventListener('click',function(){ window.notifAvisoCriticoEntendido(aviso.id); });
      var abrir=tarjeta.querySelector('.sv-important-alert-open');
      if(abrir) abrir.addEventListener('click',function(){ window.notifAvisoCriticoAbrir(aviso.id); });
      stack.appendChild(tarjeta);
    });
  }
  function iniciarSyncNotificaciones(){
    var identity=currentIdentity();
    if(!identity||identity==='local'||!global.fbDB||!global.fbOnValue) return;
    var userKey=nKey(identity);
    if(notifStateUser===userKey&&typeof notifStateUnsubscribe==='function') return;
    if(typeof notifStateUnsubscribe==='function') notifStateUnsubscribe();
    notifStateUser=userKey;
    notifState=loadState();
    var ref=global.fbRef(global.fbDB,'sisventas/notificaciones_estado/'+userKey);
    notifStateUnsubscribe=global.fbOnValue(ref,function(snapshot){
      var remote=snapshot.val()||{}, merged={}, pending={};
      Object.keys(Object.assign({},notifState,remote)).forEach(function(key){
        var localValue=notifState[key], remoteValue=remote[key];
        if(!remoteValue||(localValue&&stateTime(localValue)>stateTime(remoteValue))){ merged[key]=localValue; if(localValue) pending[key]=localValue; }
        else merged[key]=remoteValue;
      });
      notifState=merged;
      saveState(notifState);
      if(Object.keys(pending).length&&global.fbUpdate) global.fbUpdate(ref,pending).catch(function(error){console.warn('[Notificaciones] No se pudo migrar estado local',error);});
      refreshNotifUI();
    },function(error){ console.error('[Notificaciones] Error de sincronización',error); });
  }
  window.iniciarSyncNotificaciones=iniciarSyncNotificaciones;
  window.detenerSyncNotificaciones=function(){
    clearTimeout(avisoCriticoTimer);
    avisoCriticoTimer=null;
    var aviso=document.getElementById('modal-aviso-critico-presupuesto');
    if(aviso) aviso.remove();
    var stack=document.getElementById('sv-important-alert-stack');
    if(stack) stack.remove();
    if(typeof notifStateUnsubscribe==='function'){
      try{ notifStateUnsubscribe(); }catch(e){}
    }
    notifStateUnsubscribe=null;
    notifStateUser='';
    notifState={};
    avisoCriticoGestion=null;
    avisoCriticoLote=null;
    avisosCriticosActuales={};
  };

  function vigilarAvisoCriticoPersistente(){
    if(avisoCriticoObserver||!global.MutationObserver||!document.documentElement) return;
    avisoCriticoObserver=new MutationObserver(function(){
      var faltante=Object.keys(avisosCriticosActuales).some(function(id){
        return !getN(id).estado&&!document.getElementById(avisoCriticoCardId(id));
      });
      if(!faltante) return;
      var ctx=sessionContext();
      if(!ctx.usuario||!ctx.rol||avisoCriticoGestion) return;
      // Ninguna reconstruccion de pagina o grilla puede cerrar silenciosamente
      // un aviso importante. Las acciones explicitas actualizan el estado antes
      // de que este observador reciba la mutacion.
      programarAvisoCriticoPresupuesto();
    });
    avisoCriticoObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function setN(id, patch){
    var k=nKey(id);
    notifState[k]=Object.assign(notifState[k]||{},patch,{updatedAt:new Date().toISOString(),usuario:svCurrentUserName()});
    saveState(notifState);
    iniciarSyncNotificaciones();
    var identity=currentIdentity();
    if (window.fbDB && identity && identity !== 'local') {
      window.fbSet(window.fbRef(window.fbDB,'sisventas/notificaciones_estado/'+nKey(identity)+'/'+k),notifState[k]).catch(function(error){console.error('[Notificaciones] Error guardando estado',error);});
    }
    programarAvisoCriticoPresupuesto();
  }
  function visibleNotif(n, filtro){
    var st = getN(n.id), estado = st.estado || '';
    if (filtro === 'pospuestas') return estado === 'pospuesta';
    if (filtro === 'resueltas') return estado === 'resuelta';
    if (filtro === 'archivadas') return estado === 'archivada';
    if (filtro === 'urgente' && !n.urgente) return false;
    if (filtro && !['urgente','pospuestas','resueltas','archivadas'].includes(filtro) && n.tipo !== filtro) return false;
    if (estado === 'archivada' || estado === 'resuelta') return false;
    if (estado === 'pospuesta' && st.reaparece && st.reaparece > svToday()) return false;
    return true;
  }
  window.notifResolver = function(id){ setN(id,{estado:'resuelta'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Marcada como resuelta. No se modificó el presupuesto ni la OT.'); };
  window.notifArchivar = function(id){ setN(id,{estado:'archivada'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Archivada. Podés encontrarla con el filtro Archivadas.'); };
  window.notifPosponer = function(id,dias){ var d=new Date(); d.setDate(d.getDate()+(dias||1)); setN(id,{estado:'pospuesta',reaparece:svLocalISO(d)}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Oculta hasta mañana; volverá a aparecer automáticamente.'); };
  window.marcarLeida = function(id){ setN(id,{estado:'leida'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); };
  window.marcarNoLeida = function(id){ setN(id,{estado:'',reaparece:null}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificación marcada como no leída.'); };
  window.marcarTodasLeidas = function(){ notifSource().forEach(function(n){ if(visibleNotif(n,(document.getElementById('notif-filtro')||{}).value||'')) setN(n.id,{estado:'leida'}); }); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificaciones visibles marcadas como leídas'); };
  window.notifAbrirAccion = function(id){
    var n=notifSource().find(function(x){return x.id===id;});
    if(!n) return;
    setN(id,{estado:'leida'});
    if(n.accion && n.accion.fn){ try{ new Function(n.accion.fn)(); }catch(e){ console.error(e); } }
  };
  window.notifAvisoCriticoEntendido=function(id){
    avanzarLoteAvisosCriticos();
    setN(id,{estado:'leida'});
    quitarTarjetaAvisoCritico(id);
    refreshNotifUI();
  };
  window.notifAvisoCriticoAbrir=function(id){
    var aviso=notifSource().find(function(item){return String(item&&item.id||'')===String(id||'');});
    if(!aviso) aviso=avisosCriticosActuales[String(id||'')];
    var paginaActiva=document.querySelector('.page.active');
    avisoCriticoGestion={
      id:String(id||''),
      origen:paginaActiva?String(paginaActiva.id||'').replace(/^page-/,''):'',
      destino:'',
      esperandoDestino:true
    };
    avanzarLoteAvisosCriticos();
    setN(id,{estado:'leida'});
    quitarTarjetaAvisoCritico(id);
    if(aviso&&aviso.accion&&aviso.accion.fn){
      try{ new Function(aviso.accion.fn)(); }catch(e){ console.error(e); }
    }
    setTimeout(function(){
      if(!avisoCriticoGestion||!avisoCriticoGestion.esperandoDestino) return;
      var activa=document.querySelector('.page.active');
      avisoCriticoGestion.destino=activa?String(activa.id||'').replace(/^page-/,''):avisoCriticoGestion.origen;
      avisoCriticoGestion.esperandoDestino=false;
    },250);
    refreshNotifUI();
  };
  window.abrirPresupuestoDesdeNotificacion = function(id){
    var presupuesto = typeof global.buscarPptoPorRef==='function' ? global.buscarPptoPorRef(id) : null;
    if(typeof global.buscarPptoPorRef==='function' && !presupuesto){
      if(typeof notify==='function') notify('El presupuesto relacionado ya no está disponible.');
      return;
    }
    showPage('presupuesto',document.querySelector('[onclick*="presupuesto"]'));
    // El detalle existe permanentemente en el DOM. Abrirlo en el mismo ciclo
    // evita mostrar primero la lista y reemplazarla 180 ms después.
    if(typeof verPpto==='function') verPpto((presupuesto&&(presupuesto.fbKey||presupuesto.id))||id);
    var contenido=document.querySelector('.content');
    if(contenido) contenido.scrollTop=0;
  };
  window.abrirOTDesdeNotificacion = function(id){
    showPage('ordentrabajo',document.querySelector('[onclick*="ordentrabajo"]'));
    setTimeout(function(){ if(typeof verOT==='function') verOT(id); },180);
  };
  window.renderNotificaciones = function(filtro){
    filtro=filtro||'';
    var lista=document.getElementById('notif-lista'), lbl=document.getElementById('notif-count-label');
    if(!lista) return;
    var rows=notifSource().filter(function(n){ return visibleNotif(n,filtro); });
    var nuevas=notifSource().filter(function(n){ var st=getN(n.id); return visibleNotif(n,'') && !st.estado; });
    if(lbl) lbl.textContent = nuevas.length ? (nuevas.length + ' nueva' + (nuevas.length!==1?'s':'') + ' / ' + rows.length + ' visible' + (rows.length!==1?'s':'')) : 'Todo al día ✓';
    if(!rows.length){ lista.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--text3)"><i class="ti ti-checks" style="font-size:32px;display:block;margin-bottom:10px"></i><div style="font-size:14px;font-weight:500">Sin notificaciones</div><div style="font-size:12px;margin-top:4px">No hay pendientes para este filtro</div></div>'; return; }
    var colorMap={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',green:'var(--green)',purple:'var(--purple)'};
    lista.innerHTML=rows.map(function(n){
      var st=getN(n.id), estado=st.estado||'nueva', c=colorMap[n.color]||'var(--text2)';
      var badge=estado==='pospuesta'?'<span class="badge b-amber">Pospuesta '+svEsc(st.reaparece||'')+'</span>':estado==='resuelta'?'<span class="badge b-green">Resuelta</span>':estado==='archivada'?'<span class="badge">Archivada</span>':estado==='leida'?'<span class="badge b-blue">Leída</span>':'<span class="badge b-red">Nueva</span>';
      var tieneAccion=!!(n.accion&&n.accion.fn);
      var act=tieneAccion?'<button class="btn btn-sm" onclick="event.stopPropagation();notifAbrirAccion(\''+svEsc(n.id)+'\')" title="Abrir el elemento relacionado">'+svEsc(n.accion.label||'Ver')+'</button>':'';
      var noLeida=estado==='leida'?'<button class="btn btn-sm" onclick="event.stopPropagation();marcarNoLeida(\''+svEsc(n.id)+'\')" title="Volver a mostrarla como pendiente"><i class="ti ti-mail"></i> Marcar no leída</button>':'';
      return '<div '+(tieneAccion?'onclick="notifAbrirAccion(\''+svEsc(n.id)+'\')" title="Abrir el elemento relacionado"':'')+' style="background:var(--bg2);border:0.5px solid '+(n.urgente?'var(--red)':'var(--border)')+';border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;opacity:'+(estado==='leida'||estado==='pospuesta'?'.75':'1')+';cursor:'+(tieneAccion?'pointer':'default')+'">'+
        '<i class="ti '+svEsc(n.icono||'ti-bell')+'" style="font-size:20px;color:'+c+';flex-shrink:0;margin-top:2px"></i>'+
        '<div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-size:13px;color:'+c+'">'+svEsc(n.titulo||'Notificación')+'</strong>'+badge+(n.urgente?'<span class="badge b-red">Urgente</span>':'')+'</div><div style="font-size:12px;color:var(--text2);line-height:1.4;margin-top:4px">'+svEsc(n.sub||'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+svEsc(n.tiempo||'')+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'+act+noLeida+'<button class="btn btn-sm" onclick="event.stopPropagation();notifPosponer(\''+svEsc(n.id)+'\',1)" title="Ocultar hasta mañana y mostrarla nuevamente"><i class="ti ti-clock"></i> Recordar mañana</button><button class="btn btn-sm" onclick="event.stopPropagation();notifResolver(\''+svEsc(n.id)+'\')" title="Quitar de pendientes sin modificar el elemento relacionado"><i class="ti ti-check"></i> Marcar resuelta</button><button class="btn btn-sm" onclick="event.stopPropagation();notifArchivar(\''+svEsc(n.id)+'\')" title="Guardar fuera de pendientes; seguirá disponible en el filtro Archivadas"><i class="ti ti-archive"></i> Archivar</button></div></div>';
    }).join('');
  };
  window.filtrarNotifs = function(tipo){ renderNotificaciones(tipo || ''); };
  window.actualizarBadgeNotif = function(){
    var count=notifSource().filter(function(n){ var st=getN(n.id); return visibleNotif(n,'') && !st.estado; }).length;
    var b=document.getElementById('notif-badge'); if(b) b.style.display=count?'block':'none';
  };
  function actualizarNotificacionesAutomaticamente(){
    if(!currentIdentity() || currentIdentity()==='local') return;
    iniciarSyncNotificaciones();
    if(typeof global.generarNotificaciones==='function') global.generarNotificaciones();
    programarAvisoCriticoPresupuesto();
  }
  document.addEventListener('sisventas:page-changed',function(event){
    var pagina=event.detail&&event.detail.page;
    if(avisoCriticoGestion&&pagina){
      if(avisoCriticoGestion.esperandoDestino){
        avisoCriticoGestion.destino=pagina;
        avisoCriticoGestion.esperandoDestino=false;
      } else if(pagina!==avisoCriticoGestion.destino){
        reanudarColaAvisosCriticos();
      }
    }
    if(event.detail&&event.detail.page==='notificaciones') actualizarNotificacionesAutomaticamente();
    programarAvisoCriticoPresupuesto();
  });
  document.addEventListener('sisventas:accion-notificacion-cerrada',reanudarColaAvisosCriticos);
  document.addEventListener('sisventas:ot-closed',reanudarColaAvisosCriticos);
  document.addEventListener('sisventas:notificaciones-actualizadas',programarAvisoCriticoPresupuesto);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible') actualizarNotificacionesAutomaticamente();
  });
  window.addEventListener('focus',actualizarNotificacionesAutomaticamente);
  vigilarAvisoCriticoPersistente();
  setInterval(actualizarNotificacionesAutomaticamente,30000);
  setTimeout(actualizarNotificacionesAutomaticamente,1000);
})(window);
