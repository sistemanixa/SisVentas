const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.v2.0.357.js');
const html = read('index.html');

test('v2.0.357 conserva su instantánea publicada', () => {
  assert.match(app, /VERSION: 'v2\.0\.357-firebase'/);
  assert.ok(app.length > 100000);
});

test('configuración separa el logo visual del logo de impresión', () => {
  assert.match(html, /id="cfg-logo-print-same"/);
  assert.match(html, /Usar la misma imagen del logo del sistema/);
  assert.match(html, /id="cfg-logo-print-input"/);
  assert.match(app, /sisventas\/config\/logoImpresionUrl/);
  assert.match(app, /sisventas\/config\/logoImpresionUsarEmpresa/);
  assert.match(app, /function logoImpresionActualUrl/);
});

test('los documentos usan el logo de impresión elegido', () => {
  const usos = app.match(/logoImpresionActualUrl\(\)/g) || [];
  assert.ok(usos.length >= 8);
});

test('el comprobante abre completo y alinea logo y datos de empresa', () => {
  const inicio = app.indexOf('function imprimirVentaActual');
  const bloque = app.slice(inicio, app.indexOf('function abrirModalNuevo', inicio));
  assert.match(bloque, /width=860,height=850/);
  assert.match(bloque, /\.logo-area\{display:flex;align-items:center/);
  assert.match(bloque, /class="empresa-logo"/);
  assert.match(bloque, /class="empresa-text"/);
});
