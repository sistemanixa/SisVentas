const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.321.js'), 'utf8');

test('registrar haberes permite una bonificación individual y recalcula totales', () => {
  assert.match(app, /Bonificación<\/th>/);
  assert.match(app, /data-hab-empleado=/);
  assert.match(app, /function actualizarBonificacionHaberes\(/);
  assert.match(app, /fila\.total = \(parseFloat\(fila\.sueldo\) \|\| 0\) \+ fila\.bonificacion/);
  assert.match(app, /hab-total-lbl/);
});

test('la bonificación se guarda de forma auditable en gasto, haber y cuenta del empleado', () => {
  const inicio = app.indexOf('async function confirmarRegistroHaberes');
  const fin = app.indexOf('// ═', inicio);
  const flujo = app.slice(inicio, fin > inicio ? fin : undefined);
  assert.match(flujo, /var bonificacion = Math\.max\(0, parseFloat\(f\.bonificacion\) \|\| 0\)/);
  assert.match(flujo, /var bruto = Math\.max\(0, \(parseFloat\(sueldo\) \|\| 0\) \+ bonificacion\)/);
  assert.ok((flujo.match(/bonificacion:\s+bonificacion/g) || []).length >= 3);
  assert.match(flujo, /_habPrepararCompensacion\(ctaData\[e\.fbKey\] \|\| \{\}, bruto, mesISO\)/);
});
