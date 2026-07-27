const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('duplicar presupuesto crea un alta nueva y exige volver a seleccionar cliente', () => {
  const bloque = app.slice(app.indexOf('function duplicarPresupuesto'), app.indexOf('function editarPptoParaMigrar'));
  assert.match(bloque, /_pptoEditandoFbKey = null/);
  assert.match(bloque, /_pptoEditandoId = null/);
  assert.match(bloque, /pp-cli[^\n]+value = ''/);
  assert.match(bloque, /pptoCargarItemsEnEditor\(original\)/);
});

test('duplicar venta conserva renglones históricos pero no identidad ni cliente', () => {
  const bloque = app.slice(app.indexOf('function duplicarVenta'), app.indexOf('function fbGuardarVenta'));
  assert.match(bloque, /_ventaEditandoFbKey = null/);
  assert.match(bloque, /cliInp[^\n]+value = ''/);
  assert.match(bloque, /precioHistoricoItemVenta\(item\)/);
  assert.doesNotMatch(bloque, /pagos\s*=/);
  assert.doesNotMatch(bloque, /factura\s*=/);
});

test('productos por metro requieren contenido de presentación y calculan costo unitario', () => {
  assert.match(html, /id="pf-metros-presentacion"/);
  assert.match(html, /actualizarPresentacionProducto\(true\)/);
  assert.match(app, /costoUnitario = factorPresentacion > 1 \? costoCompra \/ factorPresentacion : costoCompra/);
  assert.match(app, /metrosPorPresentacion:/);
  assert.match(app, /parseFloat\(\(tr\.querySelector\('\.qty'\)/);
});

