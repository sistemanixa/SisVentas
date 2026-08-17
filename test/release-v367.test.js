const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.367 asigna título al comprobante desde la apertura', () => {
  const app = read('js/app.js');
  assert.match(read('index.html'), /VERSION: 'v2\.0\.367-firebase'/);
  assert.equal(read('js/app.v2.0.367.js'), app);
  assert.match(app, /SisVentas · Consultando comprobante/);
  assert.match(app, /w\.document\.title = 'SisVentas · ' \+ tipoComp/);
  assert.match(app, /Imprimir \/ Guardar PDF/);
});
