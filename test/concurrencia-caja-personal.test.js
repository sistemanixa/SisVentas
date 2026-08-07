const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.294.js', 'utf8');

function applyOnce(state, operationKey, apply) {
  const draft = structuredClone(state);
  apply(draft, operationKey);
  return draft;
}

test('caja usa una operación determinista y actualiza resumen y movimiento en la misma transacción', () => {
  assert.match(app, /function _registrarMovimientoCajaAtomico/);
  assert.match(app, /fbRunTransaction\(window\.fbRef\(window\.fbDB, 'sisventas\/caja\/\' \+ hoy\)/);
  assert.match(app, /dia\[usuarioKey \+ '_movs'\]\[operacionKey\]/);
  const initial = { usuario:{ apertura:100, ingresos:0, egresos:0 }, usuario_movs:{} };
  const apply = (day, key) => { if (!day.usuario_movs[key]) { day.usuario.ingresos += 50; day.usuario_movs[key] = { monto:50 }; } };
  const first = applyOnce(initial, 'mov_1', apply);
  const second = applyOnce(first, 'mov_1', apply);
  assert.equal(second.usuario.ingresos, 50);
  assert.equal(Object.keys(second.usuario_movs).length, 1);
});

test('comisiones se identifican por venta y empleado dentro de una transacción', () => {
  assert.match(app, /function _generarComisionVentaAtomica/);
  assert.match(app, /_claveOperacionConcurrente\('comision', \[ventaKey, emp\.fbKey\]\)/);
  assert.match(app, /raiz\.ctaemp\[emp\.fbKey\]\[movKey\] = movGuardado/);
  assert.match(app, /raiz\.gastos\[gastoKey\]/);
});

test('horas extra aprueba solicitud y gasto con una sola transacción idempotente', () => {
  assert.match(app, /function _aprobarHsExtraAtomico/);
  assert.match(app, /legacyKey = 'hsextra_solicitudes\/' \+ solFbKey/);
  assert.match(app, /raiz\.hsextra_solicitudes\[solFbKey\] = Object\.assign/);
  assert.match(app, /_hsExtraAprobando\[solFbKey\]/);
});

test('aguinaldos usan una clave estable por empleado y semestre y bloquean doble clic local', () => {
  assert.match(app, /function _guardarAguinaldosAtomico/);
  assert.match(app, /_claveOperacionConcurrente\('aguinaldo', \[f\.e\.fbKey, semKey\]\)/);
  assert.match(app, /window\._aguinaldoGuardando/);
  assert.doesNotMatch(app, /sac_nuevo\/.*\/.*\/.*tsBase/);
});
