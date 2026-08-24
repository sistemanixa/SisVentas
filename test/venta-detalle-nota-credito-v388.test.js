const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('el detalle de venta muestra la nota que anuló la factura', () => {
  const inicio = app.indexOf('function renderDetalleVenta');
  const fin = app.indexOf('function volverListaVentas', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /function _formatearNotaCreditoDetalleVenta/);
  assert.match(cuerpo, /ventaTieneNotaCreditoActiva\(venta\)/);
  assert.match(cuerpo, /nc\.punto_venta/);
  assert.match(cuerpo, /nc\.numero/);
  assert.match(cuerpo, /nc\.fecha/);
  assert.match(cuerpo, /nc\.cae/);
  assert.match(cuerpo, /facturaAnuladaDetalle \? ' · Anulada'/);
  assert.match(cuerpo, /facturaAnuladaDetalle \? escapeHTML\(notaCreditoTxtDetalle\)/);
});
