const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.337 queda activa y coherente', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.337.js');
  const legacy = read('js/app.js');
  const core = read('js/core/version.js');
  const immutable = read('js/core/version.v2.0.337.js');
  const sw = read('sw.js');
  assert.match(index, /VERSION: 'v2\.0\.337-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.337\.js/);
  assert.match(app, /VERSION: 'v2\.0\.337-firebase'/);
  assert.match(app, /version: 'v2\.0\.337'/);
  assert.equal(legacy, app);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v2\.0\.337'/);
  assert.equal(immutable, core);
  assert.match(sw, /sisventas-v2\.0\.337/);
});
