const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const css = read('css', 'app.css');
const index = read('index.html');
const sw = read('sw.js');

test('la auditoria abre el producto en su modulo y conserva el retorno', () => {
  assert.match(app, /function abrirProductoDesdeAuditoriaIntegridadPrecios/);
  assert.match(app, /showPage\('productos'/);
  assert.match(app, /verProducto\(clave, 'auditoria-integral-precios'\)/);
  assert.match(app, /capturarEstadoAuditoriaIntegridadPrecios/);
  assert.match(app, /restaurarEstadoAuditoriaIntegridadPrecios/);
  assert.match(app, /abrirAuditoriaIntegridadPrecios\(\);\s*return;/);
});

test('el anclaje de escritorio queda como control compacto solo con icono', () => {
  const button = index.match(/<button class="sidebar-pin"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(button, /ti ti-pin/);
  assert.doesNotMatch(button, /<span>/);
  assert.match(css, /\.sidebar-pin\{[^}]*width:32px/);
});

test('la publicacion corresponde a v2.0.236', () => {
  assert.match(app, /VERSION: 'v2\.0\.236-firebase'/);
  assert.match(index, /app\.v2\.0\.236\.js/);
  assert.match(index, /version\.v2\.0\.236\.js/);
  assert.match(sw, /sisventas-v2\.0\.236/);
});
