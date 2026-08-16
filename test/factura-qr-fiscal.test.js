const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('la respuesta de facturación conserva el número fiscal para el QR', () => {
  assert.match(app, /function _normalizarNumeroFiscalFactura/);
  assert.match(app, /function _extraerNumeroFiscalDesdeTexto/);
  assert.match(app, /\['rta', 'mensaje', 'message', 'detalle', 'descripcion'\]/);
  assert.match(app, /FACTURA\|NOTA\\s\+DE/);
  assert.match(app, /function _parcheFacturaDesdeRespuestaApi/);
  assert.match(app, /numero_comprobante: numero/);
  assert.match(app, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB, 'sisventas\/ventas\/\' \+ venta\.fbKey \+ '\/factura'\), parcheFiscal\)/);
});

test('la emisión persiste en conjunto los metadatos fiscales devueltos', () => {
  assert.match(app, /function _datosFiscalesDesdeQrAfip/);
  assert.match(app, /var datosQr = _datosFiscalesDesdeQrAfip\(qrFiscal\)/);
  assert.match(app, /fuente\.invoice_date \|\| fuente\.fecha_emision/);
  assert.match(app, /fuente\.vencimiento_cae \|\| fuente\.vencimientoCae/);
  assert.match(app, /fuente\.afip_qr \|\| fuente\.qr_afip/);
  assert.match(app, /datosFiscalesCapturadosDe = 'respuesta-emision'/);
});

test('las facturas históricas recuperan sus datos desde comprobantes emitidos', () => {
  assert.match(app, /data-factura-action="completar-numero"/);
  assert.match(app, /function recuperarDatosFiscalesFactura/);
  assert.match(app, /datosFiscalesRecuperadosDe: 'comprobantes-emitidos'/);
  assert.match(app, /_normalizarCaeFactura\(comprobante\.cae/);
  assert.match(app, /Recuperar datos fiscales/);
});

test('el QR prioriza la fecha y el importe fiscal guardados', () => {
  assert.match(app, /var fechaFiscal = String\(facturaVenta\.fecha \|\| facturaVenta\.fecha_emision \|\| v\.fecha \|\| ''\)/);
  assert.match(app, /var importeQr = _leerImporteFiscalFactura\(facturaVenta\)/);
  assert.match(app, /importe: importeQr/);
  assert.match(app, /importe_total: importeFiscal/);
  assert.match(app, /importeTotal: importeFiscal/);
  assert.match(app, /totalFiscal: importeFiscal/);
});

test('el importador de emitidos conserva el CAE y actualiza registros previamente importados', () => {
  assert.match(app, /cae:\s+obj\['Cód\. Autorización'\]/);
  assert.match(app, /comprobantesVenta\/' \+ existente\.fbKey/);
  assert.match(app, /actualizadoTs: Date\.now\(\)/);
});
