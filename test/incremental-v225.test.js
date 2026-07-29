const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const css = read('css', 'app.css');

test('todas las grillas con cabecera reciben tarjetas móviles', () => {
  assert.match(app, /function prepararTarjetasMovilesGrilla\(tabla\)/);
  assert.match(app, /tabla\.classList\.add\('sv-mobile-card-grid'\)/);
  assert.match(app, /function inicializarGrillasEn\(contenedor\)/);
  assert.match(app, /inicializarGrillasEn\(document\)/);
  assert.match(app, /tablasPendientes\.add\(tablaContenedora\)/);
  assert.match(app, /prepararTarjetasMovilesGrilla\(tabla\)/);
});

test('la tarjeta móvil muestra etiquetas y conserva las acciones', () => {
  assert.match(css, /table\.sv-mobile-card-grid tbody > tr\{/);
  assert.match(css, /content:attr\(data-label\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /table\.sv-mobile-card-grid \.sv-grid-actions-trigger/);
  assert.match(app, /prepararAccionesGrilla\(tabla\)/);
});

test('el encabezado móvil prioriza dólar y oculta rol', () => {
  assert.match(css, /#role-badge-el\{display:none!important\}/);
  assert.match(css, /\.topbar-dolar\{display:inline-flex!important;flex-shrink:0\}/);
});

test('la publicación corresponde a v2.0.225', () => {
  const publishedApp = read('js', 'app.v2.0.225.js');
  const publishedVersion = read('js', 'core', 'version.v2.0.225.js');
  assert.match(publishedApp, /VERSION: 'v2\.0\.225-firebase'/);
  assert.match(publishedVersion, /SISVENTAS_PWA_VERSION = 'v2\.0\.225'/);
});
