const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('todo rechazo de presupuesto exige un motivo no vacío', () => {
  const inicio = app.indexOf('async function pptoAccion');
  const fin = app.indexOf('function _redondearPrecioActual', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(cuerpo, /accion === 'rechazar' \|\| accion === 'marcar_rechazado'/);
  assert.match(cuerpo, /await svPrompt\('Ingresá el motivo del rechazo/);
  assert.match(cuerpo, /if \(respuestaMotivo === null\) return/);
  assert.match(cuerpo, /if \(!motivoRechazo\).*El motivo del rechazo es obligatorio/);
});

test('el motivo se persiste y queda incluido en la auditoría', () => {
  assert.match(app, /actualizacionEstadoPpto\.motivoRechazo = p\.motivoRechazo/);
  assert.match(app, /actualizacionEstadoPpto\.rechazadoPor = p\.rechazadoPor/);
  assert.match(app, /motivo: esRechazoPpto \? motivoRechazo : ''/);
});

test('el detalle muestra el motivo o identifica presupuestos históricos', () => {
  assert.match(html, /id="ppto-alerta-rechazo"/);
  assert.match(html, /id="ppto-motivo-rechazo"/);
  assert.match(app, /p\.motivoRechazo \|\| 'Sin motivo registrado \(presupuesto histórico\)'/);
  assert.match(app, /Motivo: \$\{escapeHTML\(e\.motivo\)\}/);
});
