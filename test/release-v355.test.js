const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.v2.0.355.js');

test('v2.0.355 publica el mismo código activo y versionado', () => {
  assert.match(app, /VERSION: 'v2\.0\.355-firebase'/);
  assert.ok(app.length > 100000);
});

test('ninguna factura emitida abre el PDF visual de FacturasApp', () => {
  const inicio = app.indexOf('function verFacturaEmitida');
  const fin = app.indexOf('function _datosPdfFiscalFactura', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /verComprobanteFacturaVenta\(ventaId\)/);
  assert.doesNotMatch(bloque, /_abrirFuentePdfFactura/);
  assert.doesNotMatch(bloque, /pdfUrl\) \{/);
});
