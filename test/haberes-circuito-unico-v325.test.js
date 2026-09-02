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

test('los adelantos aprobados del circuito legado se detectan y normalizan al aplicarse', () => {
  assert.match(app, /function _adelantoEsEntregaLegacy\(mov\)/);
  assert.match(app, /if \(!entregado && _adelantoEsEntregaLegacy\(mov\)\) entregado = monto/);
  assert.match(app, /function _normalizarAdelantoLegacyAlAplicar\(/);
  assert.match(app, /origen:'adelanto_personal_legacy'/);
  assert.ok((app.match(/_normalizarAdelantoLegacyAlAplicar\(/g) || []).length >= 3,
    'la normalización debe usarse en la liquidación y en la reparación posterior');
});

test('un adelanto cargado por un gestor nace pagado y exige medio de pago', () => {
  assert.match(app, /function _puedeGestionarAdelantos\(\)/);
  assert.match(app, /rol === 'admin' \|\| rol === 'administrativo'/);
  assert.match(app, /if \(esGestorAdelanto && tipoElegido === 'adelanto'\) estadoElegido = 'pagado';/);
  assert.match(app, /if \(esGestorAdelanto && estadoElegido === 'pagado' && !medioElegido\)/);
  assert.match(app, /origenCarga: esGestorAdelanto \? 'gestion' : 'solicitud_empleado'/);
});

test('gastos permite revisar directamente el mes anterior', () => {
  assert.match(html, /<option value="anterior">Mes anterior<\/option>/);
  assert.match(app, /else if \(fMes === 'anterior'\)/);
  assert.match(app, /mesesImputacion\.indexOf\(mesAnterior\) >= 0/);
});
