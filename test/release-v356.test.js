const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.v2.0.356.js');

test('v2.0.356 publica el mismo código activo y versionado', () => {
  assert.match(app, /VERSION: 'v2\.0\.356-firebase'/);
  assert.ok(app.length > 100000);
});

test('la consulta fiscal informa el progreso en el botón', () => {
  const inicio = app.indexOf('async function verComprobanteFacturaVenta');
  const fin = app.indexOf('function _fechaLocalISOFacturaExterna', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /boton\.disabled = true/);
  assert.match(bloque, /Consultando datos de ARCA/);
  assert.match(bloque, /boton\.innerHTML = htmlBotonAnterior/);
  assert.match(app, /verComprobanteFacturaVenta\(v\.id \|\| v\.fbKey \|\| ventaId, boton\)/);
});

test('la factura reemplaza la página temporal y conserva el formato tradicional', () => {
  const inicio = app.indexOf('function imprimirVentaActual');
  const bloque = app.slice(inicio, app.indexOf('function cerrarModalVenta', inicio));
  assert.match(bloque, /w\.document\.open\(\)/);
  assert.ok(bloque.indexOf('w.document.open()') < bloque.indexOf('w.document.write('));
  assert.match(bloque, /max-width:860px/);
  assert.match(bloque, /width=860,height=750/);
});

test('el resumen fiscal abre compacto y participa de la regla de ventanas gestionables', () => {
  const inicio = app.indexOf('function abrirResumenFactura');
  const fin = app.indexOf('function _normalizarNumeroFiscalFactura', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /id="resumen-factura-panel"/);
  assert.match(bloque, /data-modal-header/);
  assert.match(bloque, /width:min\(500px,calc\(100vw - 32px\)\)/);
  assert.match(bloque, /overflow:auto/);
});
