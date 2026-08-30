const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { readActiveApp } = require('./helpers/active-app');
const app = readActiveApp().source;
const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');
const purchases = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');
const payrollLegacy = fs.readFileSync('js/modules/payroll-legacy-migration.js', 'utf8');
const dollarHistory = fs.readFileSync('js/modules/dolar-historico.js', 'utf8');
const pwa = fs.readFileSync('js/modules/pwa-install.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('la carga inicial prioriza identidad y pantalla actual antes de los módulos secundarios', () => {
  const inicio = app.indexOf('function fbCargarTodo()');
  const fin = app.indexOf('function fbSincronizarAhora()', inicio);
  const bloque = app.slice(inicio, fin);
  assert.ok(inicio >= 0 && fin > inicio);
  assert.match(bloque, /fbCargarUsuarios\(\);\s*fbCargarClientes\(\);\s*fbCargarProductos\(\);\s*fbCargarVentas\(\);/);
  assert.match(bloque, /svCargarDatosDePaginaActual\(\);/);
  assert.equal((bloque.match(/svProgramarTrabajoFondo\(/g) || []).length, 3);
  assert.ok(bloque.indexOf('svCargarDatosDePaginaActual();') < bloque.indexOf('fbCargarGarantias();'));
});

test('la pantalla directa carga sus dependencias sin esperar el lote general', () => {
  assert.match(app, /actualizadorprecios:\s*\[fbCargarProductos, fbCargarProveedores\]/);
  assert.match(app, /gastos:\s*\[fbCargarGastos, fbCargarEmpleados, fbCargarPagos\]/);
  assert.match(app, /venta:\s*\[fbCargarClientes, fbCargarProductos, fbCargarVentas\]/);
  assert.match(app, /garantias:\s*\[fbCargarGarantias, fbCargarEquipos\]/);
  assert.match(app, /ordenes:\s*\[fbCargarOrdenes, fbCargarProductos, fbCargarProveedores\]/);
});

test('los lotes tienen una demora mínima real antes de esperar tiempo ocioso', () => {
  assert.match(app, /setTimeout\(function\(\) \{\s*if \(typeof requestIdleCallback/);
  assert.match(app, /\}, demoraMinima\);/);
  assert.match(app, /\}, 700\);/);
  assert.match(app, /\}, 1800\);/);
  assert.match(app, /\}, 3800\);/);
});

test('listeners y lecturas de configuración tienen defensas contra duplicados', () => {
  assert.match(app, /if \(window\._presenciaUsuariosListenerActivo\) return;/);
  assert.match(app, /if \(window\._cargosListenerActivo\) return;/);
  assert.match(app, /if \(window\._cargaConfigComisionesPromesa\) return window\._cargaConfigComisionesPromesa;/);
  assert.equal((app.match(/function cargarCargos\(\)/g) || []).length, 1);
  assert.match(app, /if \(window\._cargosListenerActivo\) return;/);
  assert.equal((app.match(/function cargarConfigComisiones\(\)/g) || []).length, 1);
  assert.match(app, /if \(window\._cargaConfigComisionesPromesa\) return window\._cargaConfigComisionesPromesa;/);
});

test('notificaciones no trabajan en segundo plano ni duplican eventos próximos', () => {
  assert.match(notifications, /document\.visibilityState==='hidden'&&!forzar/);
  assert.match(notifications, /ahora-ultimaActualizacionAutomatica<10000/);
  assert.match(notifications, /actualizacionAutomaticaEnCurso/);
});

test('módulos secundarios de red esperan sesión, página o tiempo ocioso', () => {
  assert.match(purchases, /svProgramarTrabajoFondo\(start, 1800\)/);
  assert.match(purchases, /event\.detail\.page === 'ordenes'/);
  assert.doesNotMatch(payrollLegacy, /if \(window\.fbDB\) setTimeout\(sv347StartAguListener/);
  assert.doesNotMatch(dollarHistory, /addEventListener\('firebase-ready'.*iniciar/);
  assert.doesNotMatch(dollarHistory, /DOMContentLoaded.*iniciar/);
  assert.equal((dollarHistory.match(/addEventListener\('sisventas:session-ready', iniciar\)/g) || []).length, 1);
});

test('el marcador liviano vigila cada minuto pero nunca trabaja con la pestaña oculta', () => {
  assert.match(app, /document\.visibilityState !== 'hidden'\) _chequearGitHub/);
  assert.match(app, /60 \* 1000/);
  assert.match(pwa, /document\.visibilityState !== 'hidden'/);
  assert.match(pwa, /15 \* 60 \* 1000/);
  assert.doesNotMatch(pwa, /2 \* 60 \* 1000/);
});

test('las tarjetas móviles no heredan máximos de ancho de las tablas de escritorio', () => {
  assert.match(css, /table\.sv-mobile-card-grid tbody > tr > td\{[\s\S]{0,500}max-width:none!important/);
  assert.match(css, /@media\(max-width:520px\)\{[\s\S]{0,250}#mod-ap-proveedores\{grid-template-columns:1fr!important\}/);
});
