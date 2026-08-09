const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.313.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const cotizador = fs.readFileSync('cotizador/index.js', 'utf8');

test('v2.0.313 references the immutable application and version files', () => {
  assert.match(html, /js\/app\.v2\.0\.313\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.313\.js/);
  assert.match(app, /VERSION:\s*'v2\.0\.313-firebase'/);
  assert.match(core, /v2\.0\.313/);
  assert.match(sw, /sisventas-v2\.0\.313/);
  assert.match(sw, /app\.v2\.0\.313\.js/);
});

test('v2.0.313 keeps the actualizador controls and Mercado Libre canonical identity', () => {
  assert.match(cotizador, /candidatasCompatibles\.find/);
  assert.match(cotizador, /catalog_product_id:ids\.productoId/);
  assert.match(cotizador, /validarIdentidadMercadoLibreOficial/);
  assert.match(app, /version:\s*'v2\.0\.313'[\s\S]{0,800}Actualizador: revisión continua y correcciones guiadas/);
  assert.match(app, /btn-detener-actualizador/);
  assert.match(app, /actualizadorHtmlFallos/);
  assert.doesNotMatch(app, /btn-resultados-actualizador/);
});
