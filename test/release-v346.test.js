const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.346 publica el flujo simplificado de presupuestos', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.346.js');
  const core = read('js/core/version.v2.0.346.js');
  assert.match(index, /VERSION: 'v2\.0\.346-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.346\.js/);
  assert.match(app, /VERSION: 'v2\.0\.346-firebase'/);
  assert.match(app, /version: 'v2\.0\.346'/);
  assert.match(app, /Presupuestos con acciones simples/);
  assert.equal(read('js/app.js'), app);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v2\.0\.346'/);
  assert.equal(read('js/core/version.js').replace(/\r\n/g, '\n'), core.replace(/\r\n/g, '\n'));
  assert.match(read('sw.js'), /sisventas-v2\.0\.346/);
});
