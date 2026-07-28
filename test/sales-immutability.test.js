const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function body(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `No se encontró ${name}`);
  assert.notEqual(end, -1, `No se encontró el límite ${nextName}`);
  return app.slice(start, end);
}

test('abrir el detalle no recalcula ni persiste importes', () => {
  const detail = body('verDetalleVenta', 'ventaDetalleOTFinalizada');
  assert.doesNotMatch(detail, /normalizarVentaLegacyDesdePresupuesto/);
  assert.doesNotMatch(detail, /repararVentaGuardadaEnUsdComoArs/);
  assert.doesNotMatch(detail, /precioVentaCanonicoProducto/);
  assert.doesNotMatch(detail, /fbUpdate/);
});

test('el editor usa exclusivamente el precio guardado en la venta', () => {
  const editor = body('abrirEditorVenta', 'fbGuardarVenta');
  assert.match(editor, /precioHistoricoItemVenta\(it\)/);
  assert.doesNotMatch(editor, /precioVentaCanonicoProducto/);
  assert.doesNotMatch(editor, /normalizarPrecioItemVentaParaEditor/);
});

test('no queda activa la reparación automática de moneda', () => {
  assert.doesNotMatch(app, /function repararVentaGuardadaEnUsdComoArs/);
});
