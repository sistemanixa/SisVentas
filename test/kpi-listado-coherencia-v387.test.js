const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const ot = fs.readFileSync('js/modules/ot-admin.js', 'utf8');

test('Gastos usa el mismo predicado para calcular y abrir cada KPI', () => {
  assert.match(app, /function _gastoCoincideKpi\(tipo, g, fechaReferencia\)/);
  assert.match(app, /_gastoCoincideKpi\('pendiente', g, hoy\)/);
  assert.match(app, /_gastoCoincideKpi\('vence', g, hoy\)/);
  assert.match(app, /_gastoCoincideKpi\('reembolso', g, hoy\)/);
  assert.match(app, /window\._gastosKpiDetalleKeys/);
  assert.match(app, /clavesKpi\.has\(_claveGastoKpi\(g\)\)/);
});

test('El clic de Gastos elimina búsquedas residuales y conserva el empleado elegido', () => {
  assert.match(app, /buscar\.value = fEmpleado && fEmpleado\.value/);
  assert.match(app, /window\._filtroGastosKpiActivo = tipo/);
  assert.match(app, /filtrarGastos\(true\)/);
});

test('El KPI Sin precio limpia filtros incompatibles antes de mostrar la grilla', () => {
  assert.match(app, /if \(_filtroProductosSinPrecio\) \{/);
  assert.match(app, /window\._prodCategoriaFiltro = ''/);
  assert.match(app, /_filtroUsoProductos = 'todos'/);
});

test('Para hoy en OT filtra el mismo universo de órdenes abiertas que cuenta', () => {
  assert.match(ot, /tipo === 'hoy'.*est\.value = 'abiertas'.*_otFiltroEspecial315 = 'abiertas'/);
});

test('Dashboard, Cobranzas y Cuenta corriente excluyen ventas anuladas de la deuda', () => {
  assert.match(app, /function _svConstruirCuentaCorriente\(ventas, pagos\)[\s\S]*?listaVentas = listaVentas\.filter/);
  assert.match(app, /ventaValidaParaMetricas\(venta\)/);
  assert.match(app, /var resumenDeuda = window\._ccMapActual[\s\S]*?: _svResumenCuentaCorriente\(ventasDeuda\)/);
});

test('el KPI fiscal conserva centavos, muestra capacidad y evita menos cero', () => {
  assert.match(app, /if \(Math\.abs\(debito\) < 0\.005\) debito = 0/);
  assert.match(app, /ivaEl\.textContent = typeof cfPesos === 'function'/);
  assert.match(app, /cfPesos\(capacidad\.total\)/);
  assert.match(app, /saldo a favor/);
  assert.match(app, /sin saldo a favor/);
});

test('al volver al Dashboard se fuerza el recálculo con todos los datos disponibles', () => {
  assert.match(app, /if \(id === 'dashboard'\)[\s\S]*?solicitarRenderDashboard\(true\)/);
});

test('Vigencia de precios muestra vigentes y desglosa pendientes sobre el mismo total', () => {
  assert.match(app, /var vigentesV3 = Math\.max\(0, Number\(resumenV3\.catalogProducts \|\| 0\) - requierenRevisionV3\)/);
  assert.match(app, /vigentesV3 \+ ' vigentes · ' \+ requierenRevisionV3 \+ ' requieren revisión · ' \+ resumenV3\.catalogProducts \+ ' total'/);
});
