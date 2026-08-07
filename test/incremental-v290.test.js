const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.290.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const metrics = fs.readFileSync(path.join(root, 'js', 'modules', 'sales-metrics.js'), 'utf8');
const coreVersion = fs.readFileSync(path.join(root, 'js', 'core', 'version.v2.0.290.js'), 'utf8');
const lightVersion = fs.readFileSync(path.join(root, 'js', 'core', 'version.js'), 'utf8');

test('la publicacion v2.0.290 usa referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.290\.js/);
  assert.match(index, /version\.v2\.0\.290\.js/);
  assert.match(index, /sales-metrics\.js\?v=2\.0\.289/);
  assert.match(app, /VERSION:\s*'v2\.0\.290-firebase'/);
  assert.match(coreVersion, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.290'/);
  assert.match(lightVersion, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.290'/);
  assert.match(worker, /sisventas-v2\.0\.290/);
});

test('los cobros globales desplazan a la copia embebida de una migracion', () => {
  const start = app.indexOf('function _svTxtClave');
  const end = app.indexOf('function ventasPagosV3Invocar');
  assert.ok(start >= 0 && end > start);
  const context = {
    window: {
      _historialPagosCompleto: [{ fbKey: '-pago-real', ventaFbKey: '-venta', monto: 348991 }]
    }
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);

  const venta = {
    fbKey: '-venta',
    id: 'V-109695',
    total: 697981.5,
    totalPagado: 697981.5,
    pagos: [{ monto: 697981.5, medio: 'Importado', obs: 'Migrado desde dbventas' }]
  };
  const canonicos = context._svPagosCanonicosVenta(venta);
  assert.equal(canonicos.length, 1);
  assert.equal(canonicos[0].fbKey, '-pago-real');
  assert.equal(canonicos.reduce((s, p) => s + p.monto, 0), 348991);
});

test('una referencia tecnica de pago nunca cae a otra venta con el mismo numero', () => {
  const start = app.indexOf('function _svTxtClave');
  const end = app.indexOf('function ventasPagosV3Invocar');
  const context = { window: { _historialPagosCompleto: [] } };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  const pago = { ventaFbKey: '-otra-venta', ventaId: 'V-109695', monto: 100 };
  assert.equal(context._svRegistroPerteneceVenta(pago, { fbKey: '-venta', id: 'V-109695' }), false);
});

test('detalle, cuenta corriente y metricas no suman resumen legacy sobre pagos reales', () => {
  assert.match(app, /if \(pagos\.length\) \{[\s\S]*?return pagado > 0 \? 'seniado' : 'pendiente_pago'/);
  assert.match(app, /var pagos = _svPagosCanonicosVenta\(v\)/);
  assert.match(app, /var pagado = pagos\.length \? pagadoPorPagos : _svResumenPagoLegacyVenta\(v\)/);
  assert.match(app, /return pagos\.length \? desdePagos : _svResumenPagoLegacyVenta\(venta\)/);
  assert.match(metrics, /return pagos\.length \? desdePagos/);
  assert.doesNotMatch(metrics, /Math\.max\(desdePagos, directo/);
});
