const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('las grillas no instalan ordenamiento universal ni observadores de orden', () => {
  assert.doesNotMatch(app, /function instalarOrdenamientoGrillas\(/);
  assert.doesNotMatch(app, /function ordenarGrillaPorColumna\(/);
  assert.doesNotMatch(app, /instalarOrdenamientoGrillas\(document\)/);
  assert.doesNotMatch(app, /instalarOrdenamientoGrillas\(nodo\)/);
  assert.doesNotMatch(css, /\.sv-sortable-th/);
});

test('clientes y productos conservan un orden fijo alfabético', () => {
  assert.match(app, /String\(a\.nombre \|\| ''\)\.localeCompare/);
  assert.match(app, /String\(a\.nombre \|\| a\.descripcion \|\| ''\)\.localeCompare/);
});

test('ventas conservan orden cronológico fijo antes de paginar', () => {
  assert.match(app, /function _ordenarVentasLista\(/);
  assert.match(app, /return \(vb - va\) \|\| \(a\.indice - b\.indice\)/);
});

test('Productos mantiene visible el encabezado sin hacerlo interactivo', () => {
  assert.doesNotMatch(app, /function _ordenarProductosLista\(/);
  assert.match(app, /thead\.style\.visibility = 'visible'/);
});
