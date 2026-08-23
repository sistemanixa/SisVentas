const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('la ficha y cada fila permiten activar o desactivar sin borrar el producto', () => {
  assert.match(html, /id="pd-activo-toggle"/);
  assert.match(app, /function toggleActivoProducto\(id, activo\)/);
  assert.match(app, /\{ activo:!!activo, estado:activo \? 'activo' : 'inactivo'/);
  assert.match(app, /title="'\+\(activo\?'Desactivar':'Activar'\)\+' producto"/);
});

test('productos ofrece filtro sin ventas e inactivos usando el historial real', () => {
  assert.match(html, /id="prod-uso-filter"/);
  assert.match(html, /value="sinventas">Sin ventas registradas/);
  assert.match(app, /_filtroUsoProductos === 'sinventas'.*!productoTieneVentasHistoricas\(p\)/);
  assert.match(app, /_filtroUsoProductos === 'inactivos'/);
});

test('el listado permite ordenar precios de venta o costo en ambos sentidos', () => {
  assert.match(html, /id="prod-orden-precio"/);
  assert.match(html, /value="venta-desc">Venta: más caro primero/);
  assert.match(html, /value="compra-asc">Costo: más barato primero/);
  assert.match(app, /metricasListaProducto\(a\)\[campoPrecio\]/);
});

test('el modo claro usa texto secundario legible y una ficha sin fondo oscuro', () => {
  assert.match(css, /--text2:#4f4f4b;--text3:#686863/);
  assert.match(css, /body:not\(\.dark-mode\) \.product-hero\{background:linear-gradient\(135deg,#fff,#eef2f7\)/);
  assert.match(css, /body:not\(\.dark-mode\) \.product-hero-meta>span/);
});
