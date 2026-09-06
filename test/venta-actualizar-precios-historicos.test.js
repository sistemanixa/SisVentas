const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v3.3.12.js', 'utf8');

test('el actualizador resuelve ventas históricas por descripción exacta', () => {
  assert.match(app, /if \(!prod && item\) \{\s*prod = lista\.find\(function\(p\)\{ return productoCoincideItemVenta\(p, item\); \}\);/);
});

test('al editar una venta conserva todas las referencias disponibles', () => {
  assert.match(app, /if \(it\.pid \|\| it\.productoFbKey \|\| it\.productoKey \|\| it\.fbKeyProducto\)/);
  assert.match(app, /tr\.dataset\.productoFbKey = it\.pid \|\| it\.productoFbKey \|\| it\.productoKey \|\| it\.fbKeyProducto/);
});
