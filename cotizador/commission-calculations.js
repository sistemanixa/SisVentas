'use strict';
const _gastosPagosCache=null;
function _gastoPagosArray(g) {
  if (_gastosPagosCache && g && _gastosPagosCache.has(g)) return _gastosPagosCache.get(g);
  var pagos = g && g.pagos ? g.pagos : {};
  var resultado;
  if (Array.isArray(pagos)) {
    resultado = pagos.map(function(p, idx){ return Object.assign({}, p || {}, { _idx:idx }); });
  } else {
    resultado = Object.keys(pagos).map(function(k){
      return Object.assign({}, pagos[k] || {}, { _key:k });
    }).sort(function(a,b){ return (a.ts||0)-(b.ts||0); });
  }
  if (_gastosPagosCache && g) _gastosPagosCache.set(g, resultado);
  return resultado;
}
function pagoGastoEstaAnulado(pago) {
  return !!(pago && (pago.anulado === true || String(pago.estado || '').toLowerCase() === 'anulado'));
}
function totalPagadoGasto(g) {
  if (!g) return 0;
  var pagos = _gastoPagosArray(g);
  if (pagos && pagos.length) {
    return Math.max(0,parseFloat(g.saldoPagadoLegacy)||0) + pagos.reduce(function(s,p){
      return s + (pagoGastoEstaAnulado(p) ? 0 : (parseFloat(p && p.monto) || 0));
    }, 0);
  }
  return parseFloat(g.montoPagado) || 0;
}
function normalizarEstadoGasto(g) {
  var est = String((g && g.estado) || '').toLowerCase();
  if (est === 'rechazado' || est === 'anulado') return est;
  var monto = parseFloat(g && g.monto) || 0;
  var pagado = totalPagadoGasto(g);
  if (monto > 0 && pagado >= monto - 0.01) return 'pagado';
  if (pagado > 0) return 'pagado_parcial';
  var esComision = String((g && (g.tipoPagable || g.origen)) || '').toLowerCase() === 'comision';
  var tieneAprobacion = !!(g && (g.aprobadoTs || g.aprobadoPor || g.fechaAprobacion));
  if (est === 'pendiente_aprobacion' || (g && g.requiereAprobacion && !tieneAprobacion)) return 'pendiente_aprobacion';
  // Las comisiones migradas por versiones anteriores quedaron erróneamente
  // como pendientes de pago aunque nunca habían sido aprobadas.
  if (esComision && !tieneAprobacion && est !== 'aprobado') return 'pendiente_aprobacion';
  if (est === 'aprobado' || est === 'pendiente_pago') return 'pendiente_pago';
  return 'pendiente_pago';
}
function esComision(gasto) {
    return String((gasto && (gasto.tipoPagable || gasto.origen || gasto.tipo)) || '').toLowerCase().indexOf('comisi') >= 0;
  }
function claveGrupo(gasto) {
    return String(gasto.ventaFbKey || gasto.ventaId || ('sinventa:' + gasto.fbKey));
  }
function porcentaje(gasto, movimiento) {
    var directo = parseFloat((movimiento && movimiento.pct) || gasto.pct || gasto.porcentaje);
    if (directo > 0) return directo;
    var match = String((movimiento && movimiento.descripcion) || gasto.descripcion || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
    return match ? (parseFloat(match[1].replace(',', '.')) || 0) : 0;
  }
function baseGanancia(gasto, movimiento) {
    var base = parseFloat((movimiento && movimiento.gananciaBase) || gasto.gananciaBase);
    if (base > 0) return base;
    var pct = porcentaje(gasto, movimiento);
    return pct > 0 ? (parseFloat(gasto.monto) || 0) * 100 / pct : 0;
  }
function registroComparable(record){
    var copy=Object.assign({},record||{});delete copy.fbKey;delete copy.empFbKey;delete copy.movFbKey;return copy;
  }
module.exports={totalPagadoGasto,normalizarEstadoGasto,esComision,claveGrupo,porcentaje,baseGanancia,registroComparable};
