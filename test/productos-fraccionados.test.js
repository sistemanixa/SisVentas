const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.319.js'), 'utf8');

test('los productos por metro convierten la presentacion de proveedor a costo unitario', () => {
  assert.match(app, /function costoUnitarioProveedorProducto\(p, pv\)/);
  assert.match(app, /costoPresentacion \/ unidadesPorPresentacion/);
  assert.match(app, /costoUnitarioProveedorPrincipalProducto\(p\)/);
  assert.match(app, /monedaOrigen: 'PROVEEDOR_POR_METRO'/);
  assert.match(app, /var costo = costoUnitarioProveedorProducto\(p, principal\)/);
});

test('la regla de fraccionamiento conserva la presentacion normal para productos por unidad', () => {
  assert.match(app, /if \(String\(p\.unidad \|\| ''\)\.toLowerCase\(\) === 'metro'\)/);
  assert.match(app, /if \(String\(p\.unidad \|\| ''\)\.toLowerCase\(\) !== 'metro'\) return 1/);
});
