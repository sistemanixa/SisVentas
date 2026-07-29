const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const css = read('css', 'app.css');
const index = read('index.html');
const sw = read('sw.js');

test('presupuestos usa desplazamiento horizontal real en celular', () => {
  assert.match(index, /sv-ppto-mobile-scroll-hint/);
  assert.match(index, /Deslizá la tabla para ver todas las columnas/);
  assert.match(css, /#page-presupuesto #ppto-tabla\.sv-percent-table/);
  assert.match(css, /width:780px!important;min-width:780px!important/);
  assert.match(css, /#page-presupuesto #ppto-list-view \.table-wrap\{[^}]*overflow-x:auto!important/);
});

test('la referencia queda visible y los estados no se parten', () => {
  assert.match(css, /#page-presupuesto #ppto-tabla td:first-child\{position:sticky/);
  assert.match(css, /#page-presupuesto #ppto-tabla td:nth-child\(5\) \.badge\{white-space:nowrap!important\}/);
  assert.match(css, /#page-presupuesto #ppto-list-view \.sv-column-percent-btn\{display:none!important\}/);
});

test('todos los archivos publicados corresponden a v2.0.224', () => {
  assert.match(app, /VERSION: 'v2\.0\.224-firebase'/);
  assert.match(index, /app\.v2\.0\.224\.js/);
  assert.match(index, /version\.v2\.0\.224\.js/);
  assert.match(index, /resizable-tables\.js\?v=2\.0\.224/);
  assert.match(index, /page-transition\.js\?v=2\.0\.224/);
  assert.match(sw, /sisventas-v2\.0\.224/);
});
