const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.361 conserva la NC en el punto de venta de la factura original', () => {
  const app = read('js/app.js');
  assert.match(read('index.html'), /VERSION: 'v2\.0\.361-firebase'/);
  assert.match(read('js/core/version.js'), /v2\.0\.361/);
  assert.equal(read('js/app.v2.0.361.js'), app);
  assert.match(app, /puntoVenta: snapshot\.punto_venta \|\| v\.factura\.punto_venta/);
  assert.match(app, /version: 'v2\.0\.361'/);
});
