const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = require('./helpers/active-app').readActiveApp().source;
const html = fs.readFileSync('index.html', 'utf8');
const modulo = fs.readFileSync('js/modules/commissions.js', 'utf8');

test('una comisión pendiente de aprobación no integra el saldo del empleado', () => {
  assert.match(app, /if \(String\(m\.tipo \|\| ''\)\.toLowerCase\(\) === 'comision'\)[\s\S]*?estadoComision === 'aprobado' \|\| estadoComision === 'pagado_parcial'/);
});

test('la incorporación histórica sigue disponible sin duplicados y sólo mediante mantenimiento explícito', async () => {
  assert.match(app, /function sincronizarComisionesLegacyConModulo\(\)/);
  const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
  const gasto={tipoPagable:'comision',tipo:'Comisión',legacyKey:'ctaemp/e/m',empleadoFbKey:'e',fecha:'2026-09-01',monto:50,montoPagado:20,saldoPagadoLegacy:20,estado:'pagado_parcial',nota:'Conservar el histórico'};
  const movimiento={tipo:'comision',fecha:'2026-09-01',monto:50,montoPagado:20,estado:'pagado_parcial'};
  const backend=createBackend({gastos:{historico:gasto},ctaemp:{e:{m:movimiento}}}),page=backend.page();
  assert.equal(await page.context._crearGastoComisionDesdeMovimiento('e','m',copy(movimiento)),'historico');
  assert.deepEqual(backend.get('sisventas/gastos/historico'),gasto);assert.equal(backend.get('sisventas/ctaemp/e/m/gastoFbKey'),'historico');
  await page.context._crearGastoComisionDesdeMovimiento('e','m',backend.get('sisventas/ctaemp/e/m'));
  assert.equal(Object.keys(backend.get('sisventas/gastos')).length,1);assert.equal(backend.commits.length,1);assert.deepEqual(backend.direct,[]);
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
