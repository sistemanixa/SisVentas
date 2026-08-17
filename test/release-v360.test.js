const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.360 conserva el contrato comercial y calcula el fiscal por separado', () => {
  const historico = read('js/app.v2.0.360.js');
  assert.match(historico, /VERSION: 'v2\.0\.360-firebase'/);
  assert.match(historico, /function resumenFiscalParaComprobanteVenta/);
  assert.match(historico, /venta\.conIva === false/);
  assert.match(historico, /neto \* 0\.21/);
  assert.match(historico, /prepararVentaParaFacturacion\(venta, tipoComprobante\)/);
});

test('una nota de crédito toma el comprobante fiscal original y no el total comercial', () => {
  const app = read('js/app.js');
  const server = read('cloud-functions/emitir-factura/index.js');
  assert.match(app, /async function obtenerSnapshotFiscalParaNotaCredito/);
  assert.match(app, /function prepararVentaParaNotaCredito/);
  assert.match(app, /La nota de crédito se emitirá exactamente por este importe fiscal/);
  assert.match(app, /venta: ventaFiscalNC/);
  assert.match(app, /puntoVenta: snapshot\.punto_venta \|\| v\.factura\.punto_venta/);
  assert.match(server, /if \(!data\.esNotaCredito\) await db\.ref/);
  assert.match(server, /data\.comprobante_asociado\.punto_venta \|\| puntoVenta/);
});

test('detalle de venta usa importes con centavos para sus totales', () => {
  const app = read('js/app.js');
  const inicio = app.indexOf('function renderDetalleVenta');
  const fin = app.indexOf('function volverListaVentas', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /importeComprobanteVenta\(total\)/);
  assert.match(bloque, /importeComprobanteVenta\(netoDetalle\)/);
  assert.match(bloque, /importeComprobanteVenta\(descuento\)/);
});
