const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.v2.0.234.js');
const notifications = read('js', 'modules', 'notifications.js');

test('los avisos importantes forman una cola y se pausan durante la gestion', () => {
  assert.match(notifications, /avisoCriticoGestion/);
  assert.match(notifications, /Aviso '\+posicion\+' de '\+lote\.total/);
  assert.match(notifications, /if\(avisoCriticoGestion\)\{ if\(existente\) existente\.remove\(\); return; \}/);
  assert.match(notifications, /reanudarColaAvisosCriticos/);
});

test('la cola reanuda al salir del presupuesto, OT o modulo destino', () => {
  assert.match(app, /sisventas:accion-notificacion-cerrada/);
  assert.match(notifications, /sisventas:ot-closed/);
  assert.match(notifications, /pagina!==avisoCriticoGestion\.destino/);
});

test('la publicacion corresponde a v2.0.234', () => {
  assert.match(app, /VERSION: 'v2\.0\.234-firebase'/);
});
