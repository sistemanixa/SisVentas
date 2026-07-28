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
  assert.match(app, /var _prodCatsAbiertas = \{\};/);
  assert.match(app, /var abierta = _prodCatsAbiertas\[cat\] === true;/);
  assert.match(app, /var _todasColapsadas = true;/);
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

test('abrir categorías no reconstruye todo el catálogo y expandir cede el control', () => {
  const inicio = app.indexOf('function toggleProdCat(cat)');
  const fin = app.indexOf('function buscarProducto', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /_insertarFilasCategoriaProducto\(cat\)/);
  assert.doesNotMatch(cuerpo, /renderTablaProductos\(/);
  assert.match(app, /performance\.now\(\) - inicio < 10/);
  assert.match(app, /requestAnimationFrame\(avanzar\)/);
  assert.match(app, /loading="lazy" decoding="async"/);
});

test('el observador de grillas procesa cada tabla una sola vez por cuadro', () => {
  assert.match(app, /var pendientes = new Set\(\)/);
  assert.match(app, /pendientes\.add\(tabla \|\| nodo\)/);
  assert.match(app, /var lote = Array\.from\(pendientes\)/);
  assert.match(app, /cuadroPendiente = requestAnimationFrame/);
});

test('un refresco en tiempo real no reconstruye todo el catalogo expandido', () => {
  const inicio = app.indexOf('function renderTablaProductos(filtro)');
  const fin = app.indexOf('var _todasColapsadas = true;', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /if \(!_todasColapsadas\)/);
  assert.match(cuerpo, /_prodCatsAbiertas\[cat\] = false/);
  assert.match(cuerpo, /_todasColapsadas = true/);
});
