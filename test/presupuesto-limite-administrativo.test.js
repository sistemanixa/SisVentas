const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.295.js', 'utf8');

test('administrativo no escala presupuestos dentro del máximo configurado', () => {
  assert.match(app, /currentRole === 'administrativo' && modo === 'revision' && !superaLimiteAprobacion/);
  assert.match(app, /modo = 'aprobado_int'/);
  assert.match(app, /superaLimiteAprobacion = \(total > APROBACION_CONFIG\.montoLimite\) \|\| \(desc > APROBACION_CONFIG\.descuentoLimite\)/);
  assert.match(app, /Guardar presupuesto/);
});

test('administrativo conserva revisión al superar monto o descuento máximo', () => {
  const decidir = (total, descuento, limiteMonto, limiteDescuento) => {
    const supera = total > limiteMonto || descuento > limiteDescuento;
    return supera ? 'revision' : 'aprobado_int';
  };
  assert.equal(decidir(199999, 10, 200000, 10), 'aprobado_int');
  assert.equal(decidir(200001, 0, 200000, 10), 'revision');
  assert.equal(decidir(100, 10.01, 200000, 10), 'revision');
});
