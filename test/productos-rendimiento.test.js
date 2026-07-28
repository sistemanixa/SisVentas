const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('Productos usa campos operativos rapidos y no auditorias profundas al renderizar', () => {
  assert.match(app, /var _prodMetricasListaCache = typeof WeakMap/);
  assert.match(app, /function metricasListaProducto\(/);
  const inicio = app.indexOf('function metricasListaProducto(');
  const fin = app.indexOf('function productoSinPrecioCatalogo(', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.doesNotMatch(cuerpo, /precioVentaCanonicoProducto\(/);
  assert.doesNotMatch(cuerpo, /precioGremioARSDesdeProducto\(/);
  assert.doesNotMatch(cuerpo, /detectarProductoArsDuplicadoPorDolar\(/);
  assert.match(app, /return lista\.map\(function\(p\)\{ return \{ producto:p, valor:valor\(p\) \}; \}\)/);
});

test('Productos filtra antes de ordenar y conserva el catalogo completo sin paginacion', () => {
  const filtro = app.indexOf("if (filtro && filtro.trim()) lista = lista.filter");
  const orden = app.indexOf('lista = _ordenarProductosLista(lista);', filtro);
  assert.ok(filtro >= 0 && orden > filtro);
  assert.doesNotMatch(app.slice(orden, orden + 1000), /lista = lista\.slice\(desde, hasta\)/);
  assert.doesNotMatch(app, /renderPaginacionProductos|_prodPorPagina|cambiarPaginaProductos/);
});

test('los textos editables del producto no pueden romper el HTML de la grilla', () => {
  assert.ok(app.includes("escapeHTML(p.nombre||p.descripcion||'')"));
  assert.ok(app.includes("escapeHTML(p.descripcion||'—')"));
  assert.match(app, /data-cat-name="'\+escapeHTML\(cat\)\+'"/);
});

test('guardar un producto no repinta ni audita dos veces el catalogo oculto', () => {
  assert.match(app, /var listaVisible = !!\(listaEl && paginaEl/);
  assert.match(app, /if \(listaVisible && typeof renderTablaProductos === 'function'\)/);
  assert.doesNotMatch(app, /refrescarProductoGuardado\(\)[\s\S]{0,1200}window\.setTimeout\(actualizarStatProductos/);
});
