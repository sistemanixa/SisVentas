const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('las grillas de consulta reciben ordenamiento universal', () => {
  assert.match(app, /function instalarOrdenamientoGrillas\(/);
  assert.match(app, /function ordenarGrillaPorColumna\(/);
  assert.match(app, /instalarOrdenamientoGrillas\(document\)/);
  assert.match(app, /instalarOrdenamientoGrillas\(nodo\)/);
  assert.match(css, /\.sv-sortable-th/);
});

test('el comparador reconoce fechas, importes argentinos y vacíos', () => {
  assert.match(app, /function _svFechaOrden\(/);
  assert.match(app, /function _svNumeroOrden\(/);
  assert.match(app, /Los valores vacíos quedan siempre al final/);
  assert.match(app, /localeCompare\(String\(vb\.valor\), 'es', \{ numeric:true/);
});

test('no se reordenan editores ni grillas con ordenamiento especializado', () => {
  assert.match(app, /tabla\.classList\.contains\('tbl-sheet'\)/);
  assert.match(app, /tabla\.querySelector\('thead th\[data-sort\]'\)/);
  assert.match(app, /dataset\.svNoSort/);
});

test('Productos mantiene visible la herramienta y respeta el orden en vista agrupada', () => {
  assert.match(app, /function _ordenarProductosLista\(/);
  assert.match(app, /lista = _ordenarProductosLista\(lista\)/);
  assert.match(app, /thead\.style\.visibility = 'visible'/);
});
