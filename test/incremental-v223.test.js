const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const notifications = read('js', 'modules', 'notifications.js');
const permissions = read('js', 'modules', 'action-permissions.js');
const index = read('index.html');
const sw = read('sw.js');

test('el actualizador permite elegir proveedores y excluye Mercado Libre inicialmente', () => {
  assert.match(app, /function leerSeleccionProveedoresActualizador\(\)/);
  assert.match(app, /mercado_libre:false/);
  assert.match(app, /sisventas_actualizador_proveedores_v1/);
  assert.match(app, /tiposSeleccionados\.indexOf\(x\.tipo\) >= 0/);
});

test('la auditoría recuerda reparaciones y permite buscar casos', () => {
  assert.match(app, /var ajusteYaAplicado = !!\(ultimaAuditoria/);
  assert.match(app, /var correccionLegacy = \(ajusteYaAplicado \|\| correccionProveedor\) \? null/);
  assert.match(app, /data-auditoria-precio="1"/);
  assert.match(app, /function filtrarAuditoriaIntegridadPrecios\(valor\)/);
});

test('el permiso para eliminar productos se aplica igual desde lista y detalle', () => {
  assert.match(permissions, /\['eliminarProductoPorId','productos\.eliminar'\]/);
  assert.match(app, /window\.tienePermiso\('productos\.eliminar'\)/);
  assert.match(permissions, /'productos\.eliminar':\s*\{ modulo:'productos', admin:true \}/);
});

test('las aprobaciones de presupuestos generan un aviso crítico en pantalla', () => {
  assert.match(notifications, /function esAvisoCriticoPresupuesto\(n\)/);
  assert.match(notifications, /ppto_aprob_/);
  assert.match(notifications, /ppto_aprobado_int_/);
  assert.match(notifications, /modal-aviso-critico-presupuesto/);
  assert.match(notifications, /modal-comunicado-global/);
  assert.match(notifications, /setN\(id,\{estado:'leida'\}\)/);
});

test('todos los archivos publicados corresponden a v2.0.223', () => {
  assert.match(app, /VERSION: 'v2\.0\.223-firebase'/);
  assert.match(index, /app\.v2\.0\.223\.js/);
  assert.match(index, /version\.v2\.0\.223\.js/);
  assert.match(index, /resizable-tables\.js\?v=2\.0\.223/);
  assert.match(index, /page-transition\.js\?v=2\.0\.223/);
  assert.match(sw, /sisventas-v2\.0\.223/);
});
