const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.348 publica el progreso visible de la conversión', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.348.js');
  assert.match(index, /VERSION: 'v2\.0\.348-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.348\.js/);
  assert.match(app, /VERSION: 'v2\.0\.348-firebase'/);
  assert.match(app, /data-ppto-accion="\$\{key\}"/);
  assert.match(app, /Verificando presupuesto…/);
  assert.match(app, /Reservando número de venta…/);
  assert.match(app, /Creando y vinculando la venta…/);
  assert.match(app, /botonConversionPpto\.disabled = true/);
  assert.equal(read('js/app.js'), app);
  assert.match(read('js/core/version.v2.0.348.js'), /v2\.0\.348/);
  assert.match(read('sw.js'), /sisventas-v2\.0\.348/);
});
