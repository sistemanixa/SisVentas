const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('el actualizador reúne acciones y muestra cambios bloqueados para aprobar', () => {
  assert.match(index, /Centro de actualización/);
  assert.match(index, /id="mod-ap-aprobaciones"/);
  assert.match(index, /Cómo funciona/);
  assert.match(app, /Cambios bloqueados por aprobar/);
  assert.match(app, /revisarYAprobarVariacionPrecio/);
  assert.match(app, /origen === 'revision'/);
});

test('la publicación corresponde a v2.0.242', () => {
  assert.match(app, /VERSION: 'v2\.0\.242-firebase'/);
  assert.match(index, /app\.v2\.0\.242\.js/);
  assert.match(index, /version\.v2\.0\.242\.js/);
  assert.match(sw, /sisventas-v2\.0\.242/);
});
