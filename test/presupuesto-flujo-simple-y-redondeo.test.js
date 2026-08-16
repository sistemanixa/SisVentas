const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const budget = require(path.join(root, 'js/v3/budget-read-model.js'));

test('el flujo visible evita visto y aceptación manuales', () => {
  assert.match(app, /enviado:\s*\['imprimir','marcar_rechazado','convertir_venta'\]/);
  assert.match(app, /visto:\s*\['imprimir','marcar_rechazado','convertir_venta'\]/);
  assert.match(app, /key === 'marcar_visto' \|\| key === 'marcar_aceptado'/);
  assert.match(app, /Cliente considerado visto y aceptado al convertir a venta/);
});

test('actualizar valores queda reservado a presupuestos vencidos', () => {
  assert.match(app, /function pptoEstaVencidoParaActualizar/);
  assert.match(app, /accion === 'modificar_precio'[\s\S]*?pptoEstaVencidoParaActualizar\(p\)/);
  assert.match(app, /cambios\.fecha = vigenciaNueva\.fecha/);
  assert.match(app, /cambios\.estado = 'aprobado_int'/);
});

test('un presupuesto histórico redondeado al peso puede convertirse', () => {
  const model = budget.build({
    id: 'PP-0056',
    conIva: false,
    descuento: 7,
    descuentoAmt: 85377,
    subtotal: 1219673,
    total: 1134296,
    items: [
      { cod: 'P-16402', qty: 1, punit: 746171, sub: 746171 },
      { cod: 'P-16', qty: 1, punit: 32002, sub: 32002 },
      { cod: 'P-20', qty: 2, punit: 97200, sub: 194400 },
      { cod: 'P-22', qty: 1, punit: 17600, sub: 17600 },
      { cod: 'P-51739', qty: 9, punit: 25500, sub: 229500 }
    ]
  });

  assert.equal(model.total, 1134295.89);
  assert.equal(model.ready, true);
  assert.deepEqual(model.conflicts, []);
});

test('el redondeo compatible no oculta diferencias comerciales reales', () => {
  const model = budget.build({
    conIva: false,
    descuento: 7,
    total: 1130000,
    items: [{ cod: 'P-1', qty: 1, punit: 1219673, sub: 1219673 }]
  });

  assert.equal(model.ready, false);
  assert.ok(model.conflicts.some((entry) => entry.kind === 'total-mismatch'));
});
