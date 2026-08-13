const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.335 conserva sus archivos inmutables', () => {
  const app = read('js/app.v2.0.335.js');
  const immutable = read('js/core/version.v2.0.335.js');
  assert.match(app, /VERSION: 'v2\.0\.335-firebase'/);
  assert.match(app, /version: 'v2\.0\.335'/);
  assert.match(immutable, /SISVENTAS_PWA_VERSION = 'v2\.0\.335'/);
});
