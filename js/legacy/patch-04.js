
(function(){
  function svEsc(v){
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function svNorm(v){
    return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function svMoney(v){
    return (typeof money === 'function') ? money(v) : '$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR');
  }
  function svToday(){ return new Date().toISOString().slice(0,10); }
  function svMes(offset){
    var d = new Date(); d.setMonth(d.getMonth() + (offset||0));
    return d.toISOString().slice(0,7);
  }
  function svArray(x){
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.values(x);
    return [];
  }
  function svCurrentUserName(){
    return String(window.currentUserName || window.currentUser || window.currentUserEmail || 'Sistema');
  }
  // OT: dirección robusta + no falso aviso + regreso al listado
  var DIR_FIELDS = [
    'dir','direccion','domicilio','domicilioCliente','direccionCliente','direccion_cliente',
    'direccionInstalacion','direccion_instalacion','direccionObra','direccion_obra','ubicacion',
    'address','calle','domicilioInstalacion','direccionServicio','direccion_servicio',
    'instalacionDireccion','instalacion_direccion','lugarInstalacion','lugar_instalacion'
  ];
  function pickDireccion(obj){
    if (!obj) return '';
    for (var i=0;i<DIR_FIELDS.length;i++) {
      var v = obj[DIR_FIELDS[i]];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    // Algunas fichas guardan dirección dentro de subobjetos.
    var sub = ['cliente','clienteObj','clienteData','clienteInfo','datosCliente','instalacion','obra','direccionData'];
    for (var j=0;j<sub.length;j++) {
      if (obj[sub[j]] && typeof obj[sub[j]] === 'object') {
        var d = pickDireccion(obj[sub[j]]);
        if (d) return d;
      }
    }
    return '';
  }
  function ventaRelacionada(ot){
    var ventas = svArray(window.ventasList);
    if (!ot) return null;
    var ids = [ot.ventaId, ot.venta, ot.idVenta, ot.ventaFbKey, ot.ventaKey].filter(Boolean).map(String);
    var nums = ids.map(function(x){return x.replace(/\D/g,'');}).filter(Boolean);
    return ventas.find(function(v){
      var arr = [v.fbKey,v.id,v.numero,v.ventaId,v.nro,v.codigo].filter(Boolean).map(String);
      var arrNum = arr.map(function(x){return x.replace(/\D/g,'');});
      return arr.some(function(x){return ids.indexOf(x)>=0;}) || arrNum.some(function(x){return x && nums.indexOf(x)>=0;});
    }) || null;
  }
  function clienteRelacionado(ot, venta){
    var clientes = svArray(window.clientesData);
    var ids=[];
    [ot,venta].forEach(function(o){ if(!o) return; ids.push(o.clienteId,o.idCliente,o.id_cli,o.clienteKey,o.clienteFbKey,o.fbKeyCliente); });
    ids = ids.filter(Boolean).map(String);
    if (ids.length) {
      var c = clientes.find(function(cli){
        var arr=[cli.fbKey,cli.key,cli.id,cli.codigo,cli.nroCliente].filter(Boolean).map(String);
        return arr.some(function(x){return ids.indexOf(x)>=0;});
      });
      if (c) return c;
    }
    var names=[];
    [ot,venta].forEach(function(o){ if(!o) return; names.push(o.cliente,o.clienteNombre,o.nombreCliente,o.razonSocial,o.empresa); });
    var nn = names.map(svNorm).filter(Boolean);
    if (nn.length) {
      return clientes.find(function(cli){
        var arr=[cli.nombre,cli.apellido,cli.apellidos,((cli.nombre||'')+' '+(cli.apellido||cli.apellidos||'')).trim(),cli.razonSocial,cli.razon_social,cli.empresa].map(svNorm).filter(Boolean);
        return arr.some(function(n){ return nn.indexOf(n)>=0; });
      }) || null;
    }
    return null;
  }
  window._otResolverDireccionCliente = function(ot){
    ot = ot || {};
    var d = pickDireccion(ot); if (d) return d;
    var v = ventaRelacionada(ot);
    d = pickDireccion(v); if (d) return d;
    var c = clienteRelacionado(ot, v);
    d = pickDireccion(c); if (d) return d;
    return '';
  };
  function guardarDireccionResuelta(ot, dir){
    if (!ot || !dir || !window.fbDB || !ot.fbKey) return;
    if (pickDireccion(ot)) return;
    window._otGuardandoLocalHasta = Date.now() + 4000;
    window.fbUpdate(window.fbRef(window.fbDB, (window.FB_PATHS&&FB_PATHS.ordenesTrabajo?FB_PATHS.ordenesTrabajo:'sisventas/ordenesTrabajo') + '/' + ot.fbKey), {
      dir: dir,
      direccion: dir,
      usuarioUltimaEdicion: svCurrentUserName(),
      tsUltimaEdicion: Date.now()
    }).catch(function(e){ console.warn('[OT] No se pudo guardar dirección resuelta', e); });
  }
  var _sv269_verOT = window.verOT;
  if (typeof _sv269_verOT === 'function') {
    window.verOT = function(id){
      var r = _sv269_verOT.apply(this, arguments);
      setTimeout(function(){
        var ot = svArray(window.otData).find(function(o){ return o && (o.fbKey===window.otActualId || o.id===window.otActualId || o.fbKey===id || o.id===id); });
        var dir = window._otResolverDireccionCliente(ot);
        var inp = document.getElementById('ot-det-dir');
        if (inp) {
          var actual = String(inp.value||'').trim();
          if (dir && (!actual || actual==='—' || actual==='Sin dirección')) {
            inp.value = dir;
            window._otDireccionActual = dir;
            guardarDireccionResuelta(ot, dir);
          }
          inp.placeholder = dir ? '' : 'Sin dirección cargada en la ficha del cliente';
        }
        var maps = document.getElementById('ot-det-dir-maps-btn');
        if (maps) maps.style.display = (inp && inp.value) ? '' : 'none';
        if (typeof instalarPasosOT === 'function') instalarPasosOT();
      }, 250);
      return r;
    };
  }
  ['actualizarOT','actualizarOTFecha','otAgregarNota','otAgregarFoto','toggleCheckOT'].forEach(function(fn){
    var old = window[fn];
    if (typeof old === 'function') {
      window[fn] = function(){
        window._otGuardandoLocalHasta = Date.now() + 4000;
        return old.apply(this, arguments);
      };
    }
  });
  var _sv269_completarOT = window.completarOT;
  if (typeof _sv269_completarOT === 'function') {
    window.completarOT = function(){
      window._otGuardandoLocalHasta = Date.now() + 5000;
      var r = _sv269_completarOT.apply(this, arguments);
      setTimeout(function(){
        var det = document.getElementById('ot-detalle-view');
        var list = document.getElementById('ot-list-view');
        if (det && det.style.display !== 'none') {
          var ot = svArray(window.otData).find(function(o){return o && (o.fbKey===window.otActualId || o.id===window.otActualId);});
          if (ot && ot.estado === 'completada' && typeof volverListaOT === 'function') volverListaOT();
        }
        if (list && list.style.display !== 'none' && typeof renderOTTabla === 'function') renderOTTabla();
      }, 900);
      return r;
    };
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
  window.marcarTodasLeidas = function(){ (window.todasNotifs||[]).forEach(function(n){ if(visibleNotif(n,(document.getElementById('notif-filtro')||{}).value||'')) setN(n.id,{estado:'leida'}); }); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); if(typeof actualizarBadgeNotif==='function') actualizarBadgeNotif(); if(typeof notify==='function') notify('Notificaciones visibles marcadas como leídas'); };
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
    var rows=(window.todasNotifs||[]).filter(function(n){ return visibleNotif(n,filtro); });
    var nuevas=(window.todasNotifs||[]).filter(function(n){ var st=getN(n.id); return visibleNotif(n,'') && !st.estado; });
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
    var count=(window.todasNotifs||[]).filter(function(n){ var st=getN(n.id); return visibleNotif(n,'') && !st.estado; }).length;
    var b=document.getElementById('notif-badge'); if(b) b.style.display=count?'block':'none';
  };
  // Tesorería: consolidar pagos desde gastos y movimiento de empleado cargado
  function pagosArray(obj){
    var p = obj && obj.pagos ? obj.pagos : {};
    if (Array.isArray(p)) return p.map(function(x,i){return Object.assign({_idx:i},x||{});});
    return Object.keys(p||{}).map(function(k){ return Object.assign({_key:k}, p[k]||{}); });
  }
  var _sv269_tesPagosPrev = window._tesoreriaPagos;
  window._tesoreriaPagos = function(){
    var out=[];
    svArray(window.gastosData).forEach(function(g){
      pagosArray(g).forEach(function(p,i){
        out.push(Object.assign({},p,{origen:'gasto',gastoKey:g.fbKey,gastoDesc:g.descripcion||g.desc||'',categoria:g.categoria||'',montoGasto:g.monto||0,loteId:p.loteId||p.pagoId||p.pgId||'',_idx:i,empleadoId:g.empleadoId||'',empleadoNombre:g.empleadoNombre||''}));
      });
    });
    svArray(window.movsEmpData).forEach(function(m){
      if (m._fuente === 'gastos') return;
      pagosArray(m).forEach(function(p,i){
        out.push(Object.assign({},p,{origen:'ctaemp',gastoKey:m.gastoFbKey||m.fbKey,gastoDesc:m.descripcion||m.desc||m.detalle||m.tipo||'',categoria:m.tipo||'',montoGasto:m.monto||0,loteId:p.loteId||p.pagoId||p.pgId||'',_idx:i,empleadoId:window.ctaEmpActual||'',empleadoNombre:''}));
      });
    });
    var seen={};
    return out.filter(function(p){
      var k=[p.origen,p.gastoKey,p._idx,p._key,p.fecha,p.monto,p.loteId].join('|');
      if(seen[k]) return false; seen[k]=1; return true;
    }).sort(function(a,b){ return String(b.fecha||'').localeCompare(String(a.fecha||'')) || ((b.ts||0)-(a.ts||0)); });
  };
  // Reforzar título al abrir Tesorería aunque el mapa original no la tuviera.
  var _sv269_showPage = window.showPage;
  if (typeof _sv269_showPage === 'function') {
    window.showPage = function(page, el){
      var r = _sv269_showPage.apply(this, arguments);
      setTimeout(function(){
        if(page==='tesoreria'){
          var t=document.getElementById('page-title'); if(t) t.textContent='Tesorería';
          if(typeof renderTesoreria==='function') renderTesoreria();
        }
        if(page==='notificaciones'){
          if(typeof generarNotificaciones==='function') generarNotificaciones();
          else if(typeof renderNotificaciones==='function') renderNotificaciones((document.getElementById('notif-filtro')||{}).value||'');
        }
      },120);
      return r;
    };
  }
})();
