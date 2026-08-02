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
  var avisoCriticoActual=null;
  function getN(id){ return notifState[nKey(id)]||{}; }
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
  function mostrarAvisoCriticoPresupuesto(){
    var existente=document.getElementById('modal-aviso-critico-presupuesto');
    var ctx=sessionContext();
    if(avisoCriticoGestion){ if(existente) existente.remove(); return; }
    if(!ctx.usuario||!ctx.rol||document.getElementById('modal-comunicado-global')){
      if(document.getElementById('modal-comunicado-global')) programarAvisoCriticoPresupuesto();
      return;
    }
    var pendientes=avisosCriticosPendientes();
    var aviso=pendientes[0];
    // Una vez visible, un aviso importante no puede desaparecer porque la
    // sincronización periódica reconstruya momentáneamente la lista vacía.
    // Sólo una acción explícita del usuario (abrir o cerrar con la cruz) lo
    // marca como leído y permite retirarlo.
    if(existente){
      var idExistente=String(existente.dataset.notificacionId||'');
      if(idExistente&&!getN(idExistente).estado) return;
      existente.remove();
      avisoCriticoActual=null;
    }
    if(!aviso){ avisoCriticoLote=null; return; }
    avisoCriticoActual=aviso;
    var aprobado=String(aviso.id).indexOf('ppto_aprobado_int_')===0;
    var lote=iniciarLoteAvisosCriticos();
    var posicion=Math.min(lote.total,lote.atendidos+1);
    var color=aprobado?'var(--green)':(aviso.urgente?'var(--red)':'var(--amber)');
    var fondo=aprobado?'var(--green-bg)':(aviso.urgente?'var(--red-bg)':'var(--amber-bg)');
    var overlay=document.createElement('div');
    overlay.id='modal-aviso-critico-presupuesto';
    overlay.dataset.notificacionId=String(aviso.id);
    overlay.style.cssText='position:fixed;inset:0;z-index:100150;background:rgba(3,6,14,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML='<div role="alertdialog" aria-modal="true" style="position:relative;width:min(540px,100%);background:var(--bg2);border:1px solid '+color+';border-radius:20px;box-shadow:0 28px 90px rgba(0,0,0,.62);padding:24px">'+
      '<button type="button" aria-label="Marcar como leída y cerrar" title="Marcar como leída" onclick="notifAvisoCriticoEntendido(\''+svEsc(aviso.id)+'\')" style="position:absolute;top:13px;right:13px;width:34px;height:34px;border:0;border-radius:10px;background:var(--bg3);color:var(--text2);display:flex;align-items:center;justify-content:center;cursor:pointer"><i class="ti ti-x" style="font-size:19px"></i></button>'+
      '<div style="width:56px;height:56px;border-radius:18px;background:'+fondo+';color:'+color+';display:flex;align-items:center;justify-content:center;margin-bottom:17px"><i class="ti '+svEsc(aviso.icono||'ti-file-description')+'" style="font-size:27px"></i></div>'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:20px;font-weight:800;line-height:1.25">'+svEsc(aviso.titulo||'Aviso importante')+'</div>'+(aviso.urgente?'<span class="badge b-red">Urgente</span>':'')+(lote.total>1?'<span class="badge b-blue">Aviso '+posicion+' de '+lote.total+'</span>':'')+'</div>'+ 
      '<div style="font-size:14px;color:var(--text2);line-height:1.55;padding:14px 15px;background:var(--bg3);border:.5px solid var(--border);border-radius:var(--radius);margin-bottom:18px">'+svEsc(aviso.sub||'')+'</div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn btn-primary" onclick="notifAvisoCriticoAbrir(\''+svEsc(aviso.id)+'\')"><i class="ti ti-external-link"></i> '+svEsc((aviso.accion&&aviso.accion.label)||'Abrir')+'</button></div>'+
    '</div>';
    document.body.appendChild(overlay);
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
    if(typeof notifStateUnsubscribe==='function'){
      try{ notifStateUnsubscribe(); }catch(e){}
    }
    notifStateUnsubscribe=null;
    notifStateUser='';
    notifState={};
    avisoCriticoGestion=null;
    avisoCriticoLote=null;
    avisoCriticoActual=null;
  };
  function setN(id, patch){
    var k=nKey(id);
    notifState[k]=Object.assign(notifState[k]||{},patch,{updatedAt:new Date().toISOString(),usuario:svCurrentUserName()});
    saveState(notifState);
    iniciarSyncNotificaciones();
    var identity=currentIdentity();
    if (window.fbDB && identity && identity !== 'local') {
      window.fbSet(window.fbRef(window.fbDB,'sisventas/notificaciones_estado/'+nKey(identity)+'/'+k),notifState[k]).catch(function(error){console.error('[Notificaciones] Error guardando estado',error);});
    }
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
    var modal=document.getElementById('modal-aviso-critico-presupuesto');
    if(modal) modal.remove();
    avisoCriticoActual=null;
    refreshNotifUI();
  };
  window.notifAvisoCriticoAbrir=function(id){
    var aviso=notifSource().find(function(item){return String(item&&item.id||'')===String(id||'');});
    if(!aviso&&avisoCriticoActual&&String(avisoCriticoActual.id||'')===String(id||'')) aviso=avisoCriticoActual;
    var paginaActiva=document.querySelector('.page.active');
    avisoCriticoGestion={
      id:String(id||''),
      origen:paginaActiva?String(paginaActiva.id||'').replace(/^page-/,''):'',
      destino:'',
      esperandoDestino:true
    };
    avanzarLoteAvisosCriticos();
    var modal=document.getElementById('modal-aviso-critico-presupuesto');
    if(modal) modal.remove();
    setN(id,{estado:'leida'});
    avisoCriticoActual=null;
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
    showPage('presupuesto',document.querySelector('[onclick*="presupuesto"]'));
    setTimeout(function(){ if(typeof verPpto==='function') verPpto(id); },180);
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
      return '<div '+(tieneAccion?'onclick="notifAbrirAccion(\''+svEsc(n.id)+'\')" title="Abrir el elemento relacionado"':'')+' style="background:var(--bg2);border:0.5px solid '+(n.urgente?'var(--red)':'var(--border)')+';border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;opacity:'+(estado==='leida'||estado==='pospuesta'?'.75':'1')+';cursor:'+(tieneAccion?'pointer':'default')+'">'+
        '<i class="ti '+svEsc(n.icono||'ti-bell')+'" style="font-size:20px;color:'+c+';flex-shrink:0;margin-top:2px"></i>'+
        '<div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-size:13px;color:'+c+'">'+svEsc(n.titulo||'Notificación')+'</strong>'+badge+(n.urgente?'<span class="badge b-red">Urgente</span>':'')+'</div><div style="font-size:12px;color:var(--text2);line-height:1.4;margin-top:4px">'+svEsc(n.sub||'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+svEsc(n.tiempo||'')+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'+act+'<button class="btn btn-sm" onclick="event.stopPropagation();notifPosponer(\''+svEsc(n.id)+'\',1)" title="Ocultar hasta mañana y mostrarla nuevamente"><i class="ti ti-clock"></i> Recordar mañana</button><button class="btn btn-sm" onclick="event.stopPropagation();notifResolver(\''+svEsc(n.id)+'\')" title="Quitar de pendientes sin modificar el elemento relacionado"><i class="ti ti-check"></i> Marcar resuelta</button><button class="btn btn-sm" onclick="event.stopPropagation();notifArchivar(\''+svEsc(n.id)+'\')" title="Guardar fuera de pendientes; seguirá disponible en el filtro Archivadas"><i class="ti ti-archive"></i> Archivar</button></div></div>';
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
  });
  document.addEventListener('sisventas:accion-notificacion-cerrada',reanudarColaAvisosCriticos);
  document.addEventListener('sisventas:ot-closed',reanudarColaAvisosCriticos);
  document.addEventListener('sisventas:notificaciones-actualizadas',programarAvisoCriticoPresupuesto);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible') actualizarNotificacionesAutomaticamente();
  });
  window.addEventListener('focus',actualizarNotificacionesAutomaticamente);
  setInterval(actualizarNotificacionesAutomaticamente,30000);
  setTimeout(actualizarNotificacionesAutomaticamente,1000);
})(window);
