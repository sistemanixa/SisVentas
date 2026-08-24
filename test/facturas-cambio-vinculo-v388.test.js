const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('las notas conciliadas siguen visibles y permiten cambiar el vínculo', () => {
  assert.match(app, /estados\.map\(function\(x\)/);
  assert.match(app, /Cambiar vínculo/);
  assert.match(app, /fvAbrirVinculacionManual/);
});

test('cambiar el vínculo actualiza venta anterior, nueva y comprobante atómicamente', () => {
  const inicio = app.indexOf('async function fvAplicarConciliacion');
  const fin = app.indexOf('async function fvConciliarNotaPorKey', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /var cambios = \{\}/);
  assert.match(cuerpo, /cambios\[baseAnterior \+ 'notaCredito'\] = null/);
  assert.match(cuerpo, /cambios\[baseNueva \+ 'notaCredito'\] = nota/);
  assert.match(cuerpo, /await window\.fbUpdate\(window\.fbRef\(window\.fbDB\), cambios\)/);
  assert.match(cuerpo, /Vinculación de nota de crédito corregida/);
  assert.match(cuerpo, /cambios\[baseNueva \+ 'facturaAnulada'\] = true/);
  assert.doesNotMatch(cuerpo, /cambios\[baseNueva \+ 'anulada'\]/);
  assert.doesNotMatch(cuerpo, /cambios\[baseNueva \+ 'estadoPago'\]/);
});

test('la nota fiscal activa no convierte la venta comercial en anulada', () => {
  const helperInicio = app.indexOf('function ventaTieneNotaCreditoActiva');
  const helperFin = app.indexOf('function ventaEstaAnulada', helperInicio);
  const anuladaFin = app.indexOf('\n}', helperFin) + 2;
  assert.doesNotMatch(app.slice(helperInicio, helperFin), /venta\.anulada/);
  assert.doesNotMatch(app.slice(helperFin, anuladaFin), /ventaTieneNotaCreditoActiva/);
  assert.match(app, /Factura anulada externamente/);
});

test('la reparación manual solo alcanza conciliaciones externas alteradas por el código anterior', () => {
  const inicio = app.indexOf('async function fvRepararEstadosComercialesConciliacionExterna');
  const fin = app.indexOf('async function fvConciliarNotasCredito', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /nota\.origen === 'conciliacion_externa'/);
  assert.match(cuerpo, /venta\.facturaAnulada !== true/);
  assert.match(cuerpo, /venta\.estadoPagoAnteriorConciliacion \|\| estadoCalculado/);
  assert.match(cuerpo, /cambios\[base \+ 'facturaAnulada'\] = true/);
  assert.match(cuerpo, /cambios\[base \+ 'estadoPago'\] = estadoRestaurado/);
  assert.match(cuerpo, /se separó la anulación fiscal del estado comercial/);
});

test('una nota más reciente puede reemplazar la nota ya vinculada a la misma venta', () => {
  assert.match(app, /var reemplazaNotaDestino = ventaTieneNotaCreditoActiva\(venta\)/);
  assert.match(app, /cambios\[baseComprobanteAnterior \+ 'ventaConciliadaFbKey'\] = null/);
  assert.match(app, /Se desvinculará la nota anterior y se reemplazará por la nota seleccionada/);
  assert.match(app, /Nota de crédito reemplazada:/);
  assert.match(app, /REEMPLAZARÁ NOTA ACTUAL/);
});

test('la venta es interactiva y abre una ventana informativa', () => {
  assert.match(app, /function fvAbrirDetalleVentaModal/);
  assert.match(app, /Información para verificar la vinculación fiscal/);
  assert.match(app, /Ver información de la venta/);
  assert.match(app, /Abrir ficha completa/);
});
