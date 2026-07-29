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

test('los sublistados dinámicos activan la presentación móvil compartida', () => {
  assert.match(app, /provBox\.innerHTML = '<table[^']*><thead><tr>/);
  assert.match(app, /inicializarGrillasEn\(provBox\)/);
  assert.match(app, /tablaMovimientos\.innerHTML =\s*'<thead><tr>/);
  assert.match(app, /inicializarGrillasEn\(tablaMovimientos\)/);
});

test('Columnas porcentaje desaparece sólo bajo el ancho móvil', () => {
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\[onclick\*="openColumnPercentEditor"\]\{display:none!important\}/);
});

test('la publicación corresponde a v2.0.226', () => {
  assert.match(app, /VERSION: 'v2\.0\.226-firebase'/);
  assert.match(index, /app\.v2\.0\.226\.js/);
  assert.match(index, /version\.v2\.0\.226\.js/);
  assert.match(sw, /sisventas-v2\.0\.226/);
});
