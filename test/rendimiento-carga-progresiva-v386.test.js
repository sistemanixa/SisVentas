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

test('la carga inicial usa sólo la ruta y el directorio, sin historiales diferidos', () => {
  const inicio = app.indexOf('function fbCargarTodo()');
  const fin = app.indexOf('function svInvalidarOperacionesSesion()', inicio);
  const bloque = app.slice(inicio, fin);
  assert.ok(inicio >= 0 && fin > inicio);
  assert.match(bloque, /svCargarDatosDePaginaActual\(paginaInicio\);/);
  assert.match(bloque, /fbCargarUsuarios\(\);/);
  assert.doesNotMatch(bloque, /svProgramarTrabajoFondo\(/);
  for (const cargar of ['Clientes','Productos','Ventas','Pagos','Presupuestos','OTs','Ordenes','Gastos']) {
    assert.doesNotMatch(bloque, new RegExp('fbCargar' + cargar + '\\(\\)'));
  }
});

test('la pantalla directa carga sus dependencias sin esperar el lote general', () => {
  assert.match(app, /actualizadorprecios:\s*\[fbCargarProductos, fbCargarProveedores\]/);
  // Gastos consumes its own payment history. Loading global customer collections
  // here was an unnecessary dependency; exercise the active loader, not its text.
  const vm=require('node:vm'),source=require('./helpers/app-functions.cjs').functionSource('svCargarDatosDePaginaActual'),calls=[],context={permisoModulo:()=>true};
  for(const name of new Set(source.match(/\b(?:fbCargar\w+|cargarKits|spCargar|svCargarInicioDashboardDemandado)\b/g)||[]))context[name]=()=>calls.push(name);
  context.window=context;vm.runInNewContext(source,context);context.svCargarDatosDePaginaActual('gastos');
  assert.deepEqual(calls,['fbCargarGastos','fbCargarEmpleados']);
  calls.length=0;context.svCargarDatosDePaginaActual('venta');
  assert.deepEqual(calls,['fbCargarClientes','fbCargarProductos','fbCargarVentas','fbCargarEmpleados','fbCargarClientesUnificados']);
  assert.match(app, /garantias:\s*\[fbCargarGarantias, fbCargarEquipos, fbCargarClientes, fbCargarVentas, fbCargarProductos\]/);
  assert.match(app, /ordenes:\s*\[fbCargarOrdenes, fbCargarProductos, fbCargarProveedores\]/);
});

test('los lotes tienen una demora mínima real antes de esperar tiempo ocioso', () => {
  assert.match(app, /setTimeout\(function\(\) \{\s*if \(!vigente\(\)\) \{[^\n]+\}\s*if \(typeof requestIdleCallback/);
  assert.match(app, /\}, demoraMinima\);/);
});

test('listeners y lecturas de configuración tienen defensas contra duplicados', () => {
  assert.match(app, /if \(window\._presenciaUsuariosListenerActivo\) return;/);
  assert.match(app, /if \(window\._cargosListenerActivo\) return;/);
  assert.match(app, /if \(window\._cargaConfigComisionesPromesa\) return window\._cargaConfigComisionesPromesa;/);
  assert.equal((app.match(/function cargarCargos\(\)/g) || []).length, 1);
  assert.match(app, /if \(window\._cargosListenerActivo\) return;/);
  assert.equal((app.match(/function cargarConfigComisiones\((?:forzar)?\)/g) || []).length, 1);
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

test('marcador y PWA consultan al abrir sin vigilar por intervalos en reposo', () => {
  const watchdog=app.slice(app.indexOf('function iniciarWatchdogVersion()'),app.indexOf('var _chequeoVersionIniciado'));
  assert.doesNotMatch(watchdog, /setInterval/);
  assert.doesNotMatch(pwa, /setInterval/);
  assert.match(pwa, /reg\.update\(\)/);
});

test('las tarjetas móviles no heredan máximos de ancho de las tablas de escritorio', () => {
  assert.match(css, /table\.sv-mobile-card-grid tbody > tr > td\{[\s\S]{0,500}max-width:none!important/);
  assert.match(css, /@media\(max-width:520px\)\{[\s\S]{0,250}#mod-ap-proveedores\{grid-template-columns:1fr!important\}/);
});
