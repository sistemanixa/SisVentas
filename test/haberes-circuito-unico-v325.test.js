const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.2.5.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('haberes y aguinaldos exigen administrador en interfaz y lógica', () => {
  assert.match(html, /emp-action-haberes admin-only/);
  assert.match(html, /emp-action-aguinaldo admin-only/);
  assert.match(app, /Solo el administrador puede registrar haberes/);
  assert.match(app, /Solo el administrador puede registrar aguinaldos/);
});

test('el haber nace aprobado y pendiente de pago en las fuentes relacionadas', () => {
  const start = app.indexOf('async function confirmarRegistroHaberes');
  const end = app.indexOf('// ═', start);
  const flow = app.slice(start, end);
  assert.match(flow, /_pagableGastoBase\(\{[\s\S]*?tipoPagable:\s+'sueldo'/);
  assert.match(flow, /estado:\s+'aprobado'/);
  assert.doesNotMatch(flow, /estado:\s+'Pagado'/);
});

test('un mes histórico usa el historial del cargo y recalcula al cambiar el mes', () => {
  assert.match(app, /function _cargoValorHoraParaMes\(cargo, mesISO\)/);
  assert.match(app, /_cargoHistorialValorHora\(cargo\)/);
  assert.match(app, /_habFilasActuales = _habCrearFilas\(mesISO\)/);
  assert.match(app, /if \(body\) body\.innerHTML = _renderTablaHaberes/);
});

test('nuevo movimiento no ofrece ni acepta sueldo, horas extra o comisión', () => {
  const selectStart = html.indexOf('id="movi-tipo"');
  const selectEnd = html.indexOf('</select>', selectStart);
  const movementTypes = html.slice(selectStart, selectEnd);
  assert.doesNotMatch(movementTypes, /<option value="(?:sueldo|hextra|comision)">/);
  assert.match(app, /\['sueldo','hextra','comision'\]\.includes\(tipoElegido\)/);
});
