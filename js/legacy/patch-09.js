(function(){
  function arr(v){ return Array.isArray(v) ? v : Object.values(v||{}); }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
  function money(n){ return (typeof window.money === 'function') ? window.money(n) : '$' + Math.round(parseFloat(n)||0).toLocaleString('es-AR'); }
  function setTxt(id, value){ var el=document.getElementById(id); if(el) el.textContent=value; }
  function setSubForValue(id, value){ var el=document.getElementById(id); if(!el) return; var m=el.closest('.metric'); var sub=m ? m.querySelector('.m-sub') : null; if(sub) sub.textContent=value; }
  function fechaISO(v){
    var f = String(v && (v.fecha || v.fechaVenta || v.createdAt || v.ts) || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0,10);
    if (/^\d{2}\/\d{2}\/\d{4}/.test(f)) { var p=f.split('/'); return p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0'); }
    var d = new Date(f); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
  }
  function ymActual(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  function esPagoTotal(v){ var e=norm(v && (v.estadoPago || v.pagoEstado || v.estado_pago)); return e==='pago_total' || e==='cobrado' || e==='pagado' || e==='pago total'; }
  function esInstalado(v){ var e=norm(v && (v.estadoInst || v.estadoInstalacion || v.instalacion || v.estado_inst)); return e==='instalado' || e==='completada' || e==='completo'; }
  function totalVenta(v){ return parseFloat(v && (v.total || v.totalVenta || v.montoTotal)) || 0; }
  function pagadoVenta(v){
    var directo = parseFloat(v && (v.totalPagado || v.pagado || v.montoPagado)) || 0;
    if (directo > 0) return directo;
    return esPagoTotal(v) ? totalVenta(v) : 0;
  }
  function ivaVenta(v){ return parseFloat(v && (v.iva || v.ivaMonto || v.montoIva)) || 0; }
  window.svResumenVentas = function(opts){
    opts = opts || {};
    var mes = opts.mes || ymActual();
    var ventas = arr(window.ventasList || window.ventasData || []).filter(function(v){ return v && (!v.anulada || v.notaCredito); });
    var ventasMes = ventas.filter(function(v){ return fechaISO(v).slice(0,7) === mes; });
    var totalMes = 0, cobradoMes = 0, pendienteMes = 0, ivaMes = 0, pendCobroCant = 0, pendInstCant = 0, facturadasCant = 0;
    ventasMes.forEach(function(v){
      var total = totalVenta(v), pagado = Math.min(total, pagadoVenta(v));
      totalMes += total; cobradoMes += pagado; ivaMes += ivaVenta(v);
      var saldo = Math.max(0, total - pagado);
      if (saldo > 0.5) { pendienteMes += saldo; pendCobroCant++; }
      if (!esInstalado(v)) pendInstCant++;
      if (v.factura || v.facturaCAE || (v.facturacion && v.facturacion.cae)) facturadasCant++;
    });
    return {
      mes: mes,
      ventas: ventas,
      ventasMes: ventasMes,
      totalMes: totalMes,
      cantidadMes: ventasMes.length,
      cobradoMes: cobradoMes,
      pendienteCobroMes: pendienteMes,
      pendienteCobroCant: pendCobroCant,
      pendienteInstalacionCant: pendInstCant,
      ivaMes: ivaMes,
      facturadasCant: facturadasCant,
      ticketPromedioMes: ventasMes.length ? Math.round(totalMes / ventasMes.length) : 0
    };
  };
  function aplicarTextosDashboardVentas(){
    var labelMap = {
      'vm-cobrado':'Pagado este mes',
      'vm-pendiente':'Pendiente de cobro',
      'vm-iva':'IVA del mes',
      'stat-ven-mes':'Ventas del mes',
      'stat-ven-cant':'Cantidad',
      'stat-ven-pendiente':'Pendiente cobro',
      'stat-ven-ticket':'Ticket promedio'
    };
    Object.keys(labelMap).forEach(function(id){
      var el=document.getElementById(id); if(!el) return;
      var metric=el.closest('.metric'); var lbl=metric ? metric.querySelector('.m-label') : null;
      if(lbl) lbl.textContent=labelMap[id];
    });
  }
  window.renderMetricasVentas = function(){
    aplicarTextosDashboardVentas();
    var r = window.svResumenVentas();
    var mesLabel = (function(){ var p=r.mes.split('-'); return p[1]+'/'+p[0]; })();
    setTxt('vm-total-mes', money(r.totalMes));
    setTxt('vm-cobrado', money(r.cobradoMes));
    setTxt('vm-pendiente', money(r.pendienteCobroMes));
    setTxt('vm-iva', money(r.ivaMes));
    setSubForValue('vm-total-mes', r.cantidadMes + (r.cantidadMes===1 ? ' venta' : ' ventas') + ' en ' + mesLabel);
    setSubForValue('vm-cobrado', 'pagado sobre ventas del mes');
    setSubForValue('vm-pendiente', r.pendienteCobroCant + (r.pendienteCobroCant===1 ? ' venta' : ' ventas') + ' sin cobrar del mes');
    setSubForValue('vm-iva', 'IVA real del mes');
  };
  window.actualizarStatVentas = function(){
    aplicarTextosDashboardVentas();
    var r = window.svResumenVentas();
    setTxt('stat-ven-mes', money(r.totalMes));
    setTxt('stat-ven-cant', r.cantidadMes);
    setTxt('stat-ven-pendiente', money(r.pendienteCobroMes));
    setTxt('stat-ven-pendiente-sub', r.pendienteCobroCant + (r.pendienteCobroCant===1 ? ' venta sin cobrar' : ' ventas sin cobrar'));
    setTxt('stat-ven-ticket', money(r.ticketPromedioMes));
  };
  function refrescarVentas310(){
    if (typeof window.actualizarStatVentas === 'function') window.actualizarStatVentas();
    if (typeof window.renderMetricasVentas === 'function') window.renderMetricasVentas();
  }
  var showPrev310 = window.showPage;
  if (typeof showPrev310 === 'function') {
    window.showPage = function(page, el){ var r = showPrev310.apply(this, arguments); if(page === 'detalle') setTimeout(refrescarVentas310, 80); return r; };
  }
  var renderTablaPrev310 = window.renderVentasTabla;
  if (typeof renderTablaPrev310 === 'function') {
    window.renderVentasTabla = function(){ var r = renderTablaPrev310.apply(this, arguments); setTimeout(refrescarVentas310, 50); return r; };
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(refrescarVentas310, 300); });
})();
