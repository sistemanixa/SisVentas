const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.2.5.js', 'utf8');

test('costo y ganancia usan un bloque visual general con ganancia destacada', () => {
  assert.match(app, /function _margenCostoGananciaHTML\(costo, ganancia\)/);
  assert.match(app, /<span>Ganancia<\/span><span>/);
  assert.match(app, /color:var\(--green\);font-size:15px;font-weight:700/);
  assert.ok((app.match(/_margenCostoGananciaHTML\(/g) || []).length >= 5,
    'el formato debe reutilizarse en venta, presupuesto y sus detalles');
});
