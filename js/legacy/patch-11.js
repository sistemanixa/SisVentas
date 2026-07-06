(function(){
  window.SisVentas = window.SisVentas || {};
  var SV = window.SisVentas;
  SV.Cache = SV.Cache || {};
  SV.Metrics = SV.Metrics || {};
  SV.Tables = SV.Tables || {};
  SV.Modal = SV.Modal || {};
  SV.Notify = SV.Notify || {};
  SV.Validate = SV.Validate || {};
  SV.Utils = SV.Utils || {};

  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function num(v){
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/\./g,'').replace(',', '.').replace(/[^0-9.\-]/g,'');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function id(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return String(v || '').toLowerCase().trim(); }
  function fecha(v){
    var s = String(v || '').slice(0,10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(v || Date.now());
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
  }
  function mesActual(){ return new Date().toISOString().slice(0,7); }
  function esMes(v, m){ return fecha(v).slice(0,7) === (m || mesActual()); }
  function money(v){ return typeof window.fmtMoney === 'function' ? window.fmtMoney(num(v)) : ('$' + Math.round(num(v)).toLocaleString('es-AR')); }
  function setText(el, val){ if (typeof el === 'string') el = document.getElementById(el); if (el) el.textContent = val; }
  function setHTML(el, val){ if (typeof el === 'string') el = document.getElementById(el); if (el) el.innerHTML = val; }
  function getLista(nombre){
    if (SV.Cache && typeof SV.Cache.get === 'function') return arr(SV.Cache.get(nombre));
    var mapa = { ventas: window.ventasList || window.ventasData, clientes: window.clientesList || window.cliData || window.clientesData, productos: window.prodData || window.productosData, pagos: window.pagosData || window.pagosList, gastos: window.gastosData || window.gastosList, ot: window.otData || window.ordenesTrabajoData };
    return arr(mapa[nombre] || window[nombre]);
  }
  function ventaId(v){ return id(v && (v.fbKey || v.id || v.numero || v.nro || v.codigo)); }
  function clienteId(c){ return id(c && (c.fbKey || c.id || c.idCliente || c.codigo || c.dni || c.cuit)); }
  function productoCod(p){ return id(p && (p.codigo || p.cod || p.id || p.fbKey)); }
  function totalVenta(v){ return num(v && (v.total || v.totalVenta || v.importe || v.monto || v.totalConIva)); }
  function totalPago(p){ return num(p && (p.monto || p.importe || p.total || p.pagado)); }
  function ventaPagoId(p){ return id(p && (p.ventaId || p.idVenta || p.venta || p.nroVenta || p.numeroVenta)); }
  function tipoComprobante(v){ return lower(v && (v.tipoComprobante || v.comprobanteTipo || v.tipo || v.tipoFactura || '')); }
  function signoComprobante(v){ return tipoComprobante(v).indexOf('nota de crédito') >= 0 || tipoComprobante(v).indexOf('nota credito') >= 0 || tipoComprobante(v).indexOf('nc') === 0 ? -1 : 1; }
  function medioTipo(obj){
    var t = lower(obj && (obj.medioTipo || obj.tipoMedio || obj.tipo || obj.medio_pago_tipo));
    var m = lower(obj && (obj.medio || obj.medioPago || obj.formaPago || obj.nombreMedio));
    var s = (t + ' ' + m).trim();
    if (s.indexOf('efectivo') >= 0 || s.indexOf('caja') >= 0) return 'efectivo';
    if (s.indexOf('transfer') >= 0 || s.indexOf('alias') >= 0 || s.indexOf('cbu') >= 0 || s.indexOf('cvu') >= 0) return 'transferencia';
    if (s.indexOf('tarjeta') >= 0 || s.indexOf('débito') >= 0 || s.indexOf('debito') >= 0 || s.indexOf('crédito') >= 0 || s.indexOf('credito') >= 0) return 'tarjeta';
    if (s.indexOf('cheque') >= 0 || s.indexOf('echeq') >= 0) return 'cheque';
    if (s.indexOf('qr') >= 0 || s.indexOf('mercado pago') >= 0 || s.indexOf('mp') >= 0) return 'qr';
    return t || m || 'otro';
  }

  SV.Utils.arr = arr;
  SV.Utils.num = num;
  SV.Utils.fecha = fecha;
  SV.Utils.money = money;
  SV.Utils.medioTipo = medioTipo;
  SV.Utils.signoComprobante = signoComprobante;

  SV.Cache.version = 'v1.6.0';
  SV.Cache._builtAt = 0;
  SV.Cache.indexes = SV.Cache.indexes || {};
  SV.Cache.buildIndexes = function(force){
    var now = Date.now();
    if (!force && SV.Cache._builtAt && now - SV.Cache._builtAt < 1500) return SV.Cache.indexes;
    var idx = { ventasPorId:{}, clientesPorId:{}, productosPorCodigo:{}, pagosPorVenta:{}, otPorVenta:{}, gastosPorEmpleado:{}, empleadosPorUsuario:{} };
    getLista('ventas').forEach(function(v){
      [v && v.fbKey, v && v.id, v && v.numero, v && v.nro].forEach(function(k){ if(id(k)) idx.ventasPorId[id(k)] = v; });
    });
    getLista('clientes').forEach(function(c){
      [c && c.fbKey, c && c.id, c && c.idCliente, c && c.codigo, c && c.cuit, c && c.dni].forEach(function(k){ if(id(k)) idx.clientesPorId[id(k)] = c; });
    });
    getLista('productos').forEach(function(p){
      [p && p.codigo, p && p.cod, p && p.id, p && p.fbKey].forEach(function(k){ if(id(k)) idx.productosPorCodigo[id(k)] = p; });
    });
    getLista('pagos').forEach(function(p){
      var k = ventaPagoId(p); if(!k) return;
      (idx.pagosPorVenta[k] = idx.pagosPorVenta[k] || []).push(p);
    });
    getLista('ot').forEach(function(o){
      var k = id(o && (o.ventaId || o.idVenta || o.venta)); if(!k) return;
      (idx.otPorVenta[k] = idx.otPorVenta[k] || []).push(o);
    });
    getLista('gastos').forEach(function(g){
      var k = id(g && (g.empleadoId || g.idEmpleado || g.usuario || g.empleado)); if(!k) return;
      (idx.gastosPorEmpleado[k] = idx.gastosPorEmpleado[k] || []).push(g);
    });
    arr(window.empData || window.empleadosData || window.empleadosList).forEach(function(e){
      [e && e.usuario, e && e.email, e && e.user, e && e.nombreUsuario].forEach(function(k){ if(id(k)) idx.empleadosPorUsuario[lower(k)] = e; });
    });
    SV.Cache.indexes = idx;
    SV.Cache._builtAt = now;
    return idx;
  };
  SV.Cache.findVenta = function(k){ return SV.Cache.buildIndexes().ventasPorId[id(k)] || null; };
  SV.Cache.findCliente = function(k){ return SV.Cache.buildIndexes().clientesPorId[id(k)] || null; };
  SV.Cache.findProducto = function(k){ return SV.Cache.buildIndexes().productosPorCodigo[id(k)] || null; };
  SV.Cache.invalidate = function(){ SV.Cache._builtAt = 0; return SV.Cache.buildIndexes(true); };

  SV.Metrics.ventas = function(opts){
    opts = opts || {};
    var mes = opts.mes || mesActual();
    var ventas = getLista('ventas').filter(function(v){ return !v || lower(v.estado) !== 'anulada'; });
    var pagos = getLista('pagos').filter(function(p){ return !p || lower(p.estado) !== 'anulado'; });
    var idx = SV.Cache.buildIndexes();
    var delMes = ventas.filter(function(v){ return esMes(v && (v.fecha || v.fechaVenta || v.createdAt), mes); });
    var totalMes = 0, ivaMes = 0, cantMes = 0, pendienteCobro = 0, pendienteInstalacion = 0, cobradoMes = 0;
    delMes.forEach(function(v){
      var sign = signoComprobante(v);
      totalMes += sign * totalVenta(v);
      ivaMes += sign * num(v && (v.iva || v.iva21 || v.totalIva));
      cantMes += 1;
      var vid = ventaId(v);
      var pagado = (idx.pagosPorVenta[vid] || []).reduce(function(a,p){ return a + totalPago(p); }, 0);
      pendienteCobro += Math.max(0, totalVenta(v) - pagado);
      var ei = lower(v && (v.estadoInstalacion || v.instalacion || v.estadoOT || v.estado));
      if (ei.indexOf('instal') < 0 && ei.indexOf('complet') < 0 && ei.indexOf('finaliz') < 0) pendienteInstalacion += 1;
    });
    pagos.forEach(function(p){ if(esMes(p && (p.fecha || p.fechaPago || p.createdAt), mes)) cobradoMes += totalPago(p); });
    return { mes:mes, ventasMes:totalMes, cantidadMes:cantMes, pendienteCobro:pendienteCobro, pendienteInstalacion:pendienteInstalacion, ticketPromedio:cantMes ? totalMes / cantMes : 0, ivaMes:ivaMes, cobradoMes:cobradoMes };
  };

  SV.Metrics.tesoreria = function(opts){
    opts = opts || {};
    var mes = opts.mes || mesActual();
    var gastos = getLista('gastos').filter(function(g){ return lower(g && g.estado) === 'pagado' || num(g && g.pagado) > 0; });
    var pagos = getLista('pagos').filter(function(p){ return lower(p && p.estado) !== 'anulado'; });
    var out = { mes:mes, pagadoMes:0, cobradoMes:0, efectivo:0, transferencia:0, tarjeta:0, cheque:0, qr:0, otros:0, comprobantes:0 };
    gastos.forEach(function(g){
      if(!esMes(g && (g.fechaPago || g.fecha || g.createdAt), mes)) return;
      var monto = num(g.pagado || g.monto || g.importe || g.total);
      out.pagadoMes += monto;
      var t = medioTipo(g);
      if(t === 'efectivo') out.efectivo += monto;
      else if(t === 'transferencia') out.transferencia += monto;
      else if(t === 'tarjeta') out.tarjeta += monto;
      else if(t === 'cheque') out.cheque += monto;
      else if(t === 'qr') out.qr += monto;
      else out.otros += monto;
      if(g.comprobanteUrl || g.comprobante || g.archivoComprobante) out.comprobantes++;
    });
    pagos.forEach(function(p){ if(esMes(p && (p.fecha || p.fechaPago || p.createdAt), mes)) out.cobradoMes += totalPago(p); });
    return out;
  };

  SV.Metrics.ot = function(){
    var hoy = fecha(new Date());
    var lista = getLista('ot');
    var out = { abiertas:0, hoy:0, atrasadas:0, completadasHoy:0, completadasTotal:0 };
    lista.forEach(function(o){
      var estado = lower(o && o.estado);
      var f = fecha(o && (o.fecha || o.fechaProgramada || o.programada));
      var completada = estado.indexOf('complet') >= 0 || estado.indexOf('finaliz') >= 0;
      if(completada){ out.completadasTotal++; if(fecha(o && (o.fechaCierre || o.cerradaEn || o.updatedAt)) === hoy) out.completadasHoy++; }
      else { out.abiertas++; if(f === hoy) out.hoy++; if(f && f < hoy) out.atrasadas++; }
    });
    return out;
  };

  SV.Tables.filter = function(lista, texto, campos){
    var q = lower(texto); if(!q) return arr(lista);
    return arr(lista).filter(function(x){ return (campos || Object.keys(x || {})).some(function(c){ return lower(x && x[c]).indexOf(q) >= 0; }); });
  };
  SV.Tables.sort = function(lista, campo, dir){
    var mul = dir === 'desc' ? -1 : 1;
    return arr(lista).slice().sort(function(a,b){ var av = a && a[campo], bv = b && b[campo]; return av > bv ? mul : av < bv ? -mul : 0; });
  };

  SV.Modal.confirmar = function(msg, onOk){
    if (window.confirm(msg || 'Confirmar acción')) { if (typeof onOk === 'function') onOk(); return true; }
    return false;
  };
  SV.Modal.alerta = function(msg){ if (typeof window.notify === 'function') window.notify(msg); else alert(msg); };
  SV.Notify.toast = function(msg){ if (typeof window.notify === 'function') window.notify(msg); else console.log(msg); };

  SV.Validate.venta = function(v){
    var errores = [];
    if(!v) errores.push('Venta vacía');
    if(v && !id(v.clienteId || v.idCliente) && !id(v.cliente || v.clienteNombre)) errores.push('Cliente obligatorio');
    if(v && totalVenta(v) <= 0) errores.push('Total inválido');
    return { ok: errores.length === 0, errores: errores };
  };
  SV.Validate.cobro = function(c){
    var errores = [];
    if(!c || num(c.monto) <= 0) errores.push('Monto obligatorio');
    if(!c || !id(c.medio || c.medioPago)) errores.push('Medio de pago obligatorio');
    return { ok: errores.length === 0, errores: errores };
  };
  SV.Validate.ot = function(o){
    var errores = [];
    if(!o || !id(o.cliente || o.clienteNombre)) errores.push('Cliente obligatorio');
    return { ok: errores.length === 0, errores: errores };
  };

  function refrescarDashTesoreria312(){
    var m = SV.Metrics.tesoreria();
    setText('tes-met-mes', money(m.pagadoMes));
    setText('tes-met-transfer', money(m.transferencia));
    setText('tes-met-efectivo', money(m.efectivo));
    setText('tes-met-comp', String(m.comprobantes));
  }
  function refrescarDashOT312(){
    var m = SV.Metrics.ot();
    setText('ot-met-abiertas', String(m.abiertas));
    setText('ot-met-hoy', String(m.hoy));
    setText('ot-met-comp', String(m.completadasTotal));
  }
  function refrescarDashVentas312(){
    if(!(window.tienePermiso && window.tienePermiso('ventas.verDashboard'))) return;
    var m = SV.Metrics.ventas();
    setText('vm-total-mes', money(m.ventasMes));
    setText('vm-cobrado', money(m.cobradoMes));
    setText('vm-pendiente', money(m.pendienteCobro));
    setText('vm-iva', money(m.ivaMes));
    setText('stat-ven-mes', money(m.ventasMes));
    setText('stat-ven-cant', String(m.cantidadMes));
    setText('stat-ven-pendiente', money(m.pendienteCobro));
    setText('stat-ven-ticket', money(m.ticketPromedio));
  }
  SV.Metrics.refresh = function(){
    SV.Cache.invalidate();
    refrescarDashVentas312();
    refrescarDashTesoreria312();
    refrescarDashOT312();
  };

  document.addEventListener('sisventas:page-changed', function(event){
    var page=event.detail&&event.detail.page;
    if(['dashboard','detalle','tesoreria','ordentrabajo','cobranzas'].indexOf(page) >= 0) setTimeout(SV.Metrics.refresh, 80);
  });
  ['renderDashboard','renderTesoreria','renderOTTabla','renderMetricasVentas','actualizarStatVentas'].forEach(function(fn){
    var prev = window[fn];
    if (typeof prev === 'function' && !prev._sv312) {
      window[fn] = function(){ var r = prev.apply(this, arguments); setTimeout(SV.Metrics.refresh, 60); return r; };
      window[fn]._sv312 = true;
    }
  });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(SV.Metrics.refresh, 500); });
})();
