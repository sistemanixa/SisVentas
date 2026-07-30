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

test('tablet vertical presenta las grillas como tarjetas', () => {
  assert.match(css, /@media\(max-width:720px\), \(min-width:721px\) and \(max-width:900px\) and \(orientation:portrait\)/);
  assert.match(css, /table\.sv-mobile-card-grid tbody > tr\{[\s\S]{0,220}grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('tablet horizontal libera el ancho y conserva las tablas', () => {
  assert.match(css, /@media \(min-width:901px\) and \(max-width:1100px\) and \(orientation:landscape\)/);
  assert.match(css, /\.sidebar\.open\{left:0;box-shadow:4px 0 20px/);
  assert.match(css, /\.hamburger\{display:flex!important\}/);
  assert.match(css, /@media \(min-width:1101px\)/);
});

test('la publicación mantiene coherentes sus referencias versionadas', () => {
  const version = app.match(/VERSION: 'v(\d+\.\d+\.\d+)-firebase'/);
  assert.ok(version);
  assert.match(index, new RegExp('app\\.v' + version[1].replace(/\./g, '\\.') + '\\.js'));
  assert.match(index, new RegExp('version\\.v' + version[1].replace(/\./g, '\\.') + '\\.js'));
  assert.match(sw, new RegExp('sisventas-v' + version[1].replace(/\./g, '\\.')));
});
