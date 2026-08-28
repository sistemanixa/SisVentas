const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'app.v3.0.2.js'), 'utf8');
const index = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('el recordatorio se activa luego de tres horas de actividad continua', () => {
  assert.match(app, /const DESCANSO_ACTIVIDAD_MS = 3 \* 60 \* 60 \* 1000/);
  assert.match(app, /ahora - ultimo >= SESSION_TIMEOUT/);
  assert.match(app, /ahora - inicio >= DESCANSO_ACTIVIDAD_MS/);
  assert.match(app, /mostrarRecordatorioDescanso\(\)/);
  assert.match(app, /sv_activeStreakStart/);
});

test('el aviso usa un mate, estilo V3 y se limpia al cerrar sesión', () => {
  assert.match(app, /id = 'modal-recordatorio-descanso'/);
  assert.match(app, /Hora de un descanso/);
  assert.match(app, /Llevás 3 horas de actividad/);
  assert.match(app, /<svg width="76" height="76"/);
  assert.match(app, /localStorage\.removeItem\('sv_activeStreakStart'\)/);
  assert.match(app, /cerrarRecordatorioDescanso\(false\)/);
});

test('solo Admin puede abrir las vistas previas sin alterar el contador', () => {
  assert.match(index, /Probar recordatorio de descanso/);
  assert.match(index, /cerrarUserPanel\(\);mostrarRecordatorioDescanso\(true\)/);
  assert.match(index, /Probar regreso al trabajo/);
  assert.match(index, /cerrarUserPanel\(\);mostrarMensajeRegresoDescanso\(\)/);
  assert.match(index, /class="up-item admin-only"[^>]*mostrarRecordatorioDescanso\(true\)/);
  assert.match(index, /class="up-item admin-only"[^>]*mostrarMensajeRegresoDescanso\(\)/);
});

test('al aceptar un descanso real agenda un mensaje motivador media hora después', () => {
  assert.match(app, /const DESCANSO_REGRESO_MS = 30 \* 60 \* 1000/);
  assert.match(app, /overlay\.dataset\.descansoReal = esPrueba === true \? '0' : '1'/);
  assert.match(app, /cerrarRecordatorioDescanso\(true\)/);
  assert.match(app, /programarRegreso === true && eraAvisoReal/);
  assert.match(app, /localStorage\.setItem\('sv_breakReturnAt'/);
  assert.match(app, /¡A seguir con nueva energía!/);
  assert.match(app, /Pausa completada/);
});

test('el regreso pendiente se conserva entre sesiones y se revisa al volver', () => {
  assert.doesNotMatch(app, /removeItem\('sv_breakReturnAt'\)[\s\S]{0,250}function stopSessionTimer/);
  assert.match(app, /function startSessionTimer\(\)[\s\S]*?_revisarMensajeRegresoDescanso\(\)/);
  assert.match(app, /visibilityState === 'visible'[\s\S]*?_revisarMensajeRegresoDescanso\(\)/);
  assert.match(app, /window\.addEventListener\('pageshow'[\s\S]*?_revisarMensajeRegresoDescanso\(\)/);
});
