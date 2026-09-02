const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const appPath = html.match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/)[1];
const app = fs.readFileSync(appPath, 'utf8');
const grids = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

test('Gastos difiere tareas ajenas y cachea pagos y fechas', () => {
  assert.match(app, /function _programarTareasSecundariasGastos/);
  assert.match(app, /_gastosPagosCache\.has\(g\)/);
  assert.match(app, /_gastosFechaImputacionCache\.has\(g\)/);
  assert.match(html, /oninput="buscarGastos\(this\.value\)"/);
});

test('los comprobantes nuevos quedan fuera del listado principal', () => {
  assert.match(app, /sisventas\/gastos_adjuntos\/.*\/fotoBase64/);
  assert.match(app, /fotoAdjunta:/);
  assert.doesNotMatch(app, /fotoBase64:\s+gastoFotoBase64\s*\|\|\s*null/);
});

test('la regla general no realimenta su MutationObserver', () => {
  assert.match(grids, /btn\.parentElement !== toolbar \|\| btn !== toolbar\.lastElementChild/);
  assert.match(grids, /btn\.parentElement !== actions \|\| btn !== actions\.lastElementChild/);
});
