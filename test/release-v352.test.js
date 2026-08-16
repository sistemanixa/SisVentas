const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.352 publica el mismo código activo y versionado', () => {
  const app = read('js/app.js');
  const index = read('index.html');
  assert.equal(read('js/app.v2.0.352.js'), app);
  assert.match(app, /VERSION: 'v2\.0\.352-firebase'/);
  assert.match(index, /app\.v2\.0\.352\.js/);
  assert.match(index, /version\.v2\.0\.352\.js/);
  assert.match(read('js/core/version.v2.0.352.js'), /v2\.0\.352/);
  assert.match(read('sw.js'), /sisventas-v2\.0\.352/);
});

test('la factura fiscal nunca se reconstruye desde la venta', () => {
  const app = read('js/app.js');
  const inicio = app.indexOf('function verComprobanteFacturaVenta');
  const fin = app.indexOf('function abrirModalVincularPdfFiscalOriginal', inicio);
  const funcion = app.slice(inicio, fin);
  assert.doesNotMatch(funcion, /imprimirVentaActual/);
  assert.match(funcion, /abrirModalVincularPdfFiscalOriginal/);
  assert.doesNotMatch(app, /Vista reconstruida con los datos guardados/);
  assert.match(app, /Resumen comercial de la venta\. La factura válida es el PDF fiscal original/);
});

test('la respuesta del facturador conserva la URL del PDF original', () => {
  const app = read('js/app.js');
  assert.match(app, /fuente\.comprobante_pdf_url/);
  assert.match(app, /parche\.pdf_url = pdfFiscal/);
  assert.match(app, /function guardarPdfFiscalOriginal/);
  assert.match(app, /comprobanteOriginal: adjunto/);
});
