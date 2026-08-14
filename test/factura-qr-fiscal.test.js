const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('la respuesta de facturación conserva el número fiscal para el QR', () => {
  assert.match(app, /function _normalizarNumeroFiscalFactura/);
  assert.match(app, /function _parcheFacturaDesdeRespuestaApi/);
  assert.match(app, /numero_comprobante: numero/);
  assert.match(app, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB, 'sisventas\/ventas\/\' \+ venta\.fbKey \+ '\/factura'\), parcheFiscal\)/);
});

test('las facturas históricas sin número ofrecen reparación para recuperar el QR', () => {
  assert.match(app, /Completar número para QR/);
  assert.match(app, /function completarNumeroFiscalFactura/);
  assert.match(app, /numeroFiscalCompletadoPor/);
});
