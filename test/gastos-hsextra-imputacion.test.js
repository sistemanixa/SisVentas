const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.373.js', 'utf8');

test('horas extra separan el mes trabajado de la fecha en que se vuelven pagables', () => {
  assert.match(app, /periodoTrabajo:grupo\.mes/);
  assert.match(app, /fecha:fechaImputacion/);
  assert.match(app, /fechaTrabajo:\(detalleDias\[0\]\|\|\{\}\)\.fecha/);
  assert.match(app, /function fechaImputacionGasto\(g\)/);
});

test('el indicador de pendientes excluye gastos anulados y rechazados', () => {
  assert.match(app, /\['pendiente_aprobacion','pendiente_pago','pagado_parcial'\]\.includes\(normalizarEstadoGasto\(g\)\)/);
});

test('las horas extra pendientes se reflejan en Empleados y Notificaciones', () => {
  const index = fs.readFileSync('index.html', 'utf8');
  assert.match(index, /id="badge-nav-empleados"/);
  assert.match(app, /window\._notificacionesHsExtraPendientes = grupos/);
  assert.match(app, /Horas extra para aprobar/);
});
