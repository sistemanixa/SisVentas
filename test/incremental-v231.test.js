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

test('el modulo visual consume interfaces estables de sesion y notificaciones', () => {
  assert.match(app, /window\.obtenerContextoSesionSisVentas/);
  assert.match(app, /window\.obtenerNotificacionesSisVentas/);
  assert.match(notifications, /global\.obtenerContextoSesionSisVentas/);
  assert.match(notifications, /global\.obtenerNotificacionesSisVentas/);
  assert.match(notifications, /var ctx=sessionContext\(\)/);
  assert.match(notifications, /var n=notifSource\(\)\.find/);
});

test('la publicacion corresponde a v2.0.231', () => {
  assert.match(app, /VERSION: 'v2\.0\.231-firebase'/);
  assert.match(index, /app\.v2\.0\.231\.js/);
  assert.match(index, /version\.v2\.0\.231\.js/);
  assert.match(sw, /sisventas-v2\.0\.231/);
});
