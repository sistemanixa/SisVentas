const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.359 conserva su cierre fiscal exacto en el archivo inmutable', () => {
  const app = read('js/app.js');
  const historico = read('js/app.v2.0.359.js');
  assert.match(historico, /VERSION: 'v2\.0\.359-firebase'/);
  assert.match(historico, /desplazamientoNeto = -3; desplazamientoNeto <= 3/);
  assert.match(historico, /El total de la venta no puede discriminarse con IVA al centavo/);
  assert.match(historico, /version: 'v2\.0\.359'/);
  assert.match(app, /VERSION: 'v2\.0\.360-firebase'/);
});
