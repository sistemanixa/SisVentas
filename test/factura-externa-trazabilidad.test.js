const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.2.6.js'), 'utf8');

test('la factura externa exige conservar el archivo original', () => {
  assert.match(app, /if \(!archivo\) \{ notify\('Adjuntá el PDF original de la factura externa'\)/);
  assert.match(app, /archivo\.type === 'application\/pdf'/);
});

test('la factura externa valida sus datos contra el PDF y ARCA', () => {
  assert.match(app, /function _datosFiscalesDesdeNombrePdf/);
  assert.match(app, /_consultarFacturaExternaOficial\(tipoCodigo, puntoVenta, numero\)/);
  assert.match(app, /no coincide con el PDF\/ARCA/);
  assert.match(app, /datos_fiscales: datosOficiales/);
});

test('la conciliación de una nota de crédito externa también exige PDF', () => {
  assert.match(app, /Adjuntá el PDF original de la nota de crédito antes de vincularla/);
  assert.match(app, /cambios\[baseNc \+ 'comprobante'\] = respaldoPdf/);
  assert.match(app, /id="fv-nc-pdf" type="file" accept="application\/pdf,\.pdf" required/);
  assert.match(app, /El PDF pertenece a otro tipo, punto de venta o número de nota de crédito/);
  assert.match(app, /El importe del PDF\/ARCA no coincide con la nota importada/);
});

test('el visor abre primero el adjunto original de una factura externa', () => {
  const inicio = app.indexOf('async function verComprobanteFacturaVenta');
  const fin = app.indexOf('function _fechaLocalISOFacturaExterna', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /_abrirAdjuntoFacturaExterna\(venta\.factura\.comprobante\)/);
  assert.ok(bloque.indexOf('_abrirAdjuntoFacturaExterna') < bloque.indexOf('window.open'), 'el adjunto debe resolverse antes de abrir o consultar ARCA');
  assert.match(app, /window\.open\(url, '_blank'\)/);
});

test('el resumen informa usuario, fecha de carga y archivo original', () => {
  assert.match(app, /Carga externa registrada/);
  assert.match(app, /<strong>Usuario:<\/strong>/);
  assert.match(app, /<strong>Fecha y hora de carga:<\/strong>/);
  assert.match(app, /Ver PDF original/);
});

test('una refacturación externa conserva factura y nota de crédito previas', () => {
  assert.match(app, /historialFiscal\.push\(\{/);
  assert.match(app, /factura: Object\.assign\(\{\}, venta\.factura\)/);
  assert.match(app, /notaCredito: Object\.assign\(\{\}, venta\.notaCredito\)/);
});
