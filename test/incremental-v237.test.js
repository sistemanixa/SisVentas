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

test('la auditoria resuelve la clave Firebase dentro del catalogo normalizado', () => {
  assert.match(app, /Object\.values\(prodData\)\.find/);
  assert.match(app, /String\(p\.fbKey \|\| ''\) === clave/);
  assert.match(app, /verProducto\(producto\.fbKey, 'auditoria-integral-precios'\)/);
  assert.doesNotMatch(app, /!prodData\[clave\]/);
});

test('el anclaje de escritorio queda como control compacto solo con icono', () => {
  const button = index.match(/<button class="sidebar-pin"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(button, /ti ti-pin/);
  assert.doesNotMatch(button, /<span>/);
  assert.match(css, /\.sidebar-pin\{[^}]*width:32px/);
});

test('la publicacion corresponde a v2.0.237', () => {
  assert.match(app, /VERSION: 'v2\.0\.237-firebase'/);
  assert.match(index, /app\.v2\.0\.237\.js/);
  assert.match(index, /version\.v2\.0\.237\.js/);
  assert.match(sw, /sisventas-v2\.0\.237/);
});
