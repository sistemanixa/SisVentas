const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

test('Productos calcula importes una sola vez por registro y no dentro de cada comparación', () => {
  assert.match(app, /var _prodMetricasListaCache = typeof WeakMap/);
  assert.match(app, /function metricasListaProducto\(/);
  assert.match(app, /return lista\.map\(function\(p\)\{ return \{ producto:p, valor:valor\(p\) \}; \}\)/);
  assert.doesNotMatch(app, /case 'venta': return precioVentaCanonicoProducto\(p\)/);
  assert.doesNotMatch(app, /case 'compra': return precioGremioARSDesdeProducto\(p\)/);
});

test('Productos filtra antes de ordenar y limita el DOM a una página', () => {
  const filtro = app.indexOf("if (filtro && filtro.trim()) lista = lista.filter");
  const orden = app.indexOf('lista = _ordenarProductosLista(lista);', filtro);
  const pagina = app.indexOf('lista = lista.slice(desde, hasta);', orden);
  assert.ok(filtro >= 0 && orden > filtro && pagina > orden);
  assert.match(app, /var _prodPorPagina = 80/);
});

test('los textos editables del producto no pueden romper el HTML de la grilla', () => {
  assert.ok(app.includes("escapeHTML(p.nombre||p.descripcion||'')"));
  assert.ok(app.includes("escapeHTML(p.descripcion||'—')"));
  assert.match(app, /data-cat-name="'\+escapeHTML\(cat\)\+'"/);
});

test('guardar un producto no repinta ni audita dos veces el catálogo oculto', () => {
  assert.match(app, /var listaVisible = !!\(listaEl && paginaEl/);
  assert.match(app, /if \(listaVisible && typeof renderTablaProductos === 'function'\)/);
  assert.doesNotMatch(app, /refrescarProductoGuardado\(\)[\s\S]{0,1200}window\.setTimeout\(actualizarStatProductos/);
});
