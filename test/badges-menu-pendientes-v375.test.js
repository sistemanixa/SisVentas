const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { readActiveApp } = require('./helpers/active-app');

const activo = readActiveApp();
const app = activo.source;
const html = activo.index;

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  return app.slice(inicio, fin);
}

test('Gastos cuenta todas las obligaciones que requieren acción y excluye comisiones', () => {
  const badge = { textContent:'', title:'', style:{} };
  const contexto = {
    gastosData: [
      { tipoPagable:'gasto_empresa', estado:'pendiente_aprobacion', monto:100, pagado:0 },
      { tipoPagable:'adelanto', estado:'pendiente_pago', monto:200, pagado:0 },
      { tipoPagable:'gasto_empresa', estado:'pagado_parcial', monto:300, pagado:100 },
      { tipoPagable:'gasto_empresa', estado:'pagado', monto:50, pagado:50 },
      { tipoPagable:'comision', estado:'pendiente_pago', monto:400, pagado:0 }
    ],
    document: { getElementById:id => id === 'badge-nav-gastos' ? badge : null },
    window: { tienePermiso:permiso => permiso === 'gastos.pagar' },
    restoGasto:g => Math.max(0, g.monto - g.pagado),
    normalizarEstadoGasto:g => g.estado
  };
  vm.createContext(contexto);
  vm.runInContext(bloque('function _actualizarBadgeSolicitudesGastos()', 'function _programarTareasSecundariasGastos()'), contexto);
  contexto._actualizarBadgeSolicitudesGastos();
  assert.equal(badge.textContent, 3);
  assert.equal(badge.style.display, '');
  assert.match(badge.title, /3 gastos pendientes/);
});

test('los únicos módulos con contador rojo propio son Empleados, Gastos y Comisiones', () => {
  const ids = Array.from(html.matchAll(/id="(badge-nav-[^"]+)"/g), m => m[1]).sort();
  assert.deepEqual(ids, ['badge-nav-comisiones','badge-nav-empleados','badge-nav-gastos']);
  assert.match(html, /id="notif-badge"/);
});
