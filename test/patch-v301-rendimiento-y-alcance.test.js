const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.0.1.js', 'utf8');
const resize = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const permisos = fs.readFileSync('js/modules/action-permissions.js', 'utf8');
const dashboard = fs.readFileSync('js/modules/sales-dashboard.js', 'utf8');

test('clientes procesa snapshots por lotes y pinta progreso', () => {
  assert.match(app, /var lote = 90/);
  assert.match(app, /Preparando clientes… ' \+ pct \+ '%/);
  assert.match(app, /await new Promise\(function\(resolve\)\{ setTimeout\(resolve, 0\); \}\)/);
});

test('productos usa URL visual y no vuelve a archivar Base64', () => {
  assert.match(app, /function urlImagenProductoVisual/);
  assert.match(app, /function programarArchivoImagenProducto[\s\S]{0,300}return;/);
  assert.match(app, /loading="lazy" decoding="async"/);
});

test('grillas esperan visibilidad antes de calcular el recomendado', () => {
  assert.match(resize, /if \(!isTableVisible\(table\)\)[\s\S]{0,160}svPendingVisibleInit/);
});

test('inicio permite recorrer todas las OT pendientes', () => {
  assert.match(html, /id="dash-ot-list-wrap"[^>]*overflow-y:auto/);
  assert.doesNotMatch(app, /otsPend\.slice\(0,6\)/);
  assert.doesNotMatch(dashboard, /dash-ot-pendientes tr:nth-child/);
});

test('ventas muestra creador y respeta el permiso de ver todas', () => {
  assert.match(html, />Creado por /);
  assert.match(permisos, /'ventas\.verTodas':[\s\S]{0,100}admin','administrativo/);
  assert.match(app, /function ventasVisiblesParaUsuario/);
  assert.match(app, /ventasVisiblesParaUsuario\(ventasList \|\| \[\]\)/);
  assert.match(app, /Esta venta pertenece a otro usuario/);
});
