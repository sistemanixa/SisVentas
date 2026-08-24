const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Facturas es un módulo separado y visible solo para admin y administrativo', () => {
  assert.match(html, /admin-o-administrativo[^>]+onclick="showPage\('facturas',this\)"/);
  assert.match(app, /\['admin','administrativo'\]\.includes\(String\(currentRole/);
  assert.match(html, /id="page-facturas"/);
  assert.match(html, />Facturas</);
  assert.match(html, />Comprobantes ARCA</);
});

test('Facturas aparece en Roles y migra configuraciones anteriores con reglas seguras', () => {
  assert.match(app, /PERMISOS_VERSION_ACTUAL = 4/);
  assert.match(app, /MODULOS_AGREGADOS_A_PERMISOS = \[[^\]]*'facturas'/);
  assert.match(app, /\{ id:'facturas',\s+label:'Facturas \(ventas facturadas y conciliación\)' \}/);
  assert.match(app, /vendedor:[\s\S]{0,350}'facturas'/);
  assert.match(app, /tecnico_vendedor:[\s\S]{0,350}'facturas'/);
  assert.match(app, /tecnico:[\s\S]{0,500}'facturas'/);
});

test('muestra todas las ventas facturadas y distingue anulaciones externas', () => {
  assert.match(html, /fv-ventas-facturadas-lista/);
  assert.match(app, /function fvRenderVentasFacturadas/);
  assert.match(app, /Factura anulada externamente/);
  assert.match(app, /abrirResumenFactura/);
  const cargaVentas = app.slice(app.indexOf('function procesarVentasSnapshot'), app.indexOf('function procesarVentasPendientesHistoricasSnapshot'));
  assert.match(cargaVentas, /fvRenderVentasFacturadas/);
  assert.match(cargaVentas, /fvRenderConciliacion/);
  assert.ok(html.indexOf('id="fv-ventas-facturadas-card"') < html.indexOf('id="fv-conciliacion-card"'), 'Las facturas deben aparecer antes que la conciliación');
});

test('la conciliación externa nunca llama al endpoint de emisión', () => {
  const inicio = app.indexOf('async function fvAplicarConciliacion');
  const fin = app.indexOf('async function fvConciliarNotaPorKey', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.ok(inicio > 0 && fin > inicio);
  assert.doesNotMatch(cuerpo, /fetch\s*\(|emitirFactura|ENDPOINT_FACTURACION/);
  assert.match(cuerpo, /origen:'conciliacion_externa'/);
  assert.match(cuerpo, /cambios\[baseNueva \+ 'facturaAnulada'\] = true/);
  assert.doesNotMatch(cuerpo, /cambios\[baseNueva \+ 'estadoPago'\]/);
  assert.match(cuerpo, /comprobantesVenta/);
});

test('solo se propone automáticamente una coincidencia fiscal única', () => {
  assert.match(app, /candidatas\.length === 1 \? 'lista'/);
  assert.match(app, /Math\.abs\(f\.importe - importeNC\) > 0\.02/);
  assert.match(app, /cuitNC !== f\.cuit/);
  assert.match(app, /fvAbrirVinculacionManual/);
});
