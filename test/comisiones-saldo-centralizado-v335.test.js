const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = require('./helpers/active-app').readActiveApp().source;
const html = fs.readFileSync('index.html', 'utf8');
const modulo = fs.readFileSync('js/modules/commissions.js', 'utf8');

test('una comisión pendiente de aprobación no integra el saldo del empleado', () => {
  assert.match(app, /if \(String\(m\.tipo \|\| ''\)\.toLowerCase\(\) === 'comision'\)[\s\S]*?estadoComision === 'aprobado' \|\| estadoComision === 'pagado_parcial'/);
});

test('la incorporación histórica sigue disponible sin duplicados y sólo mediante mantenimiento explícito', () => {
  assert.match(app, /function sincronizarComisionesLegacyConModulo\(\)/);
  assert.match(app, /String\(g\.legacyKey\|\|''\) === legacyKey/);
  assert.match(app, /gastoFbKey:claveExistente/);
  assert.doesNotMatch(modulo, /window\.sincronizarComisionesLegacyConModulo\(\)/);
  const maintenance = fs.readFileSync('js/modules/maintenance.js', 'utf8');
  assert.match(maintenance, /async function mntMigrarLegacy\(\)[\s\S]*?mntRequireAdmin\('migraciones de mantenimiento','mantenimiento\.migrar'\)/);
  assert.match(maintenance, /await _crearGastoComisionDesdeMovimiento\(empKeyCom, movKeyCom, movCom\)/);
});

test('la carga y las decisiones quedan en Comisiones', () => {
  assert.match(html, /onclick="abrirModalComisionVenta\(\)"[^>]*>[\s\S]*?Nueva comisión/);
  assert.doesNotMatch(app, /m\.tipo === 'comision'[\s\S]{0,300}?aprobarComision\(\\'/);
  assert.match(app, /m\.tipo === 'comision'[\s\S]{0,300}?abrirComisionDesdeGasto/);
});
