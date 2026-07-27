const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

function functionBody(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `No se encontró ${name}`);
  assert.notEqual(end, -1, `No se encontró el límite ${nextName}`);
  return app.slice(start, end);
}

test('abrir el detalle de una venta no recalcula ni persiste importes', () => {
  const detail = functionBody('verDetalleVenta', 'ventaDetalleOTFinalizada');
  assert.doesNotMatch(detail, /repararVentaGuardadaEnUsdComoArs/);
  assert.doesNotMatch(detail, /normalizarPrecioItemVentaParaEditor/);
  assert.doesNotMatch(detail, /normalizarVentaLegacyDesdePresupuesto/);
  assert.doesNotMatch(detail, /fbUpdate/);
  assert.match(detail, /operación estrictamente de lectura/);
});

test('el editor usa el precio histórico copiado en la venta', () => {
  const editor = functionBody('abrirEditorVenta', 'fbGuardarVenta');
  assert.match(editor, /precioHistoricoItemVenta\(it\)/);
  assert.doesNotMatch(editor, /precioVentaCanonicoProducto/);
  assert.doesNotMatch(editor, /normalizarPrecioItemVentaParaEditor/);
});

test('la recuperación sólo actúa sobre registros marcados y con respaldo', () => {
  const restore = functionBody('construirRestauracionImportesHistoricosVenta', 'restaurarImportesHistoricosVenta');
  assert.match(restore, /venta\.reparacionMonedaVentaARS/);
  assert.match(restore, /item\.precioUsdOriginal/);
  assert.match(restore, /item\.reparadoDesdeUsdEn/);
  assert.match(restore, /item\.punit = respaldo/);
});

test('restaurar una venta exige confirmación y deja auditoría', () => {
  const restore = functionBody('restaurarImportesHistoricosVenta', 'abrirEditorVenta');
  assert.match(restore, /if \(!confirm\(mensaje\)\) return/);
  assert.match(restore, /Restauración controlada de importes históricos/);
  assert.match(restore, /reparacionMonedaVentaARSRevertida/);
  assert.match(restore, /fbUpdate/);
});
