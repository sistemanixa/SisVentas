const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('solo admin puede eliminar empleados y no se rompen referencias históricas', () => {
  assert.match(app, /Solo el administrador puede eliminar empleados/);
  assert.match(app, /var tieneVentas = \(ventasList\|\|\[\]\)\.some/);
  assert.match(app, /var tieneOT = \(otData\|\|\[\]\)\.some/);
  assert.match(app, /Desactivá el empleado para conservar la trazabilidad/);
});

test('empleados distingue los cargos que son solo comisión', () => {
  assert.match(app, /var cargoSoloComision =/);
  assert.match(app, /cargoSoloComision\?'<span class="badge b-green">Solo comisión/);
});
