const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const css = read('css', 'app.css');
const index = read('index.html');
const app236 = read('js', 'app.v2.0.236.js');
const version236 = read('js', 'core', 'version.v2.0.236.js');

test('la auditoria abre el producto en su modulo y conserva el retorno', () => {
  assert.match(app, /function abrirProductoDesdeAuditoriaIntegridadPrecios/);
  assert.match(app, /showPage\('productos'/);
  assert.match(app, /verProducto\(producto\.fbKey, 'auditoria-integral-precios'\)/);
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
  assert.match(app236, /VERSION: 'v2\.0\.236-firebase'/);
  assert.match(version236, /v2\.0\.236/);
});
