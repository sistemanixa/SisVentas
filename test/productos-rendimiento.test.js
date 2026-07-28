const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
  assert.match(app, /var abierta = _prodCatsAbiertas\[cat\] !== false;/);
  assert.match(app, /var _todasColapsadas = false;/);
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

test('abrir una categoria no reconstruye todo el catalogo', () => {
  const inicio = app.indexOf('function toggleProdCat(cat)');
  const fin = app.indexOf('function buscarProducto', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /_insertarFilasCategoriaProducto\(cat\)/);
  assert.doesNotMatch(cuerpo, /renderTablaProductos\(/);
  assert.match(app, /loading="lazy" decoding="async"/);
});

test('colapsar todo conserva la busqueda visible y no usa una variable inexistente', () => {
  const inicio = app.indexOf('function toggleTodasCats()');
  const fin = app.indexOf('function toggleProdCat', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /renderTablaProductos\(\)/);
  assert.doesNotMatch(cuerpo, /currentSearch/);
  assert.match(indexHtml, /id="btn-colapsar-cats"[^>]*onclick="toggleTodasCats\(\)"/);
  assert.match(indexHtml, /id="label-colapsar-cats">Colapsar todo</);
});

test('una categoria se colapsa con un solo clic usando sus filas visibles', () => {
  const inicio = app.indexOf('function toggleProdCat(cat)');
  const fin = app.indexOf('function buscarProducto', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(app, /function _filasCategoriaProducto\(cabecera\)/);
  assert.match(cuerpo, /var filasVisibles = _filasCategoriaProducto\(cabecera\)/);
  assert.match(cuerpo, /filasVisibles\.forEach\(function\(r\)\{ r\.remove\(\); \}\)/);
  assert.doesNotMatch(cuerpo, /CSS\.escape/);
});

test('el observador de grillas procesa cada tabla una sola vez por cuadro', () => {
  assert.match(app, /var pendientes = new Set\(\)/);
  assert.match(app, /pendientes\.add\(tabla \|\| nodo\)/);
  assert.match(app, /var lote = Array\.from\(pendientes\)/);
  assert.match(app, /cuadroPendiente = requestAnimationFrame/);
});

test('Productos abre completo y no usa la expansion progresiva paliativa', () => {
  assert.match(app, /var abierta = _prodCatsAbiertas\[cat\] !== false;/);
  assert.match(app, /var _todasColapsadas = false;/);
  assert.doesNotMatch(app, /_prodExpandToken|Expandiendo \d|requestAnimationFrame\(avanzar\)/);
});

test('Productos queda fuera del generador universal de menus de acciones', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="prod-tbl"[^>]*data-sv-no-actions="1"/);
  assert.match(app, /if \(tabla\.dataset\.svNoActions === '1'\) return;/);
});
