const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.363 conserva el CUIT fiscal al reconstruir una NC', () => {
  const app = read('js/app.js');
  assert.match(read('index.html'), /VERSION: 'v2\.0\.363-firebase'/);
  assert.match(read('js/core/version.js'), /v2\.0\.363/);
  assert.equal(read('js/app.v2.0.363.js'), app);
  assert.match(app, /clienteCuit: cuitFiscal \|\| venta\.clienteCuit/);
  assert.match(app, /version: 'v2\.0\.363'/);
});
