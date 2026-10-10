(function(){
  'use strict';


  function setDisplay309(el, visible, displayValue){
    if (!el) return;
    el.style.display = visible ? (displayValue || '') : 'none';
  }
  window.aplicarDashboardPermisos309 = function(){
    var admin = window.tienePermiso('cobranzas.verDashboard');
    setDisplay309(document.getElementById('ventas-list-stats-global'), window.tienePermiso('ventas.verDashboard'), 'grid');
    setDisplay309(document.getElementById('cobranzas-stats-global'), admin, 'grid');
    var pageCob = document.getElementById('page-cobranzas');
    if (pageCob) Array.from(pageCob.querySelectorAll(':scope > .metrics')).forEach(function(m){ setDisplay309(m, admin, 'grid'); });
  };

  document.addEventListener('sisventas:role-changed', function(){
    window.aplicarDashboardPermisos309();
    setTimeout(window.aplicarDashboardPermisos309, 80);
  });
  document.addEventListener('sisventas:page-changed', function(){ setTimeout(window.aplicarDashboardPermisos309, 80); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(window.aplicarDashboardPermisos309, 300); });

  // Los descuentos se cargan al abrir la venta. No restaurarlos al recalcular:
  // un campo vacío puede ser una decisión del usuario, no un dato perdido.

  window.abrirDetalleVentaConfirmada309 = function(id, fbKey){
    if (typeof cerrarConfirmacionVenta === 'function') cerrarConfirmacionVenta();
    var abrirDetalle = function(){
      var v = (window.ventasList || []).find(function(x){ return String(x.fbKey||'') === String(fbKey||'') || String(x.id||'') === String(id||'') || String(x.numero||'') === String(id||''); });
      var ref = (v && (v.fbKey || v.id || v.numero)) || fbKey || id;
      if (typeof verDetalleVenta === 'function') return verDetalleVenta(ref);
      if (typeof verVenta === 'function') return verVenta(ref);
      if (typeof renderDetalleVenta === 'function' && v) return renderDetalleVenta(v);
      if (typeof notify === 'function') notify('No se pudo abrir el detalle de la venta');
    };
    if(typeof window.svNavegarDirecto==='function') window.svNavegarDirecto('detalle', abrirDetalle, document.querySelector('[onclick*=detalle]'));
    else { if (typeof showPage === 'function') showPage('detalle', document.querySelector('[onclick*=detalle]')); abrirDetalle(); }
  };

  function norm309(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
  function medioCfg309(medio){
    if (typeof obtenerMedioPagoConfig === 'function') return obtenerMedioPagoConfig(medio);
    var n = norm309(medio);
    return (window.MEDIOS_PAGO_CONFIG||[]).find(function(x){
      var tipo = norm309(x.tipo || 'otro'); var corto = (window.TIPO_LABEL_MP_CORTO && window.TIPO_LABEL_MP_CORTO[tipo]) || tipo.toUpperCase();
      return norm309(x.nombre) === n || norm309(corto + ' / ' + x.nombre) === n;
    }) || null;
  }
  window._tesTipoMedio = function(p){
    p = p || {}; var medio = p.medio || p.medioPago || ''; var cfg = medioCfg309(medio);
    if (cfg && cfg.tipo) return norm309(cfg.tipo);
    var n = norm309(medio);
    if (/efect/.test(n)) return 'efectivo';
    if (/trans|transfer|alias|cbu|banco|bancaria|santander|galicia|bbva|macro|nacion|provincia|uala/.test(n)) return 'transferencia';
    if (/mercado pago|mercadopago|\bmp\b|qr|billetera/.test(n)) return 'qr';
    if (/tarj|debito|credito|visa|master/.test(n)) return 'tarjeta';
    if (/cheq|echeq/.test(n)) return 'cheque';
    if (p.comprobante && (p.comprobante.data || p.comprobante.url || p.comprobante.nombre)) return 'transferencia';
    return 'otro';
  };
  function dentroPeriodo309(fecha, per){ fecha = String(fecha || ''); if (per === 'todos') return true; var d = new Date(), ym = d.toISOString().slice(0,7), prevD = new Date(d.getFullYear(), d.getMonth()-1, 1), prev = prevD.toISOString().slice(0,7); if (per === 'anterior') return fecha.slice(0,7) === prev; return fecha.slice(0,7) === ym; }
  function money309(n){ return (typeof money === 'function') ? money(n) : '$' + Math.round(parseFloat(n)||0).toLocaleString('es-AR'); }
  function setMetric309(id, val, sub){ var el = document.getElementById(id); if(!el) return; el.textContent = val; var s = el.closest('.metric'); s = s ? s.querySelector('.m-sub') : null; if (s && sub !== undefined) s.textContent = sub; }
  function corregirMetricasTesoreria309(){
    if (typeof window._tesoreriaPagos !== 'function') return;
    var per = (document.getElementById('tes-periodo')||{}).value || 'mes';
    var pagos = window._tesoreriaPagos().filter(function(p){ return dentroPeriodo309(p.fecha, per); });
    var total = 0, transfer = 0, efectivo = 0, comp = 0, cTransfer = 0, cEfectivo = 0;
    pagos.forEach(function(p){ var m = parseFloat(p.monto) || 0; total += m; var tipo = window._tesTipoMedio(p); if (tipo === 'transferencia') { transfer += m; cTransfer++; } if (tipo === 'efectivo') { efectivo += m; cEfectivo++; } if (p.comprobante && (p.comprobante.data || p.comprobante.url || p.comprobante.nombre)) comp++; });
    setMetric309('tes-met-mes', money309(total), pagos.length + (pagos.length === 1 ? ' pago registrado' : ' pagos registrados'));
    setMetric309('tes-met-transfer', money309(transfer), cTransfer + (cTransfer === 1 ? ' transferencia' : ' transferencias'));
    setMetric309('tes-met-efectivo', money309(efectivo), cEfectivo + (cEfectivo === 1 ? ' pago en efectivo' : ' pagos en efectivo'));
    setMetric309('tes-met-comp', comp, 'adjuntos');
  }
  window.abrirDetalleVentaConfirmada308 = window.abrirDetalleVentaConfirmada309;
  document.addEventListener('sisventas:treasury-rendered', function(){ setTimeout(corregirMetricasTesoreria309, 120); });
})();
