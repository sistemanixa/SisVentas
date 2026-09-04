const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.3.13.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

test('las ventas señadas muestran el saldo pendiente en la grilla', () => {
  assert.match(app, /function ventaEstadoBadgeConSaldo\(/);
  assert.match(app, /estado !== 'seniado'/);
  assert.match(app, /_svSaldoPendienteVenta\(venta\)/);
  assert.match(app, /Debe \$/);
  assert.match(app, /ventaEstadoBadgeConSaldo\(v, estadoPagoFila\)/);
});

test('el chat avisa periódicamente y sólo suena ante una llegada nueva', () => {
  assert.match(css, /chat-unread-attention 10s/);
  assert.match(app, /function chatDetectarMensajesNuevos\(/);
  assert.match(app, /if \(ultimoAnterior === undefined\) return \[\]/);
  assert.match(app, /chatReproducirSonidoNuevo\(\)/);
  assert.match(app, /document\.addEventListener\('pointerdown', chatPrepararSonido/);
});

test('tiempo de sistema identifica colores y conceptos sin abreviaturas', () => {
  assert.match(index, /Verde: tiempo activo/);
  assert.match(index, /Amarillo: sin interacción/);
  assert.match(app, /Activo ' \+ formatearDuracionUso/);
  assert.match(app, /Sin interacción ' \+ formatearDuracionUso/);
});
