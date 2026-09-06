const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('paquete inmutable v3.3.13 consistente', () => {
  const index = fs.readFileSync('index.html', 'utf8');
  const app = fs.readFileSync('js/app.v3.3.13.js', 'utf8');
  const core = fs.readFileSync('js/core/version.v3.3.13.js', 'utf8');
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.match(index, /VERSION: 'v3\.3\.13-firebase'/);
  assert.match(index, /js\/app\.v3\.3\.13\.js/);
  assert.match(index, /js\/core\/version\.v3\.3\.13\.js/);
  assert.match(app, /VERSION: 'v3\.3\.13-firebase'/);
  assert.match(app, /version: 'v3\.3\.13'/);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v3\.3\.13'/);
  assert.match(sw, /const CACHE = 'sisventas-v3\.3\.13'/);
});
