const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v3.3.12.js', 'utf8');

test('el reporte permite abrir el detalle que compone cada total', () => {
  assert.match(app, /function abrirDetalleReporteVentas\(tipo, claveCodificada\)/);
  assert.match(app, /abrirDetalleReporteVentas\(\\'empleado\\'/);
  assert.match(app, /abrirDetalleReporteVentas\(\\'producto\\'/);
  assert.match(app, /\['rep-total','todas'\]/);
  assert.match(app, /\['rep-cobrado','cobradas'\]/);
  assert.match(app, /\['rep-pendiente','pendientes'\]/);
});

test('cada venta del desglose abre su ficha real', () => {
  assert.match(app, /verVenta\(\\'' \+ ref \+ '\\'\)/);
  assert.match(app, /Venta<\/th><th>Fecha<\/th><th>Cliente<\/th><th>Responsable comercial<\/th>/);
});

test('el reporte no confunde al tecnico de una venta de soporte con el responsable comercial', () => {
  assert.match(app, /function ventaResponsableComercialReporte\(venta\)/);
  assert.match(app, /venta\.origen === 'reclamo'/);
  assert.match(app, /creada autom\[aá\]ticamente desde reclamo/);
  assert.match(app, /var e=ventaResponsableComercialReporte\(v\)/);
  assert.match(app, /tecnicoAsignado: tecnico/);
  assert.match(app, /creadaPor:\s+currentUser\|\|''/);
});

test('abrir una venta desde el reporte no escribe reparaciones ni auditorias', () => {
  assert.match(app, /ventaDetalleRepararVinculoOT\(venta, \{ soloLectura:true \}\)/);
  assert.match(app, /if \(opciones\.soloLectura\) \{\s*venta\.estadoInst = estadoInstalacion;\s*return ot;/);
});

test('todas las estadisticas de productos vendidos omiten mano de obra', () => {
  assert.match(app, /function itemVentaEsManoDeObraReporte\(item\)/);
  assert.match(app, /if\(itemVentaEsManoDeObraReporte\(it\)\)return;/);
  assert.match(app, /if\(itemVentaEsManoDeObraReporte\(item\)\)return;/);
  assert.match(app, /if \(itemVentaEsManoDeObraReporte\(item\)\) return false;/);
  assert.match(app, /importeProductos=listaProductos\.reduce/);
  assert.match(app, /importeProductos>0\?p\.importe\/importeProductos\*100/);
});
