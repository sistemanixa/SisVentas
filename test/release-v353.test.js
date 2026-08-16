const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const historicalApp = read('js/app.v2.0.353.js');

test('v2.0.353 publica el mismo código activo y versionado', () => {
  assert.match(historicalApp, /VERSION: 'v2\.0\.353-firebase'/);
});

test('el comprobante se solicita automáticamente a FacturasApp', () => {
  const app = historicalApp;
  const inicio = app.indexOf('async function verComprobanteFacturaVenta');
  const fin = app.indexOf('function _fechaLocalISOFacturaExterna', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /accion:'regenerar_pdf'/);
  assert.match(bloque, /tipoComprobante:datos\.tipo/);
  assert.match(bloque, /puntoVenta:datos\.puntoVenta/);
  assert.match(bloque, /numero:datos\.numero/);
  assert.doesNotMatch(bloque, /imprimirVentaActual/);
  assert.doesNotMatch(app, /Vista reconstruida con los datos guardados/);
  assert.doesNotMatch(app, /Vincular PDF fiscal/);
});

test('la emisión reconoce el campo oficial comprobante_pdf_url', () => {
  const app = historicalApp;
  assert.match(app, /fuente\.comprobante_pdf_url/);
  assert.match(app, /parche\.comprobante_pdf_url = pdfFiscal/);
});
