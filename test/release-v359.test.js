const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.359 publica el cierre fiscal exacto y un archivo inmutable', () => {
  const app = read('js/app.js');
  assert.match(read('index.html'), /VERSION: 'v2\.0\.359-firebase'/);
  assert.match(read('index.html'), /js\/app\.v2\.0\.359\.js/);
  assert.match(app, /VERSION: 'v2\.0\.359-firebase'/);
  assert.equal(read('js/app.v2.0.359.js'), app);
  assert.match(app, /desplazamientoNeto = -3; desplazamientoNeto <= 3/);
  assert.match(app, /El total de la venta no puede discriminarse con IVA al centavo/);
  assert.match(app, /version: 'v2\.0\.359'/);
});
