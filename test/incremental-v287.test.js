const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.287.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const treasury = fs.readFileSync(path.join(root, 'js', 'modules', 'treasury.js'), 'utf8');

test('la publicacion v2.0.287 usa referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.287\.js/);
  assert.match(index, /version\.v2\.0\.287\.js/);
  assert.match(worker, /sisventas-v2\.0\.287/);
});

test('los pagos permiten editar y anular conservando auditoria', () => {
  assert.match(app, /function abrirEditarPagoGasto/);
  assert.match(app, /function guardarEdicionPagoGasto/);
  assert.match(app, /function anularPagoGasto/);
  assert.match(app, /sisventas\/auditoria_pagos/);
  assert.match(app, /motivoAnulacion/);
});

test('un pago anulado deja de sumar en gastos, cuenta empleado y tesoreria', () => {
  assert.match(app, /pagoGastoEstaAnulado\(p\) \? 0/);
  assert.match(app, /if \(pagoGastoEstaAnulado\(p\)\) return/);
  assert.match(treasury, /pago\.anulado===true/);
});

test('la correccion sincroniza el pago relacionado de la cuenta del empleado', () => {
  assert.match(app, /var baseMov = 'sisventas\/ctaemp\/'/);
  assert.match(app, /baseMov \+ '\/pagos\/' \+ token/);
  assert.match(app, /baseMov \+ '\/montoPagado'/);
  assert.match(app, /La suma de pagos no puede superar el total del gasto/);
});
