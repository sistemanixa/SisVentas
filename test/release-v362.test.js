const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.362 envía la NC desde el punto de venta de la factura original', () => {
  const app = read('js/app.v2.0.362.js');
  assert.match(app, /esNotaCredito: true,[\s\S]{0,300}puntoVenta: snapshot\.punto_venta \|\| v\.factura\.punto_venta/);
  assert.match(app, /version: 'v2\.0\.362'/);
});
