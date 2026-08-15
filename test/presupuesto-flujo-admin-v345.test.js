const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.v2.0.345.js'), 'utf8');

test('Admin puede completar el flujo comercial de un presupuesto', () => {
  assert.match(app, /aprobado_int:\s*\['imprimir','enviar_cliente','modificar_precio'\]/);
  assert.match(app, /enviado:\s*\['imprimir','modificar_precio','marcar_visto','marcar_aceptado','marcar_rechazado','convertir_venta'\]/);
  assert.match(app, /visto:\s*\['imprimir','modificar_precio','marcar_aceptado','marcar_rechazado','convertir_venta'\]/);
  assert.match(app, /aceptado:\s*\['imprimir','convertir_venta'\]/);
  assert.match(app, /marcar_rechazado:\s*\{ nuevoEstado:'rechazado'/);
});

test('la aceptación conserva una única conversión atómica a venta', () => {
  assert.match(app, /if \(accion === 'marcar_aceptado'\)[\s\S]*?return pptoAccion\('convertir_venta'/);
  assert.match(app, /_convertirPresupuestoEnVentaAtomico/);
  assert.match(app, /ventaFbKeyDeterminista/);
});
