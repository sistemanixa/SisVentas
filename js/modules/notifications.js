(function initNotifications(global){
  'use strict';
  function svEsc(v){ if(typeof escapeHTML==='function') return escapeHTML(v); return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function svToday(){ return new Date().toISOString().slice(0,10); }
  function svCurrentUserName(){ return String(global.currentUserName||global.currentUser||global.currentUserEmail||'Sistema'); }
  function notifPermitidaTecnico(n){
    var txt=[n.tipo,n.titulo,n.title,n.descripcion,n.mensaje,n.body,n.modulo,n.categoria].join(' ').toLowerCase();
    var bloqueadas=['stock','presupuesto','iva','deuda','caja','tesorer','factur','proveedor','orden de compra','compra','cliente con saldo','vencimiento presupuesto'];
    if(bloqueadas.some(function(x){return txt.indexOf(x)>=0;})) return false;
    var permitidas=['ot','orden de trabajo','reclamo','soporte','garant','pago','pagado','hora extra','hs extra','comision','comisión','asignad','tecnico','técnico'];
    return permitidas.some(function(x){return txt.indexOf(x)>=0;});
  }
  function notifSource(){
    var source=Array.isArray(global.todasNotifs)?global.todasNotifs:[];
    var tecnico=global.SisVentas&&global.SisVentas.Access&&global.SisVentas.Access.is('tecnico');
    return tecnico?source.filter(notifPermitidaTecnico):source;
  }
  // Notificaciones: urgent filter + estados persistidos por usuario
  function notifStorageKey(){
    var u = String(window.currentUserEmail || window.currentUser || 'local').toLowerCase().replace(/[^a-z0-9]+/g,'_');
    return 'sv_notif_state_v3_' + u;
  }
  function nKey(id){ return String(id||'').replace(/[.#$\[\]/]/g,'_'); }
  function loadState(){ try{return JSON.parse(localStorage.getItem(notifStorageKey())||'{}')||{};}catch(e){return {};} }
  function saveState(st){ try{localStorage.setItem(notifStorageKey(), JSON.stringify(st||{}));}catch(e){} }
  function getN(id){ var st=loadState(); return st[nKey(id)]||{}; }
  function setN(id, patch){
    var st=loadState(), k=nKey(id);
    st[k]=Object.assign(st[k]||{}, patch, {updatedAt:new Date().toISOString(), usuario:svCurrentUserName()});
    saveState(st);
    if (window.fbDB && window.currentUserEmail) {
      window.fbSet(window.fbRef(window.fbDB, 'sisventas/notificaciones_estado/' + nKey(window.currentUserEmail) + '/' + k), st[k]).catch(function(){});
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
  window.notifResolver = function(id){ setN(id,{estado:'resuelta'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificación resuelta'); };
  window.notifArchivar = function(id){ setN(id,{estado:'archivada'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificación archivada'); };
  window.notifPosponer = function(id,dias){ var d=new Date(); d.setDate(d.getDate()+(dias||1)); setN(id,{estado:'pospuesta',reaparece:d.toISOString().slice(0,10)}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificación pospuesta'); };
  window.marcarLeida = function(id){ setN(id,{estado:'leida'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); };
  window.marcarTodasLeidas = function(){ notifSource().forEach(function(n){ if(visibleNotif(n,(document.getElementById('notif-filtro')||{}).value||'')) setN(n.id,{estado:'leida'}); }); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificaciones visibles marcadas como leídas'); };
  window.notifAbrirAccion = function(id){
    var n=(window.todasNotifs||[]).find(function(x){return x.id===id;});
    if(!n) return;
    setN(id,{estado:'leida'});
    if(n.accion && n.accion.fn){ try{ new Function(n.accion.fn)(); }catch(e){ console.error(e); } }
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
      var act=(n.accion&&n.accion.fn)?'<button class="btn btn-sm" onclick="notifAbrirAccion(\''+svEsc(n.id)+'\')">'+svEsc(n.accion.label||'Ver')+'</button>':'';
      return '<div style="background:var(--bg2);border:0.5px solid '+(n.urgente?'var(--red)':'var(--border)')+';border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;opacity:'+(estado==='leida'||estado==='pospuesta'?'.75':'1')+'">'+
        '<i class="ti '+svEsc(n.icono||'ti-bell')+'" style="font-size:20px;color:'+c+';flex-shrink:0;margin-top:2px"></i>'+
        '<div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-size:13px;color:'+c+'">'+svEsc(n.titulo||'Notificación')+'</strong>'+badge+(n.urgente?'<span class="badge b-red">Urgente</span>':'')+'</div><div style="font-size:12px;color:var(--text2);line-height:1.4;margin-top:4px">'+svEsc(n.sub||'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+svEsc(n.tiempo||'')+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'+act+'<button class="btn btn-sm" onclick="notifPosponer(\''+svEsc(n.id)+'\',1)"><i class="ti ti-clock"></i> Mañana</button><button class="btn btn-sm" onclick="notifResolver(\''+svEsc(n.id)+'\')"><i class="ti ti-check"></i> Resolver</button><button class="btn btn-sm" onclick="notifArchivar(\''+svEsc(n.id)+'\')"><i class="ti ti-archive"></i> Archivar</button></div></div>';
    }).join('');
  };
  window.filtrarNotifs = function(tipo){ renderNotificaciones(tipo || ''); };
  window.actualizarBadgeNotif = function(){
    var count=notifSource().filter(function(n){ var st=getN(n.id); return visibleNotif(n,'') && !st.estado; }).length;
    var b=document.getElementById('notif-badge'); if(b) b.style.display=count?'block':'none';
  };

})(window);
