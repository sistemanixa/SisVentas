const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.325.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const coreInmutable = fs.readFileSync('js/core/version.v2.0.325.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const acciones = fs.readFileSync('js/modules/action-permissions.js', 'utf8');
const cotizador = fs.readFileSync('cotizador/index.js', 'utf8');

test('v2.0.325 publica archivos inmutables y marcadores consistentes', () => {
  assert.match(html, /VERSION:\s*'v2\.0\.325-firebase'/);
  assert.match(html, /js\/app\.v2\.0\.325\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.325\.js/);
  assert.match(html, /id="loading-version"[^>]*>v2\.0\.325</);
  assert.match(html, /css\/app\.css\?v=2\.0\.325/);
  assert.match(app, /VERSION:\s*'v2\.0\.325-firebase'/);
  assert.match(app, /version:\s*'v2\.0\.325'/);
  assert.match(core, /v2\.0\.325/);
  assert.match(coreInmutable, /v2\.0\.325/);
  assert.match(sw, /sisventas-v2\.0\.325/);
  assert.match(sw, /app\.v2\.0\.325\.js/);
});

test('Dashboard incorpora agenda rápida e indicadores operativos de OT', () => {
  assert.match(html, /id="dash-agenda-card"/);
  assert.match(html, /id="dash-ot-resumen"/);
  assert.match(app, /function dashAbrirAgenda\(/);
  assert.match(app, /function dashAbrirOTResumen\(/);
  assert.match(app, /dash-ot-vencidas/);
  assert.match(app, /dash-agenda-semana/);
});

test('Roles incorpora Técnico-vendedor y permisos desplegables por acción', () => {
  assert.match(app, /tecnico_vendedor/);
  assert.match(app, /ROLES_MODULOS_EXPANDIDOS/);
  assert.match(app, /function toggleAccionesModuloRol\(/);
  assert.match(app, /acciones:\{\}/);
  assert.match(acciones, /window\.SISVENTAS_PERMISOS_ACCION/);
  assert.match(acciones, /function overrideAccion\(/);
  assert.match(acciones, /'kits\.editar'/);
  assert.match(acciones, /'presupuestos\.anular'/);
});

test('los permisos guardados habilitan o bloquean la acción sin saltear el acceso al módulo', () => {
  const corte = acciones.indexOf('  function proteger(');
  assert.ok(corte > 0);
  const window = {
    currentRole: 'vendedor',
    PERMISOS_DEFAULT: {},
    PERMISOS_ROLES: {
      vendedor: { bloqueados: [], acciones: { ventas: { editar:true } } }
    }
  };
  window.window = window;
  vm.runInNewContext(acciones.slice(0, corte) + '\n})();', window);
  assert.equal(window.tienePermiso('ventas.editar'), true);
  window.PERMISOS_ROLES.vendedor.acciones.ventas.editar = false;
  assert.equal(window.tienePermiso('ventas.editar'), false);
  window.PERMISOS_ROLES.vendedor.acciones.ventas.editar = true;
  window.PERMISOS_ROLES.vendedor.bloqueados.push('detalle');
  assert.equal(window.tienePermiso('ventas.editar'), false);
});

test('Novedades registra obligatoriamente v2.0.325', () => {
  assert.match(app, /RELEASE_HISTORY[\s\S]*?version:\s*'v2\.0\.325'/);
  assert.match(app, /Eliminación segura de bonificaciones/);
});

test('v2.0.325 conserva los respaldos y confirmaciones de Mercado Libre de v2.0.322', () => {
  assert.match(app, /async function reintentarFallosActualizador/);
  assert.match(app, /confirmarIdentidadMercadoLibreActualizador/);
  assert.match(cotizador, /\/items\?ids=/);
  assert.match(cotizador, /datosEstructuradosMercadoLibreDesdeHtml/);
  assert.match(cotizador, /PRODUCT_IDENTITY_REQUIRES_CONFIRMATION/);
  assert.match(cotizador, /requiereConfirmacionIdentidad:true/);
});

test('v2.0.325 conserva la mejora visual de reclamos de v2.0.322', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(html, /id="sp-nuevo-desc"[^>]+min-height:154px/);
  assert.match(css, /\.fg input,\.fg select,\.fg textarea\{/);
});

test('v2.0.325 guarda la bonificación con una actualización multipath acotada', () => {
  const inicio = app.indexOf('function _guardarBonificacionEmpleadoAtomica');
  const fin = app.indexOf('var _comisionManualVentasMap', inicio);
  const flujo = app.slice(inicio, fin);
  assert.match(flujo, /actualizaciones\['ctaemp\/' \+ emp\.fbKey \+ '\/' \+ movKey\] = movGuardado/);
  assert.match(flujo, /actualizaciones\['gastos\/' \+ gastoKey\] = gastoGuardado/);
  assert.match(flujo, /window\.fbUpdate\(window\.fbRef\(window\.fbDB, 'sisventas'\), actualizaciones\)/);
  assert.doesNotMatch(flujo, /fbRunTransaction\(window\.fbRef\(window\.fbDB, 'sisventas'/);
});

test('v2.0.325 elimina juntas la bonificación y su movimiento de cuenta', () => {
  const inicio = app.indexOf('function _eliminarBonificacionGastoVinculada');
  const fin = app.indexOf('async function eliminarCliente', inicio);
  const flujo = app.slice(inicio, fin);
  assert.match(flujo, /actualizaciones\['sisventas\/gastos\/' \+ gastoFbKey\] = null/);
  assert.match(flujo, /actualizaciones\['sisventas\/ctaemp\/' \+ empleadoFbKey \+ '\/' \+ movimientoCtaKey\] = null/);
  assert.match(flujo, /También se quitará de la cuenta del empleado/);
});
