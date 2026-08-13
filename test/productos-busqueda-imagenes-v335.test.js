const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.335.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('ventas busca desde el primer carácter conservando debounce', () => {
  const inicio = app.indexOf('function filtrarVentas(v)');
  const fin = app.indexOf('function filtrarVentasEstado', inicio);
  const bloque = app.slice(inicio, fin);
  assert.doesNotMatch(bloque, /texto\.length < 3/);
  assert.match(bloque, /\}, 120\);/);
});

test('productos difiere la búsqueda y reutiliza textos normalizados', () => {
  assert.match(index, /id="prod-search-status"/);
  assert.match(app, /var _prodBusquedaListaCache = typeof WeakMap/);
  assert.match(app, /function _prodTextosBusquedaNormalizados/);
  assert.match(app, /var _prodBusquedaTimer = null/);
  assert.match(app, /_prodBusquedaTimer = setTimeout\(function\(\) \{ renderTablaProductos\(texto\); \}, 120\)/);
  assert.match(app, /if \(!_prodCategoriasFirma\)[\s\S]{0,100}poblarSelectCategorias/);
  assert.match(app, /function _renderDropGlobal[\s\S]*?_prodTextosBusquedaNormalizados\(p\)\.todo/);
  assert.match(app, /function programarRenderBusqAvanz[\s\S]{0,180}setTimeout\(renderBusqAvanz, 120\)/);
});

test('los listados visuales principales muestran imagen de producto', () => {
  assert.match(app, /asist-prod-row[\s\S]{0,140}imagenProductoItemHTML/);
  assert.match(app, /id="ba-resultados"[\s\S]*?function renderBusqAvanz/);
  assert.match(app, /seleccionarProdAvanz[\s\S]{0,700}imagenProductoItemHTML/);
  assert.match(app, /modal-listado-actualizador-precios[\s\S]*?imagenProductoItemHTML/);
  assert.match(app, /data-revision-producto[\s\S]{0,500}imagenProductoItemHTML/);
  assert.match(app, /prod-drop-item[\s\S]{0,500}imagenProductoItemHTML/);
});
