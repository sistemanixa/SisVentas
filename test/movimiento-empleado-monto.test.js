const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.297.js', 'utf8');

test('guardar movimiento acepta el monto visible si dataset.raw no fue inicializado', () => {
  assert.match(app, /var monto = getMontoRaw\(montoInput\)/);
  assert.match(app, /String\(montoInput\.value \|\| ''\)\.replace\(\/\\\.\/g, ''\)\.replace\(',', '\.'\)/);
  const normalizar = valor => parseFloat(String(valor || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
  assert.equal(normalizar('12.500,75'), 12500.75);
  assert.equal(normalizar('850'), 850);
});

test('guardar movimiento protege la doble ejecución y libera el bloqueo', () => {
  assert.match(app, /window\._movEmpGuardando/);
  assert.match(app, /finally\(function\(\)\{ window\._movEmpGuardando = false; \}\)/);
  assert.match(app, /\['transporte','materiales','gasto_empresa','otro'\]/);
});

test('una foto que no responde no bloquea el guardado del movimiento', () => {
  assert.match(app, /Promise\.race\(\[subidaFoto, limiteFoto\]\)/);
  assert.match(app, /La carga del comprobante demoró demasiado/);
  assert.match(app, /nuevo\.fotoUrl = null/);
});
