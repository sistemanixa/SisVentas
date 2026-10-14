'use strict';
// Reglas de cálculo conservadas del cliente activo; no dependen del navegador.
function _claveOperacionConcurrente(prefijo, partes) {
  return String(prefijo) + '_' + partes.map(function(parte) {
    return String(parte == null ? '' : parte).replace(/[^A-Za-z0-9_-]/g, '_');
  }).join('_');
}
function _hsexClaveEmpleadoMes(empFbKey, mes) {
  return String(empFbKey || 'empleado').replace(/[^a-zA-Z0-9_-]/g, '_') + '|' + String(mes || '').slice(0, 7);
}
function _hsexConsolidarDetalle(detalles) {
  var porDiaLugar = {};
  (detalles || []).forEach(function(d) {
    var fecha = String((d || {}).fecha || '').slice(0, 10);
    var lugar = String((d || {}).lugar || '').trim();
    var horas = parseFloat((d || {}).horas) || 0;
    if (!fecha || horas <= 0) return;
    var clave = fecha + '|' + lugar.toLowerCase();
    if (!porDiaLugar[clave]) porDiaLugar[clave] = { fecha:fecha, horas:0, lugar:lugar };
    porDiaLugar[clave].horas += horas;
  });
  return Object.values(porDiaLugar).sort(function(a,b){ return a.fecha.localeCompare(b.fecha); });
}
function _hsexDescripcionDetalle(detalle, observaciones) {
  var resumen = (detalle || []).map(function(d) {
    return String(d.fecha || '').split('-').reverse().join('/') + ': ' + d.horas + ' hs en ' + d.lugar;
  }).join(' · ');
  return resumen + (observaciones ? ' — ' + observaciones : '');
}
function _hsexAgruparPendientes(pendientes) {
  var grupos = {};
  (pendientes || []).forEach(function(s) {
    var mes = String(s.mes || s.fecha || '').slice(0,7);
    var clave = _hsexClaveEmpleadoMes(s.empFbKey, mes);
    if (!grupos[clave]) grupos[clave] = { id:clave, empFbKey:s.empFbKey, empNombre:s.empNombre, mes:mes, solicitudes:[], detalleDias:[], horas:0 };
    grupos[clave].solicitudes.push(s);
    grupos[clave].detalleDias = grupos[clave].detalleDias.concat(Array.isArray(s.detalleDias) ? s.detalleDias : []);
    grupos[clave].horas += parseFloat(s.horas) || 0;
  });
  return Object.values(grupos).map(function(g) {
    g.detalleDias = _hsexConsolidarDetalle(g.detalleDias);
    if (g.detalleDias.length) g.horas = g.detalleDias.reduce(function(total,d){ return total + (parseFloat(d.horas)||0); }, 0);
    return g;
  }).sort(function(a,b){ return (b.mes||'').localeCompare(a.mes||'') || String(a.empNombre||'').localeCompare(String(b.empNombre||'')); });
}
function _pagableNormFecha(f) {
  if (!f) return '';
  f = String(f);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) return f.slice(6)+'-'+f.slice(3,5)+'-'+f.slice(0,2);
  return f.slice(0,10);
}
function _pagableNormMonto(n) { return Math.round((parseFloat(n)||0) * 100) / 100; }
function _pagableEstadoPendiente() { return 'Pendiente'; }
function _pagableGastoBase(payload) {
  var monto = _pagableNormMonto(payload.monto);
  return {
    fecha: _pagableNormFecha(payload.fecha) || new Date().toISOString().slice(0,10),
    tipo: payload.tipo || 'Variable',
    tipoPagable: payload.tipoPagable,
    descripcion: payload.descripcion || '',
    categoria: 'Personal',
    monto: monto,
    medio: payload.medio || 'Transferencia',
    estado: _pagableEstadoPendiente(),
    empleadoId: payload.empleadoFbKey || payload.empleadoId || '',
    empleadoFbKey: payload.empleadoFbKey || payload.empleadoId || '',
    empleadoNombre: payload.empleadoNombre || '',
    mes: (_pagableNormFecha(payload.fecha)||'').slice(0,7),
    // Para horas extra, este dato conserva el mes real trabajado aunque el
    // gasto se impute en el mes de la aprobación/pago.
    periodoTrabajo: String(payload.periodoTrabajo || '').slice(0,7),
    fechaTrabajo: _pagableNormFecha(payload.fechaTrabajo),
    fechaImputacion: _pagableNormFecha(payload.fecha),
    aprobadoTs: payload.aprobadoTs || null,
    semestre: payload.semestre || '',
    mejorSueldo: payload.mejorSueldo || null,
    hsExtra: payload.hsExtra || null,
    origenLegacy: payload.origenLegacy || '',
    legacyKey: payload.legacyKey || '',
    migradoDesdeLegacy: !!payload.origenLegacy,
    ts: payload.ts || Date.now()
  };
}
module.exports={_claveOperacionConcurrente,_hsexAgruparPendientes,_hsexDescripcionDetalle,_hsexConsolidarDetalle,_pagableGastoBase};
