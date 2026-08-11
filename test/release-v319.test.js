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

test('Mercado Libre exige confirmación humana cuando no puede probar la identidad', () => {
  assert.match(cotizador, /PRODUCT_IDENTITY_REQUIRES_CONFIRMATION/);
  assert.match(cotizador, /requiereConfirmacionIdentidad:true/);
  assert.match(cotizador, /confirmarIdentidadManual:reqBody\.confirmarIdentidadManual === true/);
  assert.match(cotizador, /metodo:'confirmacion_manual_usuario'/);
  assert.match(app, /confirmarIdentidadProveedorCotizacion/);
  assert.match(app, /confirmarIdentidadMercadoLibreActualizador/);
  assert.match(app, /Sí, es el mismo producto/);
  assert.match(app, /identidadConfirmadaPor/);
});

test('el detalle del reclamo comparte la estética de los campos del sistema', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(html, /id="sp-nuevo-desc"[^>]+min-height:154px/);
  assert.match(css, /\.fg input,\.fg select,\.fg textarea\{/);
  assert.match(css, /\.fg input:focus,\.fg select:focus,\.fg textarea:focus\{/);
  assert.match(css, /\.fg input::placeholder,\.fg textarea::placeholder\{/);
});
