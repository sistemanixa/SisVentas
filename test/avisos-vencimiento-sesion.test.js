const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('los vencimientos sólo se procesan dentro de una sesión administrativa válida', () => {
  assert.match(app, /function _svSesionActivaParaVencimientos\(\)/);
  assert.match(app, /isAuthenticated &&[\s\S]{0,180}currentUserUid/);
  assert.match(app, /\['admin','administrativo'\]\.includes\(currentRole\)/);
  assert.match(app, /function verificarVencimientosPptos\(\) \{[\s\S]{0,260}if \(!_svSesionActivaParaVencimientos\(\)\) return;/);
  assert.match(app, /function pptoAlertarVencimientosProximos\(pptos\) \{[\s\S]{0,120}if \(!_svSesionActivaParaVencimientos\(\)\) return;/);
});

test('el flujo se detiene al cerrar sesión y no acumula intervalos', () => {
  assert.match(app, /function inicializarFlujoVentas\(\) \{\s*detenerFlujoVentas\(\)/);
  assert.match(app, /function detenerFlujoVentas\(\)/);
  assert.match(app, /function _cerrarInterfacesAlSalir\(\) \{\s*if \(typeof detenerFlujoVentas/);
});

test('cada presupuesto se avisa una sola vez por usuario y día', () => {
  assert.match(app, /sisventas:ppto-vencimiento:/);
  assert.match(app, /localStorage\.getItem\(_svClaveAvisoVencimiento/);
  assert.match(app, /localStorage\.setItem\(_svClaveAvisoVencimiento/);
});

test('el recordatorio usa el aviso visual integrado y queda debajo del login', () => {
  const inicio = app.indexOf('function pptoAlertarVencimientosProximos');
  const fin = app.indexOf('function flujoPostPago', inicio);
  const recordatorio = app.slice(inicio, fin);
  assert.match(app, /className = 'sv-action-alert'/);
  assert.doesNotMatch(recordatorio, /z-index:99999/);
  assert.match(css, /\.sv-action-alert-stack\{[^}]*z-index:900/);
  assert.match(css, /\.sv-action-alert\{/);
});
