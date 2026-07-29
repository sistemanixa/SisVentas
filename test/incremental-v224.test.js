const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('la publicación histórica v2.0.224 permanece disponible', () => {
  const app = read('js', 'app.v2.0.224.js');
  const version = read('js', 'core', 'version.v2.0.224.js');
  assert.match(app, /VERSION: 'v2\.0\.224-firebase'/);
  assert.match(version, /SISVENTAS_PWA_VERSION = 'v2\.0\.224'/);
});
