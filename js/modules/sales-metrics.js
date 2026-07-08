(function(){
  function arr(v){ return Array.isArray(v) ? v : Object.values(v||{}); }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
  function numero(v){
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s=String(v==null?'':v).replace(/\s|\$/g,'');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s=s.lastIndexOf(',')>s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
    else if (s.includes(',')) s=/,\d{1,2}$/.test(s) ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
    var n=Number(s); return isFinite(n)?n:0;
  }
  function money(n){ return '$' + Math.round(numero(n)).toLocaleString('es-AR'); }
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
  function totalVenta(v){
    if (!v) return 0;
    var directo=numero(v.total != null ? v.total : v.totalVenta != null ? v.totalVenta : v.montoTotal != null ? v.montoTotal : v.totalFinal != null ? v.totalFinal : v.importeTotal != null ? v.importeTotal : v.importe_total);
    if (directo) return directo;
    var items=arr(v.items||v.productos||[]);
    var desdeItems=items.reduce(function(s,it){
      var sub=numero(it && (it.sub != null ? it.sub : it.subtotal != null ? it.subtotal : it.total));
      if (!sub) sub=numero(it && (it.qty != null ? it.qty : it.cantidad)) * numero(it && (it.punit != null ? it.punit : it.precio));
      return s+sub;
    },0);
    if (desdeItems) return desdeItems;
    var subtotal=numero(v.subtotal != null ? v.subtotal : v.neto);
    return Math.max(0,subtotal-numero(v.descuento)+numero(v.iva));
  }
  function ventaKeys(v){
    var out = {};
    [v && v.fbKey, v && v.id, v && v.numero, v && v.nro, v && v.codigo].forEach(function(k){
      k = String(k||'').trim();
      if(k) out[k] = true;
    });
    return Object.keys(out);
  }
  function pagoKeys(p){
    var out = {};
    [p && p.ventaFbKey, p && p.ventaKey, p && p.ventaId, p && p.idVenta, p && p.venta, p && p.nroVenta, p && p.numeroVenta].forEach(function(k){
      k = String(k||'').trim();
      if(k) out[k] = true;
    });
    return Object.keys(out);
  }
  function pagosDeVenta(v){
    var keys = ventaKeys(v);
    if(!keys.length) return [];
    var pagos = arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList);
    var vistos = {};
    return pagos.filter(function(p){
      if(!p || p.anulado || norm(p.estado) === 'anulado') return false;
      var match = pagoKeys(p).some(function(k){ return keys.indexOf(k) >= 0; });
      if(!match) return false;
      var pk = String(p.fbKey || p.id || p.key || '') || [p.fecha || '', p.medio || p.medioPago || '', p.monto || 0, p.venta || p.ventaFbKey || ''].join('|');
      if(vistos[pk]) return false;
      vistos[pk] = true;
      return true;
    });
  }
  function pagadoVenta(v){
    var desdePagos = pagosDeVenta(v).reduce(function(s,p){ return s + numero(p && (p.monto || p.importe || p.total || p.pagado)); }, 0);
    if (desdePagos > 0) return desdePagos;
    var directo = numero(v && (v.totalPagado != null ? v.totalPagado : v.pagado != null ? v.pagado : v.montoPagado));
    if (directo > 0) return directo;
    return esPagoTotal(v) ? totalVenta(v) : 0;
  }
  function ivaVenta(v){ return numero(v && (v.iva != null ? v.iva : v.ivaMonto != null ? v.ivaMonto : v.montoIva)); }
  window.svResumenVentas = function(opts){
    opts = opts || {};
    var mes = opts.mes || ymActual();
    var fuente = typeof window.obtenerVentasSisVentas === 'function' ? window.obtenerVentasSisVentas() : (window.ventasList || window.ventasData || []);
    var ventas = arr(fuente).filter(function(v){ return v && (!v.anulada || v.notaCredito); });
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
      'vm-iva':'IVA del mes'
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
  function refrescarVentas310(){
    if (typeof window.renderMetricasVentas === 'function') window.renderMetricasVentas();
  }
  document.addEventListener('sisventas:page-changed', function(event){
    if(event.detail&&event.detail.page === 'detalle') setTimeout(refrescarVentas310, 80);
  });
  var renderTablaPrev310 = window.renderVentasTabla;
  if (typeof renderTablaPrev310 === 'function') {
    window.renderVentasTabla = function(){ var r = renderTablaPrev310.apply(this, arguments); setTimeout(refrescarVentas310, 50); return r; };
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(refrescarVentas310, 300); });
})();
