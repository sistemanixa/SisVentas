
(function(){
  function money(v){ return '$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR'); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function normTxt(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
  function esc(v){ return (typeof escapeHTML==='function') ? escapeHTML(v) : String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  window._otResolverDireccionCliente = function(ot){
    var campos = ['dir','direccion','domicilio','direccionCliente','direccion_cliente','direccionInstalacion','direccion_instalacion','direccionObra','direccion_obra','ubicacion','address','calle','domicilioInstalacion'];
    function leer(o){
      if(!o) return '';
      for(var i=0;i<campos.length;i++){ var v=o[campos[i]]; if(v!==undefined && v!==null && String(v).trim()) return String(v).trim(); }
      return '';
    }
    var d = leer(ot); if(d) return d;
    var ventas = Array.isArray(window.ventasList) ? window.ventasList : [];
    var clientes = Array.isArray(window.clientesData) ? window.clientesData : Object.values(window.clientesData||{});
    var venta = null;
    if(ot && ot.ventaId){
      var vid=String(ot.ventaId||''); var vidNum=vid.replace(/\D/g,'');
      venta = ventas.find(function(v){
        var a=[v.id,v.numero,v.fbKey,v.ventaId].map(function(x){return String(x||'');});
        return a.indexOf(vid)>=0 || (vidNum && a.some(function(x){return x.replace(/\D/g,'')===vidNum;}));
      });
      d=leer(venta); if(d) return d;
    }
    var nombres=[];
    if(ot){ nombres.push(ot.cliente, ot.clienteNombre, ot.nombreCliente); }
    if(venta){ nombres.push(venta.cliente, venta.clienteNombre, venta.nombreCliente); d=leer(venta.clienteObj); if(d) return d; }
    var ids=[];
    if(ot) ids.push(ot.clienteId, ot.idCliente, ot.id_cli, ot.clienteKey);
    if(venta) ids.push(venta.clienteId, venta.idCliente, venta.id_cli, venta.clienteKey, venta.id_cli);
    ids=ids.filter(Boolean).map(String);
    if(ids.length){
      var cId=clientes.find(function(c){ return ids.indexOf(String(c.id||''))>=0 || ids.indexOf(String(c.fbKey||''))>=0 || ids.indexOf(String(c.key||''))>=0 || ids.indexOf(String(c.codigo||''))>=0; });
      d=leer(cId); if(d) return d;
    }
    var nNorm=nombres.map(normTxt).filter(Boolean);
    if(nNorm.length){
      var cli=clientes.find(function(c){
        var arr=[c.nombre, ((c.nombre||'')+' '+(c.apellidos||c.apellido||'')).trim(), c.razonSocial, c.empresa].map(normTxt);
        return arr.some(function(n){ return n && nNorm.indexOf(n)>=0; });
      });
      d=leer(cli); if(d) return d;
    }
    return '';
  };

  var _verOTOriginal = window.verOT;
  if(typeof _verOTOriginal === 'function'){
    window.verOT = function(id){
      _verOTOriginal(id);
      setTimeout(function(){
        var ot = (window.otData||[]).find(function(o){ return o.id===window.otActualId || o.fbKey===window.otActualId || o.id===id || o.fbKey===id; });
        var dir = window._otResolverDireccionCliente(ot);
        var inp = document.getElementById('ot-det-dir');
        if(inp && dir && !inp.value){ inp.value = dir; window._otDireccionActual = dir; }
        var maps = document.getElementById('ot-det-dir-maps-btn'); if(maps) maps.style.display = (inp && inp.value) ? '' : 'none';
        instalarPasosOT();
      },120);
    };
  }


  var _otPasoActual = window._otPasoActual = 0;
  var _otPasos = window._otPasos = [
    { id:'cliente',    label:'Cliente',    icon:'ti-user',         target:'ot-det-cliente' },
    { id:'ubicacion',  label:'Dirección',  icon:'ti-map-pin',      target:'ot-det-dir' },
    { id:'materiales', label:'Materiales', icon:'ti-tool',         target:'ot-materiales' },
    { id:'checklist',  label:'Checklist',  icon:'ti-list-check',   target:'checklist-preparacion' },
    { id:'fotos',      label:'Fotos',      icon:'ti-camera',       target:'ot-notas-lista' },
    { id:'finalizar',  label:'Finalizar',  icon:'ti-circle-check', target:'btn-completar-ot' },
  ];

  function _otPasoCompleto(paso) {
    var el = document.getElementById(paso.target);
    if (!el) return false;
    if (paso.id === 'cliente')    return !!(el.value && el.value.trim());
    if (paso.id === 'ubicacion')  return !!(el.value && el.value.trim());
    if (paso.id === 'checklist') {
      var checks = document.querySelectorAll('#checklist-preparacion input[type=checkbox]');
      return checks.length > 0 && Array.from(checks).every(function(c){ return c.checked; });
    }
    if (paso.id === 'materiales') {
      var mat = document.getElementById('ot-materiales');
      return mat && mat.value && mat.value.trim().length > 2;
    }
    if (paso.id === 'fotos') {
      var notas = document.getElementById('ot-notas-lista');
      return notas && notas.children && notas.children.length > 0;
    }
    return false;
  }

  window._otRenderWizard = function _otRenderWizard() {
    var bar = document.getElementById('ot-pasos-rapidos');
    if (!bar) return;
    var btns = _otPasos.map(function(p, i) {
      var completo = _otPasoCompleto(p);
      var activo   = i === _otPasoActual;
      var color = completo ? 'var(--green)' : activo ? 'var(--blue)' : 'var(--text3)';
      var bg    = activo ? 'var(--blue)' : completo ? 'rgba(61,220,132,.15)' : 'var(--bg3)';
      var border= activo ? '2px solid var(--blue)' : completo ? '1.5px solid var(--green)' : '1px solid var(--border)';
      return '<button onclick="otPasoIr('+i+')" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:'+border+';border-radius:8px;background:'+bg+';color:'+color+';cursor:pointer;font-size:12px;font-weight:'+(activo?'700':'500')+';white-space:nowrap;font-family:inherit">'+
        (completo ? '<i class="ti ti-circle-check" style="font-size:14px"></i>' : '<i class="ti '+p.icon+'" style="font-size:14px"></i>')+
        '<span>'+(i+1)+'. '+p.label+'</span>'+
      '</button>';
    }).join('<span style="color:var(--border);font-size:16px">›</span>');

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+btns+'</div>'+
      '<div style="margin-top:8px;height:3px;background:var(--bg3);border-radius:2px">'+
        '<div style="height:3px;background:var(--blue);border-radius:2px;transition:width .3s;width:'+
          Math.round((_otPasoActual/(_otPasos.length-1))*100)+'%"></div>'+
      '</div>';
  }

  function instalarPasosOT(){
    var view=document.getElementById('ot-detalle-view');
    if(!view || document.getElementById('ot-pasos-rapidos')) return;
    var aviso=document.getElementById('ot-aviso-cambio-externo');
    var bar=document.createElement('div');
    bar.id='ot-pasos-rapidos';
    bar.className='card';
    bar.style.cssText='padding:12px 14px;margin-bottom:12px;position:sticky;top:0;z-index:4';
    if(aviso && aviso.parentNode) aviso.parentNode.insertBefore(bar,aviso.nextSibling);
    else view.insertBefore(bar,view.firstChild);
    _otPasoActual = 0;
    window._otRenderWizard();
  }

  window.otPasoIr = function(idx) {
    if (typeof idx === 'string') {
      idx = _otPasos.findIndex(function(p){ return p.id === idx; });
    }
    if (idx < 0 || idx >= _otPasos.length) return;
    _otPasoActual = window._otPasoActual = idx;
    var p = _otPasos[idx];
    var el = document.getElementById(p.target);
    if (el) {
      (el.closest('.card') || el).scrollIntoView({behavior:'smooth', block:'start'});
      setTimeout(function(){
        if (el.focus && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.focus();
      }, 400);
    }
    window._otRenderWizard();
    // Auto-avanzar si hay más pasos
    setTimeout(function(){
      window._otRenderWizard(); // re-render para mostrar estado actualizado
    }, 1000);
  };

  // Re-renderizar el wizard cuando cambian los campos
  document.addEventListener('input', function(e){
    if (document.getElementById('ot-pasos-rapidos') && e.target.closest('#ot-detalle-view')) {
      setTimeout(window._otRenderWizard, 200);
    }
  });
  document.addEventListener('change', function(e){
    if (document.getElementById('ot-pasos-rapidos') && e.target.closest('#ot-detalle-view')) {
      setTimeout(window._otRenderWizard, 200);
    }
  });
  function loadNotifState(){ try{return JSON.parse(localStorage.getItem('sv_notif_state_v2')||'{}')||{};}catch(e){return {};} }
  function saveNotifState(st){ try{localStorage.setItem('sv_notif_state_v2',JSON.stringify(st||{}));}catch(e){} }
  function key(id){ return (typeof _sanitizarKeyFirebase==='function') ? _sanitizarKeyFirebase(id) : String(id||'').replace(/[.#$\[\]/]/g,'_'); }
  function getState(id){ var st=loadNotifState(); return st[key(id)]||{}; }
  function setState(id, patch){ var st=loadNotifState(); var k=key(id); st[k]=Object.assign(st[k]||{},patch,{updatedAt:new Date().toISOString(), usuario:window.currentUser||window.currentUserName||'Sistema'}); saveNotifState(st); }
  function visiblePorEstado(n, filtro){
    var s=getState(n.id), est=s.estado||'';
    if(filtro==='pospuestas') return est==='pospuesta';
    if(filtro==='resueltas') return est==='resuelta';
    if(filtro==='archivadas') return est==='archivada';
    if(est==='archivada' || est==='resuelta') return false;
    if(est==='pospuesta' && s.reaparece && s.reaparece > todayISO()) return false;
    return true;
  }
  function accionNotif(n){
    if(n.accion && n.accion.fn) return '<button class="btn btn-sm" onclick="notifAbrirAccion(\''+esc(n.id)+'\')">'+esc(n.accion.label||'Ver')+'</button>';
    return '';
  }
  window.notifAbrirAccion=function(id){ var n=(window.todasNotifs||[]).find(function(x){return x.id===id;}); if(n && n.accion && n.accion.fn){ setState(id,{estado:'leida'}); try{ new Function(n.accion.fn)(); }catch(e){ console.error(e); } } };
  window.notifResolver=function(id){ setState(id,{estado:'resuelta'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); actualizarBadgeNotif(); notify('Notificación resuelta'); };
  window.notifArchivar=function(id){ setState(id,{estado:'archivada'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); actualizarBadgeNotif(); notify('Notificación archivada'); };
  window.notifPosponer=function(id,dias){ var d=new Date(); d.setDate(d.getDate()+(dias||1)); setState(id,{estado:'pospuesta',reaparece:d.toISOString().slice(0,10)}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); actualizarBadgeNotif(); notify('Notificación pospuesta'); };

  window.renderNotificaciones = function(filtro){
    var lista=document.getElementById('notif-lista'), lbl=document.getElementById('notif-count-label'); if(!lista) return;
    filtro=filtro||'';
    var modulo={stock:'productos', presupuesto:'presupuesto', deuda:'cobranzas', ot:'ordenes_trabajo', gasto:'gastos'};
    var bloqueados=((window.PERMISOS_ROLES&&PERMISOS_ROLES[currentRole])||(window.PERMISOS_DEFAULT&&PERMISOS_DEFAULT[currentRole])||{bloqueados:[]}).bloqueados||[];
    var rows=(window.todasNotifs||[]).filter(function(n){
      if(filtro && !['pospuestas','resueltas','archivadas'].includes(filtro) && n.tipo!==filtro) return false;
      var m=modulo[n.tipo]; if(m && bloqueados.includes(m)) return false;
      return visiblePorEstado(n,filtro);
    });
    var activas=(window.todasNotifs||[]).filter(function(n){ return visiblePorEstado(n,'') && !getState(n.id).estado; });
    if(lbl) lbl.textContent = activas.length ? activas.length+' nueva'+(activas.length!==1?'s':'')+' / '+rows.length+' visible'+(rows.length!==1?'s':'') : 'Todo al día ✓';
    if(!rows.length){ lista.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--text3)"><i class="ti ti-checks" style="font-size:32px;display:block;margin-bottom:10px"></i><div style="font-size:14px;font-weight:500">Sin notificaciones</div><div style="font-size:12px;margin-top:4px">No hay pendientes para este filtro</div></div>'; return; }
    var colorMap={red:'var(--red)',amber:'var(--amber)',blue:'var(--blue)',green:'var(--green)',purple:'var(--purple)'};
    lista.innerHTML=rows.map(function(n){
      var st=getState(n.id), est=st.estado||'nueva', c=colorMap[n.color]||'var(--text2)';
      var muted=(est==='leida'||est==='pospuesta');
      var badge=est==='pospuesta' ? '<span class="badge b-amber">Pospuesta '+esc(st.reaparece||'')+'</span>' : est==='resuelta' ? '<span class="badge b-green">Resuelta</span>' : est==='archivada' ? '<span class="badge">Archivada</span>' : est==='leida' ? '<span class="badge b-blue">Leída</span>' : '<span class="badge b-red">Nueva</span>';
      return '<div style="background:var(--bg2);border:0.5px solid '+(n.urgente?'var(--red)':'var(--border)')+';border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start;opacity:'+(muted?'.75':'1')+'">'+
        '<i class="ti '+esc(n.icono)+'" style="font-size:20px;color:'+c+';flex-shrink:0;margin-top:2px"></i>'+
        '<div style="flex:1;min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-size:13px;color:'+c+'">'+esc(n.titulo)+'</strong>'+badge+(n.urgente?'<span class="badge b-red">Urgente</span>':'')+'</div>'+
        '<div style="font-size:12px;color:var(--text2);line-height:1.4;margin-top:4px">'+esc(n.sub)+'</div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+esc(n.tiempo||'')+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'+accionNotif(n)+'<button class="btn btn-sm" onclick="notifPosponer(\''+esc(n.id)+'\',1)"><i class="ti ti-clock"></i> Mañana</button><button class="btn btn-sm" onclick="notifResolver(\''+esc(n.id)+'\')"><i class="ti ti-check"></i> Resolver</button><button class="btn btn-sm btn-icon" title="Archivar" onclick="notifArchivar(\''+esc(n.id)+'\')"><i class="ti ti-archive"></i></button></div></div>';
    }).join('');
    if(typeof renderConfigAlertas==='function') renderConfigAlertas();
  };
  window.marcarLeida=function(id){ setState(id,{estado:'leida'}); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); actualizarBadgeNotif(); };
  window.marcarTodasLeidas=function(){ (window.todasNotifs||[]).forEach(function(n){ if(visiblePorEstado(n,'')) setState(n.id,{estado:'leida'}); }); renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); actualizarBadgeNotif(); notify('Notificaciones visibles marcadas como leídas'); };
  window.actualizarBadgeNotif=function(){ var badge=document.getElementById('notif-badge'); var c=(window.todasNotifs||[]).filter(function(n){return visiblePorEstado(n,'') && !getState(n.id).estado;}).length; if(badge) badge.style.display=c?'block':'none'; };
  window._tesoreriaPagos=function(){
    var out=[];
    (window.gastosData||[]).forEach(function(g){
      var pagos=(typeof _gastoPagosArray==='function') ? _gastoPagosArray(g) : (Array.isArray(g.pagos)?g.pagos:[]);
      pagos.forEach(function(p,i){ out.push(Object.assign({},p,{ gastoKey:g.fbKey, gastoDesc:g.descripcion||'', categoria:g.categoria||'', montoGasto:g.monto||0, loteId:p.loteId||p.pagoId||p.pgId||'', _idx:i })); });
    });
    return out.sort(function(a,b){ return String(b.fecha||'').localeCompare(String(a.fecha||'')); });
  };
  window.renderTesoreria=function(){
    var el=document.getElementById('tes-lista'); if(!el) return;
    var q=normTxt((document.getElementById('tes-buscar')||{}).value||''), medio=(document.getElementById('tes-medio')||{}).value||'', per=(document.getElementById('tes-periodo')||{}).value||'mes';
    var now=new Date(), ym=now.toISOString().slice(0,7); var prev=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
    var pagos=window._tesoreriaPagos().filter(function(p){
      var fecha=String(p.fecha||''); if(per==='mes' && fecha.slice(0,7)!==ym) return false; if(per==='anterior' && fecha.slice(0,7)!==prev) return false;
      if(medio && String(p.medio||'')!==medio) return false;
      if(q && !normTxt([p.gastoDesc,p.medio,p.usuario,p.loteId].join(' ')).includes(q)) return false;
      return true;
    });
    var total=pagos.reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0), transfer=pagos.filter(function(p){return /trans/i.test(p.medio||'');}).reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0), efectivo=pagos.filter(function(p){return /efect/i.test(p.medio||'');}).reduce(function(s,p){return s+(parseFloat(p.monto)||0);},0), comp=pagos.filter(function(p){return p.comprobante&&p.comprobante.data;}).length;
    var ids=['tes-met-mes','tes-met-transfer','tes-met-efectivo','tes-met-comp']; var vals=[money(total),money(transfer),money(efectivo),comp]; ids.forEach(function(id,i){var x=document.getElementById(id); if(x)x.textContent=vals[i];});
    if(!pagos.length){ el.innerHTML='<div style="text-align:center;color:var(--text3);padding:24px">Sin pagos para mostrar</div>'; return; }
    el.innerHTML=pagos.map(function(p){
      var compBtn=(p.comprobante&&p.comprobante.data)?'<button class="btn btn-sm" onclick="tesVerComprobante(\''+esc(p.gastoKey)+'\','+p._idx+')"><i class="ti ti-paperclip"></i> Comprobante</button>':'<span style="font-size:12px;color:var(--text3)">Sin comprobante</span>';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg3);border-radius:var(--radius);padding:12px 14px;flex-wrap:wrap"><div><div style="font-size:13px;font-weight:600">'+money(p.monto)+' · '+esc(p.medio||'—')+' '+(p.loteId?'<span class="badge b-blue">'+esc(p.loteId)+'</span>':'')+'</div><div style="font-size:12px;color:var(--text2);margin-top:3px">'+esc(p.gastoDesc||'—')+'</div><div style="font-size:11px;color:var(--text3);margin-top:3px">'+esc((p.fecha||'').split('-').reverse().join('/')||'')+' · '+esc(p.usuario||'Sistema')+'</div></div><div>'+compBtn+'</div></div>';
    }).join('');
  };
  window.tesVerComprobante=function(gastoKey,idx){ if(typeof abrirComprobantePago==='function') abrirComprobantePago(gastoKey,idx); };

  document.addEventListener('sisventas:page-changed',function(event){
    var page=event.detail&&event.detail.page;
    setTimeout(function(){ if(page==='tesoreria') renderTesoreria(); if(page==='notificaciones') renderNotificaciones((document.getElementById('notif-filtro')||{}).value||''); },80);
  });
})();
