const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.js');

test('v2.0.354 publica el mismo código activo y versionado', () => {
  assert.match(read('index.html'), /app\.v2\.0\.354\.js/);
  assert.match(read('js/core/version.js'), /v2\.0\.354/);
  assert.equal(read('js/app.v2.0.354.js'), app);
});

test('la factura conserva el diseño SisVentas y consulta datos estructurados', () => {
  const inicio = app.indexOf('async function verComprobanteFacturaVenta');
  const fin = app.indexOf('function _fechaLocalISOFacturaExterna', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /accion:'consultar_comprobante'/);
  assert.match(bloque, /imprimirVentaActual\(true, ventana\)/);
  assert.doesNotMatch(bloque, /regenerar_pdf/);
  assert.doesNotMatch(bloque, /_abrirFuentePdfFactura/);
});

test('el comprobante utiliza detalle, importes y QR fiscales exactos', () => {
  assert.match(app, /datos_fiscales/);
  assert.match(app, /datosFiscal\.detalle/);
  assert.match(app, /datosFiscal\.afip_qr/);
  assert.match(app, /Neto gravado/);
  assert.match(app, /Comprobante válido ante ARCA/);
  assert.doesNotMatch(app, /Vista reconstruida con los datos guardados/);
});
