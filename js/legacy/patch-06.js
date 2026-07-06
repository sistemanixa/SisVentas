(function(){
  'use strict';

  function norm294(s){
    return String(s || '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ');
  }
  function dirVacia294(v){
    var n = norm294(v);
    return !n || n === '-' || n === '—' || n === 'sin definir' || n === 'sin direccion' || n === 'sin dirección' || n === 'no definido' || n === 'no cargado' || n === 'undefined' || n === 'null';
  }
  function arrClientes294(){ return Array.isArray(window.clientesData) ? window.clientesData : Object.values(window.clientesData || {}); }
  function arrVentas294(){ return Array.isArray(window.ventasList) ? window.ventasList : Object.values(window.ventasList || {}); }
  function esc294(s){
    if (typeof escapeHTML === 'function') return escapeHTML(s);
    return String(s || '').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }

  function leerDir294(obj){
    if(!obj) return '';
    var campos = ['direccionInstalacion','direccion_instalacion','direccion','domicilio','direccionCliente','clienteDireccion','ubicacion','dir'];
    for(var i=0;i<campos.length;i++){
      var v = obj[campos[i]];
      if(!dirVacia294(v)) return String(v).trim();
    }
    if(obj.cliente && typeof obj.cliente === 'object') return leerDir294(obj.cliente);
    if(obj.clienteObj && typeof obj.clienteObj === 'object') return leerDir294(obj.clienteObj);
    return '';
  }

  window._otResolverDireccionCliente = function(ot){
    ot = ot || {};
    var d = leerDir294(ot);
    if(d) return d;

    var venta = null;
    var ventaId = String(ot.ventaId || ot.idVenta || ot.venta || '').trim();
    if(ventaId){
      var ventaIdNum = ventaId.replace(/\D/g,'');
      venta = arrVentas294().find(function(v){
        var ids = [v.id, v.numero, v.fbKey, v.ventaId, v.nro, v.codigo].map(function(x){ return String(x || ''); });
        return ids.indexOf(ventaId) >= 0 || (ventaIdNum && ids.some(function(x){ return String(x).replace(/\D/g,'') === ventaIdNum; }));
      }) || null;
      d = leerDir294(venta);
      if(d) return d;
    }

    var ids = [];
    [ot, venta].forEach(function(o){
      if(!o) return;
      ids.push(o.clienteId, o.idCliente, o.id_cli, o.clienteKey, o.id_cliente, o.clienteFbKey);
    });
    ids = ids.filter(Boolean).map(String);
    if(ids.length){
      var cId = arrClientes294().find(function(c){
        return ids.indexOf(String(c.id || '')) >= 0 || ids.indexOf(String(c.fbKey || '')) >= 0 || ids.indexOf(String(c.key || '')) >= 0 || ids.indexOf(String(c.codigo || '')) >= 0;
      });
      d = leerDir294(cId);
      if(d) return d;
    }

    var nombres = [];
    [ot, venta].forEach(function(o){
      if(!o) return;
      nombres.push(o.cliente, o.clienteNombre, o.nombreCliente, o.razonSocial);
    });
    var nNorm = nombres.map(norm294).filter(Boolean);
    if(nNorm.length){
      var cli = arrClientes294().find(function(c){
        var arr = [c.nombre, ((c.nombre || '') + ' ' + (c.apellidos || c.apellido || '')).trim(), c.razonSocial, c.empresa, c.cliente]
          .map(norm294).filter(Boolean);
        return arr.some(function(n){ return nNorm.indexOf(n) >= 0; });
      });
      d = leerDir294(cli);
      if(d) return d;
    }
    return '';
  };

  function otActual294(id){
    var actual = String(id || window.otActualId || '');
    return (window.otData || []).find(function(o){
      return String(o.fbKey || '') === actual || String(o.id || '') === actual || String(o.fbKey || '') === String(window.otActualId || '') || String(o.id || '') === String(window.otActualId || '');
    }) || null;
  }

  function setDireccion294(ot){
    var inp = document.getElementById('ot-det-dir');
    if(!inp) return '';
    var dir = window._otResolverDireccionCliente(ot);
    if(!dirVacia294(dir) && dirVacia294(inp.value)) inp.value = dir;
    if(dirVacia294(inp.value)) inp.value = '';
    window._otDireccionActual = inp.value || '';
    var btn = document.getElementById('ot-det-dir-maps-btn');
    if(btn) btn.style.display = inp.value ? '' : 'none';
    return inp.value;
  }

  var genOriginal294 = window.generarOTdesdeVenta;
  if(typeof genOriginal294 === 'function'){
    window.generarOTdesdeVenta = function(ventaId, cliente, dir){
      if(dirVacia294(dir)){
        var venta = arrVentas294().find(function(v){ return String(v.id || '') === String(ventaId) || String(v.numero || '') === String(ventaId) || String(v.fbKey || '') === String(ventaId); }) || null;
        dir = window._otResolverDireccionCliente({ ventaId: ventaId, cliente: cliente, clienteId: venta && (venta.clienteId || venta.idCliente || venta.id_cli), ventaObj: venta });
      }
      return genOriginal294.call(this, ventaId, cliente, dirVacia294(dir) ? '' : dir);
    };
  }

  var pasos294 = [
    { id:'cliente',    titulo:'Cliente y ubicación', selector:'#ot-det-venta, #ot-det-cliente, #ot-det-dir' },
    { id:'materiales', titulo:'Materiales',          selector:'#ot-materiales' },
    { id:'checklist',  titulo:'Checklist',           selector:'#ot-progress-fill, #checklist-preparacion' },
    { id:'fotos',      titulo:'Fotos y notas',       selector:'#ot-notas-lista, #ot-fotos-preview' },
    { id:'finalizar',  titulo:'Finalizar',           selector:'#ot-acta-conf, #firma-canvas, #btn-completar-ot' },
    { id:'historial',  titulo:'Historial',           selector:'#ot-audit', admin:true }
  ];

  function cards294(){
    var view = document.getElementById('ot-detalle-view');
    if(!view) return [];
    return Array.from(view.querySelectorAll(':scope > .card')).filter(function(card){
      return card.id !== 'ot-wizard-294' && card.id !== 'ot-wizard-273' && card.id !== 'ot-pasos-rapidos';
    });
  }
  function clasificar294(){
    cards294().forEach(function(card){
      card.removeAttribute('data-ot-step');
      for(var i=0;i<pasos294.length;i++){
        if(card.querySelector(pasos294[i].selector)){
          card.setAttribute('data-ot-step', pasos294[i].id);
          break;
        }
      }
      if(!card.getAttribute('data-ot-step') && (card.querySelector('#ot-cred-lista') || card.querySelector('#ot-reclamo-hist'))) {
        card.setAttribute('data-ot-step','cliente');
      }
    });
  }
  function idxPaso294(step){
    var idx = pasos294.findIndex(function(p){ return p.id === step; });
    return idx < 0 ? 0 : idx;
  }
  function esAdmin294(){ return String(window.currentRole || '').toLowerCase() === 'admin'; }
  function pasoValido294(step){ return step !== 'historial' || esAdmin294(); }

  function renderBotones294(step){
    var nav = document.getElementById('ot-wizard-294-nav');
    if(!nav) return;
    nav.innerHTML = pasos294.filter(function(p){ return pasoValido294(p.id); }).map(function(p, i){
      var activo = p.id === step;
      return '<button type="button" class="btn btn-sm '+(activo ? 'btn-primary' : '')+'" data-step="'+p.id+'" onclick="otPasoIr(&quot;'+p.id+'&quot;)">'+(i+1)+' '+esc294(p.titulo.replace('Cliente y ubicación','Cliente'))+'</button>';
    }).join('');
  }

  function estadoActual294(){
    var ot = otActual294();
    return String((ot && ot.estado) || '').toLowerCase();
  }

  function activar294(step){
    if(!pasoValido294(step)) step = 'cliente';
    window._otStep294 = step || 'cliente';
    clasificar294();
    cards294().forEach(function(card){
      var s = card.getAttribute('data-ot-step');
      if(!s) return;
      card.style.display = (s === window._otStep294) ? '' : 'none';
    });
    renderBotones294(window._otStep294);
    var lbl = document.getElementById('ot-wizard-294-label');
    var p = pasos294[idxPaso294(window._otStep294)];
    if(lbl) lbl.textContent = p ? p.titulo : '';
    var ant = document.getElementById('ot-wiz-ant');
    var sig = document.getElementById('ot-wiz-sig');
    var ini = document.getElementById('ot-wiz-iniciar');
    var visibles = pasos294.filter(function(x){ return pasoValido294(x.id); });
    var idx = visibles.findIndex(function(x){ return x.id === window._otStep294; });
    var max = visibles.length - 1;
    if(ant) ant.disabled = idx <= 0;
    if(sig) sig.style.display = (idx >= max || window._otStep294 === 'historial') ? 'none' : '';
    if(ini) ini.style.display = (window._otStep294 === 'cliente' && estadoActual294() !== 'en_progreso' && estadoActual294() !== 'completada') ? '' : 'none';
  }

  function instalar294(){
    var view = document.getElementById('ot-detalle-view');
    if(!view || view.style.display === 'none') return;
    var viejo = document.getElementById('ot-pasos-rapidos'); if(viejo) viejo.remove();
    var viejo273 = document.getElementById('ot-wizard-273'); if(viejo273) viejo273.remove();
    var wiz = document.getElementById('ot-wizard-294');
    if(!wiz){
      wiz = document.createElement('div');
      wiz.id = 'ot-wizard-294';
      wiz.className = 'card';
      wiz.style.cssText = 'padding:12px 14px;margin-bottom:12px;position:sticky;top:0;z-index:8';
      wiz.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">'+
          '<div><span class="card-title"><i class="ti ti-route"></i> OT por pasos</span><div id="ot-wizard-294-label" style="font-size:12px;color:var(--text2);margin-top:3px">Cliente y ubicación</div></div>'+
          '<div id="ot-wizard-294-nav" style="display:flex;gap:6px;flex-wrap:wrap"></div>'+
        '</div>'+
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border-top:0.5px solid var(--border);padding-top:10px">'+
          '<button type="button" class="btn btn-sm" id="ot-wiz-ant" onclick="otPasoAnterior()"><i class="ti ti-arrow-left"></i> Anterior</button>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
            '<button type="button" class="btn btn-sm" id="ot-wiz-iniciar" onclick="otIniciarTrabajo()"><i class="ti ti-player-play"></i> Iniciar OT</button>'+
            '<button type="button" class="btn btn-sm btn-primary" id="ot-wiz-sig" onclick="otPasoSiguiente()">Siguiente <i class="ti ti-arrow-right"></i></button>'+
          '</div>'+
        '</div>';
      var aviso = document.getElementById('ot-aviso-cambio-externo');
      if(aviso && aviso.parentNode) aviso.parentNode.insertBefore(wiz, aviso.nextSibling);
      else view.insertBefore(wiz, view.firstChild);
    }
    activar294(window._otStep294 || 'cliente');
  }

  window.otPasoIr = function(step){ activar294(step || 'cliente'); };
  window.otPasoSiguiente = function(){
    var visibles = pasos294.filter(function(p){ return pasoValido294(p.id); });
    var idx = visibles.findIndex(function(p){ return p.id === (window._otStep294 || 'cliente'); });
    if(idx < 0) idx = 0;
    if(idx < visibles.length - 1) activar294(visibles[idx+1].id);
  };
  window.otPasoAnterior = function(){
    var visibles = pasos294.filter(function(p){ return pasoValido294(p.id); });
    var idx = visibles.findIndex(function(p){ return p.id === (window._otStep294 || 'cliente'); });
    if(idx > 0) activar294(visibles[idx-1].id);
  };

  window.otIniciarTrabajo = function(){
    var ot = otActual294();
    if(!ot){ if(typeof notify === 'function') notify('No se encontró la OT activa'); return; }
    var ahora = new Date().toLocaleDateString('es-AR') + ' ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    ot.estado = 'en_progreso';
    if(!ot.audit) ot.audit = [];
    ot.audit.push({ fecha: ahora, usuario: window.currentUser || 'Sistema', accion: 'OT iniciada' });
    var badge = document.getElementById('ot-det-estado-badge');
    if(badge && typeof otBadge === 'function') badge.innerHTML = otBadge('en_progreso');
    var guardar = (typeof fbGuardarOT === 'function') ? fbGuardarOT(ot) : Promise.resolve();
    guardar.then(function(){ if(typeof notify === 'function') notify('✓ OT iniciada'); activar294('checklist'); })
      .catch(function(e){ if(typeof notify === 'function') notify('Error al iniciar OT: ' + e.message); });
  };

  window.abrirDireccionEnMaps = function(){
    var inp = document.getElementById('ot-det-dir');
    var dir = (inp && inp.value) || window._otDireccionActual || '';
    if(dirVacia294(dir)){ if(typeof notify === 'function') notify('No hay dirección cargada para esta OT'); return; }
    window.open('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dir), '_blank');
  };

  var verOriginal294 = window.verOT;
  if(typeof verOriginal294 === 'function'){
    window.verOT = function(id){
      window._otStep294 = 'cliente';
      var r = verOriginal294.apply(this, arguments);
      setTimeout(function(){ setDireccion294(otActual294(id)); instalar294(); }, 180);
      setTimeout(function(){ setDireccion294(otActual294(id)); instalar294(); }, 700);
      return r;
    };
  }

  var volverOriginal294 = window.volverListaOT;
  if(typeof volverOriginal294 === 'function'){
    window.volverListaOT = function(){
      var r = volverOriginal294.apply(this, arguments);
      var wiz = document.getElementById('ot-wizard-294'); if(wiz) wiz.remove();
      var viejo = document.getElementById('ot-pasos-rapidos'); if(viejo) viejo.remove();
      return r;
    };
  }

  document.addEventListener('sisventas:page-changed', function(event){
      var page=event.detail&&event.detail.page;
      if(page === 'ordentrabajo') setTimeout(instalar294, 250);
  });

  document.addEventListener('input', function(e){
    if(e.target && e.target.id === 'ot-det-dir') window._otDireccionActual = e.target.value || '';
  });
})();
