const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('eliminar definitivamente exige rol admin en interfaz y función', () => {
  const inicio = app.indexOf('async function eliminarVenta');
  const fin = app.indexOf('async function anularVenta', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /currentRole[\s\S]*!== 'admin'/);
  assert.match(cuerpo, /Solo el administrador puede eliminar definitivamente una venta/);
  assert.match(app, /puedeEliminarVentaDetalle = rolVentaDetalle === 'admin'/);
  assert.match(app, /Eliminar definitivamente/);
});

test('Admin y Administrativo conservan la anulación comercial separada', () => {
  const inicio = app.indexOf('async function anularVenta');
  const fin = app.indexOf('function toggleMenuPpto', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /\['admin','administrativo'\]/);
  assert.match(cuerpo, /anulada: true/);
  assert.match(cuerpo, /estadoPago: 'anulada'/);
  assert.match(app, /puedeAnularVentaDetalle = \['admin','administrativo'\]/);
  assert.match(app, /Anular venta/);
});

test('una venta con CAE solo se elimina si tiene nota de crédito activa', () => {
  const inicio = app.indexOf('async function eliminarVenta');
  const fin = app.indexOf('async function anularVenta', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /v\.factura && v\.factura\.cae && !ventaTieneNotaCreditoActiva\(v\)/);
  assert.match(cuerpo, /Primero debe tener su nota de crédito/);
  assert.match(app, /puedeEliminarVentaDetalle = rolVentaDetalle === 'admin'[\s\S]*ventaTieneNotaCreditoActiva\(v\)/);
});

test('al eliminar una venta con NC externa conserva el comprobante y limpia el vínculo', () => {
  const inicio = app.indexOf('async function eliminarVenta');
  const fin = app.indexOf('async function anularVenta', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /notaCredito\.origen === 'conciliacion_externa'/);
  assert.match(cuerpo, /ventaConciliadaFbKey: null/);
  assert.match(cuerpo, /ventaEliminadaId: v\.id/);
  assert.match(cuerpo, /La factura y su nota de crédito seguirán visibles en el historial fiscal/);
});
