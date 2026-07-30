const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const css = read('css', 'app.css');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('las grillas pasan a tarjetas en todo ancho intermedio hasta 900px', () => {
  assert.match(css, /@media\(max-width:900px\)\{\s*#role-badge-el/);
  assert.match(css, /@media\(max-width:900px\)\{\s*#page-gastos \.metrics/);
  assert.doesNotMatch(css, /max-width:900px\) and \(orientation:portrait\)/);
});

test('la publicacion corresponde a v2.0.233', () => {
  assert.match(app, /VERSION: 'v2\.0\.233-firebase'/);
  assert.match(index, /app\.v2\.0\.233\.js/);
  assert.match(index, /version\.v2\.0\.233\.js/);
  assert.match(sw, /sisventas-v2\.0\.233/);
});
