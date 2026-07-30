const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const notifications = read('js', 'modules', 'notifications.js');
const index = read('index.html');
const sw = read('sw.js');

test('los avisos urgentes se programan cuando termina la carga real de notificaciones', () => {
  assert.match(app, /new CustomEvent\('sisventas:notificaciones-actualizadas'/);
  assert.match(notifications, /addEventListener\('sisventas:notificaciones-actualizadas',programarAvisoCriticoPresupuesto\)/);
});

test('la publicacion corresponde a v2.0.232', () => {
  assert.match(app, /VERSION: 'v2\.0\.232-firebase'/);
  assert.match(index, /app\.v2\.0\.232\.js/);
  assert.match(index, /version\.v2\.0\.232\.js/);
  assert.match(sw, /sisventas-v2\.0\.232/);
});
