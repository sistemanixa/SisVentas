const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const css = read('css', 'app.css');
const index = read('index.html');

test('el comparador de proveedores usa una tabla semántica y activa tarjetas móviles', () => {
  assert.match(app, /provBox\.innerHTML = '<table[^']*><thead><tr>/);
  assert.match(app, /<\/thead><tbody>' \+ rows \+ '<\/tbody><\/table>'/);
  assert.match(app, /asegurarDesplazamientoTablas\(provBox\);\s*inicializarGrillasEn\(provBox\);/);
});

test('los movimientos de cuenta corriente conservan cabecera y cuerpo al renderizar', () => {
  assert.match(index, /<table id="cc-movimientos">\s*<thead>/);
  assert.match(app, /tablaMovimientos\.innerHTML =\s*'<thead><tr>/);
  assert.match(app, /asegurarDesplazamientoTablas\(tablaMovimientos\);\s*inicializarGrillasEn\(tablaMovimientos\);/);
});

test('Columnas porcentaje no ocupa espacio en la interfaz móvil', () => {
  assert.match(css, /@media\(max-width:720px\)[\s\S]*?\.sv-column-percent-btn,\s*\[onclick\*="openColumnPercentEditor"\]\{display:none!important\}/);
});
