const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const css = read('css', 'app.css');
const transition = read('js', 'modules', 'page-transition.js');
const sw = read('sw.js');

test('el catálogo usa métricas operativas y no ejecuta la auditoría profunda al renderizar', () => {
  assert.match(app, /function metricasListaProducto\(p\)/);
  assert.match(app, /function invalidarMetricasListaProductos\(\)/);
  assert.match(app, /productoSinPrecioCatalogo\(p\)[\s\S]*metricasListaProducto\(p\)/);
  assert.match(app, /ordenProductos\.col === 'venta'[\s\S]*metricasListaProducto\(p\)\.venta/);
});

test('los recordatorios sólo funcionan dentro de una sesión válida', () => {
  assert.match(app, /function _svSesionActivaParaVencimientos\(\)/);
  assert.match(app, /function detenerFlujoVentas\(\)/);
  assert.match(app, /if \(!_svSesionActivaParaVencimientos\(\)\) return/);
  assert.match(css, /\.sv-action-alert-stack/);
  assert.match(app, /sv-action-alert-open/);
});

test('los módulos pesados terminan el cartel con un evento real de render', () => {
  ['clientes', 'productos', 'detalle', 'presupuesto', 'ordentrabajo', 'gastos'].forEach((page) => {
    assert.match(transition, new RegExp(page + ":"));
  });
  assert.match(transition, /sisventas:module-ready/);
  assert.match(transition, /MAX_VISIBLE_MS = 8000/);
  assert.match(app, /function _svPrepararVistaModulo\(id, demora, preparar\)/);
  assert.match(css, /\.page\.sv-page-transitioning>\.sv-page-transition-loader/);
});

test('la instantánea histórica v2.0.222 permanece disponible', () => {
  const historicalApp = read('js', 'app.v2.0.222.js');
  const historicalVersion = read('js', 'core', 'version.v2.0.222.js');
  assert.match(historicalApp, /VERSION: 'v2\.0\.222-firebase'/);
  assert.match(historicalVersion, /v2\.0\.222/);
});
