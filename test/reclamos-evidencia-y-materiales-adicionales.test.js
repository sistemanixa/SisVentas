const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'js', 'app.v2.0.321.js'), 'utf8');

test('un reclamo nuevo exige evidencia y la muestra a quien lo atiende', () => {
  assert.match(html, /id="sp-nuevo-evidencia"/);
  assert.match(html, /Evidencia de la falla/);
  assert.match(html, /id="sp-modal-evidencia"/);
  assert.match(app, /function spPrepararEvidenciaNueva/);
  assert.match(app, /function spSubirEvidenciaNueva/);
  assert.match(app, /evidenciaUrl: evidencia\.url/);
  assert.match(app, /lector\.readAsDataURL\(archivo\)/);
  assert.match(app, /adjunto_base64/);
  assert.doesNotMatch(app.slice(app.indexOf('function spSubirEvidenciaNueva'), app.indexOf('async function spGuardarNuevo')), /fbUploadBytes/);
});

test('los productos agregados en OT quedan como adicionales y no crean ventas', () => {
  assert.match(html, /Productos adicionales/);
  assert.match(html, /otConfirmarProductosAdicionales\(\)/);
  assert.match(app, /async function otConfirmarProductosAdicionales/);
  assert.match(app, /adicionalOT:true/);
  assert.match(app, /sin generar venta/);
  assert.match(app, /function otRenderProductosAdicionales/);
});

test('solo el administrador puede eliminar un reclamo sin romper su OT vinculada', () => {
  assert.match(app, /async function spEliminarReclamo/);
  assert.match(app, /Solo un administrador puede eliminar reclamos/);
  assert.match(app, /reclamoKey:null, reclamoId:null, reclamoFbKey:null/);
  assert.match(app, /sisventas\/reclamos\//);
  assert.match(app, /id="sp-modal-eliminar"/);
});

test('los mensajes activos de soporte conservan correctamente tildes y símbolos', () => {
  const inicio = app.indexOf('function spPasarAVisitaYGenerarOT');
  const fin = app.indexOf('// ── AGENDA', inicio);
  const soporte = app.slice(inicio, fin > inicio ? fin : undefined);
  assert.match(soporte, /Ya se está generando la OT/);
  assert.match(soporte, /Elegí el técnico asignado/);
  assert.match(soporte, /✓ Venta y OT generadas\. Técnico:/);
  assert.doesNotMatch(soporte, /Ã|Â|âœ/);
});
