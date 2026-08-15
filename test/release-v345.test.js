const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.345 publica el flujo completo de presupuestos para Admin', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.345.js');
  const core = read('js/core/version.v2.0.345.js');
  assert.match(index, /VERSION: 'v2\.0\.345-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.345\.js/);
  assert.match(app, /VERSION: 'v2\.0\.345-firebase'/);
  assert.match(app, /version: 'v2\.0\.345'/);
  assert.match(app, /Flujo completo de presupuestos para Admin/);
  assert.equal(read('js/app.js'), app);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v2\.0\.345'/);
  assert.equal(read('js/core/version.js'), core);
  assert.match(read('sw.js'), /sisventas-v2\.0\.345/);
});
