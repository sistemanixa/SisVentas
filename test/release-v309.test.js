const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.309.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const cotizador = fs.readFileSync('cotizador/index.js', 'utf8');

test('v2.0.309 references the immutable application and version files', () => {
  assert.match(html, /js\/app\.v2\.0\.309\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.309\.js/);
  assert.match(app, /VERSION:\s*'v2\.0\.309-firebase'/);
  assert.match(core, /v2\.0\.309/);
  assert.match(sw, /sisventas-v2\.0\.309/);
  assert.match(sw, /app\.v2\.0\.309\.js/);
});

test('v2.0.309 keeps Mercado Libre fragment wid support and its release history', () => {
  assert.match(cotizador, /parametrosFragmento\.get\('wid'\)/);
  assert.match(app, /version:\s*'v2\.0\.309'[\s\S]{0,600}Mercado Libre: actualización de precios de catálogo/);
});
