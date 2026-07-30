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

test('toda notificación urgente nueva puede mostrarse como aviso central', () => {
  assert.match(notifications, /return !!\(n&&n\.urgente\)/);
  assert.match(notifications, /visibleNotif\(n,''\)&&!getN\(n\.id\)\.estado/);
  assert.match(notifications, /modal-aviso-critico-presupuesto/);
  assert.match(notifications, /notifAvisoCriticoEntendido/);
  assert.match(notifications, /notifAvisoCriticoAbrir/);
});

test('la publicación corresponde a v2.0.230', () => {
  assert.match(app, /VERSION: 'v2\.0\.230-firebase'/);
  assert.match(index, /app\.v2\.0\.230\.js/);
  assert.match(index, /version\.v2\.0\.230\.js/);
  assert.match(sw, /sisventas-v2\.0\.230/);
});
