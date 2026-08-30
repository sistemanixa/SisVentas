const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('V3 publica recursos inmutables y carga el lanzamiento antes de la app', () => {
  const html = read('index.html');
  assert.match(html, /VERSION: 'v3\.0\.9-firebase'/);
  assert.match(html, /js\/core\/version\.v3\.0\.9\.js/);
  assert.match(html, /js\/app\.v3\.0\.9\.js/);
  assert.ok(html.indexOf('js/modules/v3-launch.js') < html.indexOf('js/app.v3.0.9.js'));
});

test('la primera sesión restaurada se cierra una sola vez por usuario y dispositivo', () => {
  const launch = read('js/modules/v3-launch.js');
  const app = read('js/app.v3.0.0.js');
  assert.match(launch, /fbAuth && window\.fbAuth\.currentUser/);
  assert.match(launch, /_restaurandoSesionInicial === true/);
  assert.match(launch, /_ejecutarLogout\('lanzamiento-v3'\)/);
  assert.match(launch, /sisventas_v3_reingreso_/);
  assert.match(app, /function _completarLogin\(nombre\) \{\s*if \(typeof window\.svV3LaunchBeforeSession/);
});

test('el reingreso muestra una bienvenida V3 y el historial distingue la versión mayor', () => {
  const launch = read('js/modules/v3-launch.js');
  const app = read('js/app.v3.0.0.js');
  assert.match(launch, /¡Bienvenido.*SisVentas 3!/);
  assert.match(launch, /sisventas:session-ready/);
  assert.match(launch, /127\\\.0\\\.0\\\.1\|localhost/);
  assert.match(app, /version: 'v3\.0\.0'/);
  assert.match(app, /major: true/);
  assert.match(app, /esVersionMayor \? '#f6c453'/);
  assert.match(app, /esLanzamientoV3 = \/\^v\?2\\\.\//);
  assert.match(app, /\^v\?3\\\.0\\\.0\$/);
  assert.match(app, /esLanzamientoV3 \? '#f6c453' : 'var\(--green\)'/);
});

test('el service worker precarga el lanzamiento completo de V3', () => {
  const sw = read('sw.js');
  assert.match(sw, /sisventas-v3\.0\.9/);
  assert.match(sw, /app\.v3\.0\.9\.js/);
  assert.match(sw, /version\.v3\.0\.9\.js/);
  assert.match(sw, /modules\/v3-launch\.js/);
});
