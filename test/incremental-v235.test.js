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

test('el menu lateral de escritorio se oculta y expande sin desplazar el contenido', () => {
  assert.match(css, /\.sidebar\.desktop-autohide\{width:60px/);
  assert.match(css, /margin-right:-144px/);
  assert.match(css, /\.sidebar\.desktop-autohide:hover/);
});

test('el usuario puede anclar el menu y la preferencia queda guardada', () => {
  assert.match(index, /id="sidebar-pin-btn"/);
  assert.match(app, /sisventas_sidebar_pinned/);
  assert.match(app, /localStorage\.setItem\(SIDEBAR_PIN_KEY/);
  assert.match(app, /sidebar-pinned/);
});

test('la publicacion corresponde a v2.0.235', () => {
  assert.match(app, /VERSION: 'v2\.0\.235-firebase'/);
  assert.match(index, /app\.v2\.0\.235\.js/);
  assert.match(index, /version\.v2\.0\.235\.js/);
  assert.match(sw, /sisventas-v2\.0\.235/);
});
