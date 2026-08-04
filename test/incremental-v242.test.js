const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.v2.0.242.js');

test('el actualizador reúne acciones y muestra cambios bloqueados para aprobar', () => {
  assert.match(app, /Cambios bloqueados por aprobar/);
  assert.match(app, /revisarYAprobarVariacionPrecio/);
  assert.match(app, /origen === 'revision'/);
});

test('la publicación histórica v2.0.242 permanece disponible', () => {
  assert.match(app, /VERSION: 'v2\.0\.242-firebase'/);
});
