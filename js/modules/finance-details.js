
(function(){
  function esc(v){
    if (typeof escapeHTML === 'function') return escapeHTML(v);
    return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function norm(v){
    return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function arr(x){
    if (Array.isArray(x)) return x;
    if (x && typeof x === 'object') return Object.keys(x).map(function(k){ return Object.assign({fbKey:k}, x[k]||{}); });
    return [];
  }
  function mon(v){ return (typeof money==='function') ? money(v) : ('$' + Math.round(parseFloat(v)||0).toLocaleString('es-AR')); }
  function fechaFmt(f){
    f=String(f||'');
    if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0,10).split('-').reverse().join('/');
    return f || '—';
  }
  function mesActualCta(){
    if (typeof _ctaEmpPeriodoMes === 'function') return _ctaEmpPeriodoMes();
    var d = new Date();
    if (window.ctaEmpPeriodo === 'anterior') d.setMonth(d.getMonth()-1);
    return d.toISOString().slice(0,7);
  }
  function fechaEnMes(f, mes){
    if (typeof _fechaEnMes === 'function') return _fechaEnMes(f, mes);
    return String(f||'').slice(0,7) === mes;
  }
  function empNombreCompleto(emp){
    emp = emp || {};
    return String(emp.nombreCompleto || emp.nombre || ((emp.apellido||'') + ' ' + (emp.nombres||'')).trim() || '').trim();
  }
  function ventaDelEmpleado(v, emp){
    var n = norm(empNombreCompleto(emp));
    var eid = String(emp.fbKey || emp.id || '').trim();
    var nombres = [v.empleado,v.vendedor,v.empleadoNombre,v.comisionado,v.empleado2,v.comisionado2,v.vendedor2].map(norm).filter(Boolean);
    var ids = [v.empleadoId,v.vendedorId,v.empFbKey,v.comisionadoId,v.empleado2Id,v.comisionado2Id].filter(Boolean).map(String);
    return (!!n && nombres.indexOf(n)>=0) || (!!eid && ids.indexOf(eid)>=0);
  }
  function costoItem(it){
    it = it || {};
    var qty = parseFloat(it.qty ?? it.cantidad ?? it.cant ?? 1) || 1;
    var directo = parseFloat(it.costoTotal ?? it.totalCompra ?? it.total_compra ?? it.compraTotal);
    if (!isNaN(directo) && directo > 0) return directo;
    var unit = parseFloat(it.precioCompra ?? it.compra ?? it.costo ?? it.precio_compra ?? it.pcompra);
    if (!isNaN(unit) && unit > 0) return unit * qty;
    // Fallback solo para ventas viejas: buscar producto actual por código.
    var cod = String(it.cod || it.codigo || it.sku || '').trim();
    if (cod && window.productosData) {
      var pr = (window.productosData||[]).find(function(p){ return String(p.cod||p.codigo||p.sku||'').trim() === cod; });
      if (pr) {
        var pc = parseFloat(pr.precioCompra ?? pr.compra ?? pr.costo ?? pr.precio_compra);
        if (!isNaN(pc) && pc > 0) return pc * qty;
      }
    }
    return 0;
  }
  function gananciaVenta(v){
    v = v || {};
    var subtotal = parseFloat(v.subtotalBruto ?? v.subtotalSinDesc ?? v.subtotal ?? 0) || 0;
    var descuento = parseFloat(v.descuentoMonto ?? v.descuento ?? 0) || 0;
    var items = arr(v.items);
    var costo = items.reduce(function(s,it){ return s + costoItem(it); }, 0);
    if (!costo && parseFloat(v.costoProductos||0)>0) costo = parseFloat(v.costoProductos)||0;
    var gan = subtotal - descuento - costo;
    return { subtotal:subtotal, descuento:descuento, costo:costo, ganancia:gan };
  }
  function ventaId(v){ return String(v.id || v.numero || v.fbKey || '').trim(); }
  function abrirVenta(id){
    if (!id) return;
    if (typeof verDetalleVentaDesdeId === 'function') return verDetalleVentaDesdeId(id);
    if (typeof verDetalleVenta === 'function') return verDetalleVenta(id);
    if (typeof verVenta === 'function') return verVenta(id);
  }
  window.abrirVentaDesdeComision270 = abrirVenta;

  function asegurarBloqueComisiones(){
    var card = document.getElementById('ctaemp-comision-card');
    if (!card) return null;
    var body = document.getElementById('ctaemp-com-detalle');
    if (!body) {
      var html = '<div id="ctaemp-com-detalle" style="margin-top:12px;border-top:0.5px solid var(--border);padding-top:10px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
        '<span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Detalle trazable de comisiones</span>'+
        '<span id="ctaemp-com-detalle-info" style="font-size:11px;color:var(--text3)"></span></div>'+
        '<div id="ctaemp-com-lista" style="display:flex;flex-direction:column;gap:6px"></div></div>';
      card.insertAdjacentHTML('beforeend', html);
      body = document.getElementById('ctaemp-com-detalle');
    }
    return body;
  }

  var oldRenderCom = window.renderComisionesDelMes;
  window.renderComisionesDelMes = function(emp){
    if (typeof oldRenderCom === 'function') oldRenderCom.apply(this, arguments);
    var card = document.getElementById('ctaemp-comision-card');
    if (!card || !emp) return;
    if (emp.tipoEmpleado !== 'Vendedor a comisión') return;
    asegurarBloqueComisiones();
    var lista = document.getElementById('ctaemp-com-lista');
    var info = document.getElementById('ctaemp-com-detalle-info');
    if (!lista) return;
    var pct = parseFloat(emp.pctComisionPropio) || 0;
    var mes = mesActualCta();
    var idsVisibles = null;
    if (String(window.currentRole || currentRole || '').toLowerCase() !== 'admin') {
      idsVisibles = {};
      (window.movsEmpData || movsEmpData || []).forEach(function(m){
        var est = String(m.estado || '').toLowerCase();
        if (m.tipo !== 'comision' || ['aprobado','pagado','pagado_parcial'].indexOf(est) < 0) return;
        if (m.ventaId) idsVisibles[String(m.ventaId)] = m;
        if (m.ventaFbKey) idsVisibles[String(m.ventaFbKey)] = m;
      });
    }
    var ventas = (window.ventasList||[]).filter(function(v){
      var visible = !idsVisibles || idsVisibles[String(v.id || '')] || idsVisibles[String(v.fbKey || '')];
      return ventaDelEmpleado(v, emp) && visible && fechaEnMes(v.fecha, mes);
    });
    var totalGanancia = 0, totalComision = 0, totalCosto = 0;
    var rows = ventas.map(function(v){
      var g = gananciaVenta(v);
      var base = Math.max(g.ganancia, 0);
      var movVisible = idsVisibles && (idsVisibles[String(v.id || '')] || idsVisibles[String(v.fbKey || '')]);
      var com = movVisible ? (parseFloat(movVisible.monto)||0) : parseFloat(v.comisionMonto || v.comision || 0);
      if (!com) com = base * (pct/100);
      totalGanancia += g.ganancia;
      totalComision += com;
      totalCosto += g.costo;
      var estado = v.estadoPago === 'pago_total' ? '<span class="badge b-green">Cobrado</span>' : '<span class="badge b-amber">Pendiente</span>';
      var warn = g.costo <= 0 ? '<span class="badge b-amber" title="Venta vieja sin costo guardado o producto sin compra">Costo estimado</span>' : '';
      return '<div onclick="abrirVentaDesdeComision270(\''+esc(v.fbKey||v.id||v.numero||'')+'\')" style="cursor:pointer;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius);padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">'+
        '<div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);display:flex;gap:6px;align-items:center;flex-wrap:wrap">Venta '+esc(ventaId(v))+' '+estado+' '+warn+'</div>'+
        '<div style="font-size:12px;color:var(--text2);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v.cliente||'Sin cliente')+' · '+fechaFmt(v.fecha)+'</div>'+
        '<div style="font-size:11px;color:var(--text3);margin-top:3px">Subtotal '+mon(g.subtotal)+' − Desc. '+mon(g.descuento)+' − Costo '+mon(g.costo)+' = Ganancia '+mon(g.ganancia)+'</div></div>'+
        '<div style="text-align:right"><div style="font-size:14px;font-weight:700;color:var(--green)">'+mon(com)+'</div><div style="font-size:11px;color:var(--text3)">'+pct+'% sobre ganancia</div></div></div>';
    });
    if (info) info.textContent = ventas.length ? (ventas.length + ' venta' + (ventas.length!==1?'s':'') + ' · Ganancia ' + mon(totalGanancia) + ' · Costo ' + mon(totalCosto)) : '';
    lista.innerHTML = rows.length ? rows.join('') : '<div style="text-align:center;color:var(--text3);font-size:13px;padding:14px">Sin ventas con comisión en este período</div>';
    var elTotal = document.getElementById('ctaemp-com-total');
    var elCant = document.getElementById('ctaemp-com-cant');
    if (elTotal) elTotal.textContent = mon(totalComision);
    if (elCant) elCant.textContent = ventas.length + ' venta' + (ventas.length!==1?'s':'') + ' ' + mes + ' · comisión sobre ganancia';
  };

  // Tesorería: detalle auditable del pago sin perder el listado.
  function pagoKey(p){ return [p.origen,p.gastoKey,p._idx,p._key,p.fecha,p.monto,p.loteId].join('|'); }
  window.tesAbrirDetallePago270 = function(key){
    var pagos = (typeof window._tesoreriaPagos === 'function' ? window._tesoreriaPagos() : []);
    var p = pagos.find(function(x){ return pagoKey(x) === key; });
    if (!p) { if(typeof notify==='function') notify('No se encontró el pago'); return; }
    var modal = document.getElementById('modal-tes-pago-270');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend','<div id="modal-tes-pago-270" class="modal-overlay"><div class="modal" style="max-width:620px"><div class="modal-head"><span class="modal-title">Detalle de pago</span><button class="btn btn-sm btn-icon" onclick="document.getElementById(\'modal-tes-pago-270\').classList.remove(\'open\')"><i class="ti ti-x"></i></button></div><div id="modal-tes-pago-body"></div></div></div>');
      modal = document.getElementById('modal-tes-pago-270');
    }
    var body = document.getElementById('modal-tes-pago-body');
    var comp = p.comprobante && (p.comprobante.data || p.comprobante.url || p.comprobante.nombre);
    body.innerHTML = '<div class="metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">'+
      '<div class="metric"><div class="m-label">Importe</div><div class="m-value" style="color:var(--green)">'+mon(p.monto)+'</div><div class="m-sub">'+esc(formatoMedioPago(p.medio||p.medioPago||'—'))+'</div></div>'+
      '<div class="metric"><div class="m-label">Fecha</div><div class="m-value" style="font-size:18px">'+esc(fechaFmt(p.fecha))+'</div><div class="m-sub">registrado</div></div>'+
      '<div class="metric"><div class="m-label">Lote</div><div class="m-value" style="font-size:18px">'+esc(p.loteId||'—')+'</div><div class="m-sub">pago múltiple</div></div></div>'+
      '<div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;margin-bottom:10px">'+
      '<div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Origen</div>'+
      '<div style="font-size:13px;color:var(--text)">'+esc(p.gastoDesc||p.concepto||'—')+'</div>'+
      '<div style="font-size:12px;color:var(--text3);margin-top:4px">Usuario: '+esc(p.usuario||'Sistema')+' · Categoría: '+esc(p.categoria||'—')+'</div></div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">'+
      (comp ? '<button class="btn btn-primary" onclick="tesVerComprobante(\''+esc(p.gastoKey||'')+'\','+(p._idx||0)+')"><i class="ti ti-paperclip"></i> Ver comprobante</button>' : '<span style="font-size:12px;color:var(--text3);align-self:center">Sin comprobante adjunto</span>')+
      '</div>';
    modal.classList.add('open');
  };
  function agregarDetalleTesoreria270(){
    var el = document.getElementById('tes-lista');
    if (!el) return;
    var cards = Array.from(el.children || []);
    var pagos = (typeof window._tesoreriaPagos === 'function' ? window._tesoreriaPagos() : []);
    cards.forEach(function(card){
      if (!card || card.querySelector('[data-tes-detalle-270]')) return;
      var txt = norm(card.textContent||'');
      var p = pagos.find(function(x){ return txt.includes(norm(x.gastoDesc||'')) && txt.includes(norm(x.medio||x.medioPago||'')); });
      if (!p) return;
      var key = esc(pagoKey(p));
      var div = document.createElement('button');
      div.className = 'btn btn-sm';
      div.setAttribute('data-tes-detalle-270','1');
      div.innerHTML = '<i class="ti ti-eye"></i> Ver detalle';
      div.onclick = function(ev){ ev.stopPropagation(); window.tesAbrirDetallePago270(key); };
      var last = card.lastElementChild || card;
      if (last) last.appendChild(div);
    });
  }
  document.addEventListener('sisventas:treasury-rendered', agregarDetalleTesoreria270);
  document.addEventListener('sisventas:page-changed', function(event){
      var page=event.detail&&event.detail.page;
      if (page === 'ctaemp') setTimeout(function(){
        if (window.ctaEmpActual && typeof cargarCtaEmp === 'function') cargarCtaEmp(window.ctaEmpActual);
      }, 250);
  });
})();
