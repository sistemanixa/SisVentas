const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.331.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const coreInmutable = fs.readFileSync('js/core/version.v2.0.331.js', 'utf8');
const dashboardVentas = fs.readFileSync('js/modules/sales-dashboard.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const acciones = fs.readFileSync('js/modules/action-permissions.js', 'utf8');
const cotizador = fs.readFileSync('cotizador/index.js', 'utf8');

test('v2.0.331 publica archivos inmutables y marcadores consistentes', () => {
  assert.match(html, /VERSION:\s*'v2\.0\.331-firebase'/);
  assert.match(html, /js\/app\.v2\.0\.331\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.331\.js/);
  assert.match(html, /id="loading-version"[^>]*>v2\.0\.331</);
  assert.match(html, /css\/app\.css\?v=2\.0\.331/);
  assert.match(html, /sales-dashboard\.js\?v=2\.0\.331/);
  assert.match(app, /VERSION:\s*'v2\.0\.331-firebase'/);
  assert.match(app, /version:\s*'v2\.0\.331'/);
  assert.match(core, /v2\.0\.331/);
  assert.match(coreInmutable, /v2\.0\.331/);
  assert.match(sw, /sisventas-v2\.0\.331/);
  assert.match(sw, /app\.v2\.0\.331\.js/);
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

test('Novedades registra obligatoriamente v2.0.331', () => {
  assert.match(app, /RELEASE_HISTORY[\s\S]*?version:\s*'v2\.0\.331'/);
  assert.match(app, /Extractos por período y Dashboard ampliado/);
});

test('el extracto permite filtrar un período, conserva saldo anterior y saldo de cierre', () => {
  assert.match(html, /id="cc-extracto-desde"/);
  assert.match(html, /id="cc-extracto-hasta"/);
  assert.match(app, /function _ccVistaExtractoFiltrada\(/);
  assert.match(app, /Saldo anterior al período/);
  assert.match(app, /vista\.saldoFinal/);
  const inicio = app.indexOf('function _ccTimestampFechaInput');
  const fin = app.indexOf('function aplicarFiltroExtractoCuentaCorriente', inicio);
  const valores = { 'cc-extracto-desde':'2026-08-01', 'cc-extracto-hasta':'2026-08-31' };
  const contexto = {
    document: { getElementById: (id) => ({ value: valores[id] || '' }) }
  };
  vm.runInNewContext(app.slice(inicio, fin), contexto);
  const ts = (y,m,d) => new Date(y,m-1,d,12).getTime();
  const vista = contexto._ccVistaExtractoFiltrada({ movimientos:[
    { ts:ts(2026,7,20), saldo:100 },
    { ts:ts(2026,8,5), saldo:150 },
    { ts:ts(2026,8,10), saldo:130 },
    { ts:ts(2026,9,2), saldo:180 }
  ] });
  assert.equal(vista.saldoAnterior, 100);
  assert.equal(vista.movimientos.length, 2);
  assert.equal(vista.saldoFinal, 130);
});

test('la vista previa del extracto se mueve y alterna maximizar o restaurar', () => {
  assert.match(app, /btnMaximizar\.addEventListener\('click'/);
  assert.match(app, /encabezado\.addEventListener\('pointerdown'/);
  assert.match(app, /ti ti-minimize/);
  assert.match(app, /translate\('/);
});

test('Dashboard amplía los gráficos y KPIs para ocupar la tarjeta de ventas', () => {
  assert.match(dashboardVentas, /display:flex!important;flex-direction:column!important/);
  assert.match(dashboardVentas, /dash-ventas-split\{flex:1 1 auto!important/);
  assert.match(dashboardVentas, /dash-bar-area\{flex:1 1 auto!important/);
  assert.match(dashboardVentas, /sv332-q\{padding:18px 16px!important;min-height:120px/);
});

test('Cuenta corriente genera el extracto desde los movimientos conciliados visibles', () => {
  assert.match(html, /onclick="imprimirExtractoCuentaCorriente\(\)"/);
  assert.match(app, /window\._ccExtractoActual\s*=\s*\{/);
  assert.match(app, /m\.saldo\s*=\s*saldoCorrido/);
  assert.match(app, /Pago conciliado en cuenta/);
  assert.match(app, /Number\(d\.cobrado\).*haberDetallado/);
  assert.match(app, /function imprimirExtractoCuentaCorriente\(\)/);
  assert.match(app, /marco\.srcdoc\s*=\s*html/);
  assert.match(app, /Imprimir \/ guardar PDF/);
  assert.match(app, /Cargos del período/);
  assert.match(app, /Pagos del período/);
  assert.match(app, /Saldo al cierre/);
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
