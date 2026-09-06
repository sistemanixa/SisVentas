const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.3.4.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Productos muestra todas las categorías y sus artículos al ingresar', () => {
  assert.match(app, /var abierta = _prodCatsAbiertas\[cat\] !== false/);
  assert.match(app, /var _todasColapsadas = false/);
  assert.match(index, /id="label-colapsar-cats">Colapsar todo</);
});
