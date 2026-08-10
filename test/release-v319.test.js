const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.319.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const cotizador = fs.readFileSync('cotizador/index.js', 'utf8');

test('v2.0.319 referencia archivos inmutables y marcadores consistentes', () => {
  assert.match(html, /VERSION:\s*'v2\.0\.319-firebase'/);
  assert.match(html, /js\/app\.v2\.0\.319\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.319\.js/);
  assert.match(html, /id="loading-version"[^>]*>v2\.0\.319</);
  assert.match(html, /css\/app\.css\?v=2\.0\.319/);
  assert.match(app, /VERSION:\s*'v2\.0\.319-firebase'/);
  assert.match(app, /version:\s*'v2\.0\.319'/);
  assert.match(core, /v2\.0\.319/);
  assert.match(sw, /sisventas-v2\.0\.319/);
  assert.match(sw, /app\.v2\.0\.319\.js/);
});

test('v2.0.319 conserva el actualizador activo y amplía el respaldo de Mercado Libre', () => {
  assert.match(app, /async function reintentarFallosActualizador/);
  assert.match(app, /btn-reintentar-fallos-actualizador/);
  assert.match(app, /alternarMaximizarActualizadorMasivoPrecios/);
  assert.match(cotizador, /\/items\?ids=/);
  assert.match(cotizador, /datosEstructuradosMercadoLibreDesdeHtml/);
  assert.match(cotizador, /application\\\/ld\\\+json/);
  assert.match(cotizador, /facebookexternalhit/);
});
