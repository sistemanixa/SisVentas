const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.236.js'), 'utf8');
const metrics = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'metrics-cache.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'ot-workflow.js'), 'utf8');

test('OT usa el puente reversible para modelo y persistencia', () => {
  assert.match(app, /function otV3Invocar\(/);
  assert.match(app, /bridge\.invoke\('ordenesTrabajo'/);
  assert.match(app, /function otPersistirGuardar\(/);
  assert.match(app, /function otPersistirActualizar\(/);
  assert.match(app, /function otPersistirEliminar\(/);
  assert.match(app, /prom = otPersistirGuardar\(cambiosOT\)/);
  assert.match(workflow, /window\.otPersistirGuardar\(ot\)/);
});

test('la foto V3 es una tarea cancelable y guarda metadatos dentro de la OT', () => {
  assert.match(app, /createAttachmentTask/);
  assert.match(app, /signal\.addEventListener\('abort'/);
  assert.match(app, /otPersistirActualizar\(key, \{ \['notasTecnico\/\' \+ notaFoto\._firebaseKey\]: notaFoto \}\)/);
  assert.match(app, /timeoutMs: 240000/);
});

test('las métricas de OT cambian al modelo V3 sólo cuando el puente está activo', () => {
  assert.match(metrics, /bridge\.invoke\('ordenesTrabajo', 'model'/);
  assert.match(metrics, /abiertas:modeloV3\.metrics\.open/);
  assert.match(metrics, /completadasTotal:modeloV3\.metrics\.completed/);
});
