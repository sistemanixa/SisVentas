const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('el actualizador masivo permite aprobar una variación excepcional con auditoría', () => {
  assert.match(app, /async function aprobarVariacionPrecioActualizador/);
  assert.match(app, /Aprobar nuevo precio/);
  assert.match(app, /confirmacionHumanaCompleta:true/);
  assert.match(app, /aprobarVariacionManual:true/);
  assert.match(app, /variacion-aprobada-manualmente-actualizador/);
  assert.match(app, /resultadoCotizador:resultado \|\| null/);
});

test('la cotización individual permite corregir el nombre y vuelve a verificar', () => {
  assert.match(app, /async function cambiarNombreProductoCotizacionIndividual/);
  assert.match(app, /Cambiar nombre y volver a verificar/);
  assert.match(app, /await cotizarPreciosProveedores\(\)/);
  assert.match(app, /actualizadorNombreProveedorDistinto\(contextoCotizacion/);
});

test('ambos recorridos mantienen la protección y exigen decisión humana', () => {
  assert.match(app, /Solo el administrador puede aprobar una variación excepcional de precio/g);
  assert.match(app, /if \(!await svConfirm\(confirmar\)\) return/);
  assert.match(app, /requiereConfirmacionIdentidad/);
});
