const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.341 queda activa y coherente', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.341.js');
  const legacy = read('js/app.js');
  const core = read('js/core/version.js');
  const immutable = read('js/core/version.v2.0.341.js');
  const sw = read('sw.js');
  assert.match(index, /VERSION: 'v2\.0\.341-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.341\.js/);
  assert.match(index, /js\/core\/version\.v2\.0\.341\.js/);
  assert.match(app, /VERSION: 'v2\.0\.341-firebase'/);
  assert.match(app, /version: 'v2\.0\.341'/);
  assert.equal(legacy, app);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v2\.0\.341'/);
  assert.equal(immutable, core);
  assert.match(sw, /sisventas-v2\.0\.341/);
});

test('el detalle de horas extra conserva scroll y ventana ajustable', () => {
  const app = read('js/app.v2.0.341.js');
  assert.match(app, /max-height:min\(300px,36vh\);overflow-y:auto/);
  assert.match(app, /function _habilitarPanelHsExtraMovible/);
  assert.match(app, /resize:both/);
  assert.match(app, /hsex-admin-modal-header/);
});
