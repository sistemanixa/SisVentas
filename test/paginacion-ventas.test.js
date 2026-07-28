const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Ventas pagina el resultado completo antes de renderizar', () => {
  assert.match(index, /id="ventas-paginacion"/);
  assert.match(app, /window\._ventasPaginacion/);
  assert.match(app, /porPagina:_ventasPorPaginaGuardado\(\)/);
  assert.match(app, /resultado\.slice\(inicio, fin\)/);
  assert.match(app, /Filas por página/);
});

test('Ventas ordena todo el resultado antes de cortar la página', () => {
  const orden = app.indexOf('var resultado = _ordenarVentasLista');
  const corte = app.indexOf('resultado.slice(inicio, fin)', orden);
  assert.ok(orden >= 0 && corte > orden);
  assert.match(app, /fechaVentaTimestamp\(v\.fecha, v\.ts\)/);
});

test('Orden y tamaño de página persisten en el navegador', () => {
  assert.match(app, /sisventas_grid_sort_v1/);
  assert.match(app, /sisventas_ventas_por_pagina/);
  assert.match(app, /_svGuardarOrdenGrilla\(tablaId, estado\)/);
  assert.match(app, /localStorage\.setItem\('sisventas_ventas_por_pagina'/);
});
