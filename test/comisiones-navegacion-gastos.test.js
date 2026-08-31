const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const activo = (html.match(/<script src="\.\/js\/(app\.v[^"?]+\.js)/) || [])[1];
const app = fs.readFileSync(path.join(raiz, 'js', activo), 'utf8');

test('Gastos abre la venta de una comisión y conserva el contexto de regreso', () => {
  assert.match(app, /function irAVentaDesdeGastoComision\(gastoFbKey\)/);
  assert.match(app, /window\._ventaDesdeHistorialOrigen = 'gastos'/);
  assert.match(app, /window\._gastosRetornoVenta = estado/);
  assert.match(app, /irAVentaDesdeGastoComision/);
  assert.match(app, /Abrir venta vinculada/);
  assert.match(app, /if \(origen === 'gastos' && window\._gastosRetornoVenta\)/);
  assert.match(app, /filtrarGastos\(true\)/);
});
