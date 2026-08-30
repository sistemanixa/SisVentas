const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const launch = fs.readFileSync('js/modules/v3-launch.js', 'utf8');
const app = fs.readFileSync('js/app.v3.0.7.js', 'utf8');

test('la bienvenida cerrada habilita la novedad pendiente', () => {
  assert.match(launch, /localStorage\.getItem\(claveBienvenida\(\)\) === VERSION_BIENVENIDA/);
  assert.doesNotMatch(launch, /localStorage\.getItem\(claveBienvenida\(\)\) === VERSION;/);
  assert.match(app, /addEventListener\('sisventas:v3-welcome-closed'[\s\S]*_mostrarNovedadActualizacionPendiente/);
});

test('tema y logo quedan preparados antes del primer render', () => {
  assert.ok(index.indexOf("localStorage.getItem('nixa_dark')") < index.indexOf('css/app.css'));
  assert.match(index, /window\.__SISVENTAS_BOOT_LOGO = localStorage\.getItem\('nixa_logo'\)/);
  assert.match(css, /html\.dark-mode,body\.dark-mode\{/);
});

test('login y carga reservan la misma geometría horizontal del logo', () => {
  assert.match(css, /\.sv-boot-logo\{width:132px;height:86px/);
  assert.match(css, /\.login-logo-mark\{width:132px;height:86px/);
  assert.match(app, /precarga\.onload = function\(\) \{ img\.src = src; \}/);
});
