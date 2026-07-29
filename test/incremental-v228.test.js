const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const css = read('css', 'app.css');
const sw = read('sw.js');

test('la vista previa de presupuesto tiene un único punto de entrada', () => {
  assert.match(app, /filter\(key => key !== 'imprimir'\)/);
  assert.match(app, /const card = document\.getElementById\('ppto-acciones-card'\)/);
  assert.match(app, /if \(card\) card\.style\.display = 'none'/);
});

test('las acciones de presupuesto aprovechan el ancho de escritorio', () => {
  assert.match(index, /id="ppto-acciones-lista" class="ppto-acciones-grid"/);
  assert.match(css, /\.ppto-acciones-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(240px,1fr\)\)/);
});

test('la publicación corresponde a v2.0.228', () => {
  const version = app.match(/VERSION: 'v(\d+\.\d+\.\d+)-firebase'/);
  assert.ok(version, 'app.js debe declarar una version publicable');
  const escaped = version[1].replace(/\./g, '\\.');
  assert.match(index, new RegExp('app\\.v' + escaped + '\\.js'));
  assert.match(index, new RegExp('version\\.v' + escaped + '\\.js'));
  assert.match(sw, new RegExp('sisventas-v' + escaped));
});
