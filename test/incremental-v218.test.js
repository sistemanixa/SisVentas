const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function functionBody(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `No se encontró ${name}`);
  assert.notEqual(end, -1, `No se encontró el límite ${nextName}`);
  return app.slice(start, end);
}

test('Ventas pagina sin incorporar el ordenamiento universal', () => {
  assert.match(index, /id="ventas-paginacion"/);
  assert.match(app, /window\._ventasPaginacion/);
  assert.match(app, /resultado\.slice\(inicio, fin\)/);
  assert.match(app, /sisventas_ventas_por_pagina/);
  assert.doesNotMatch(app, /sisventas_grid_sort_v1/);
});

test('los filtros reinician la página y el catálogo completo queda disponible', () => {
  const filtros = functionBody('filtrarVentas', '_actualizarBannerFiltroVentas');
  assert.match(filtros, /_ventasIrPrimeraPagina/);
  assert.match(filtros, /var resultado = lista/);
  assert.match(filtros, /if \(f\.tab === 'cobrar'\) resultado = lista\.filter/);
});

test('Productos conserva el texto visible durante refrescos sin argumento', () => {
  const render = functionBody('renderTablaProductos', 'toggleTodasCats');
  assert.match(render, /filtro === undefined \|\| filtro === null/);
  assert.match(render, /document\.getElementById\('prod-search'\)/);
});

test('Presupuestos ofrece vista previa, imágenes y comparación completa', () => {
  assert.match(app, /Vista previa \/ imprimir/);
  assert.match(app, /fotoImpresion/);
  assert.match(app, /Comparar compra \/ venta/);
  assert.match(app, /Compra total/);
  assert.match(app, /Ganancia/);
  assert.match(app, /revision:\s*\['imprimir','aprobar','rechazar'\]/);
});

test('la vista previa no dispara la impresión automáticamente', () => {
  const print = functionBody('imprimirPresupuesto', 'asegurarOTVentaConPago');
  assert.match(print, /opciones\.imprimirAutomaticamente === true/);
  assert.match(print, /El navegador bloqueó la vista previa/);
});
