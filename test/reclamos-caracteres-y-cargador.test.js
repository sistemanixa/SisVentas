const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v2.0.327.js', 'utf8');

function cargarNormalizador() {
  const inicio = app.indexOf('function spTextoHistorialLegible');
  const fin = app.indexOf('\n\nasync function spGuardarNuevo', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const contexto = {};
  vm.runInNewContext(app.slice(inicio, fin), contexto);
  return contexto.spTextoHistorialLegible;
}

test('el historial repara solo palabras legacy inequivocas', () => {
  const normalizar = cargarNormalizador();
  assert.equal(
    normalizar('Derivado a visita t\uFFFDcnica; iniciando generaci\uFFFDn de OT'),
    'Derivado a visita técnica; iniciando generación de OT'
  );
  assert.equal(
    normalizar('V\uFFFDnculos OT/venta legacy. Queda pendiente una OT v\uFFFDlida.'),
    'Vínculos OT/venta legacy. Queda pendiente una OT válida.'
  );
  assert.equal(normalizar('Ya se borr\uFFFD la pantalla'), 'Ya se borró la pantalla');
  assert.equal(normalizar('Comentario libre sin cambios'), 'Comentario libre sin cambios');
});

test('las dos vistas del historial usan el texto reparado', () => {
  const usos = app.match(/escapeHTML\(spTextoHistorialLegible\(h\.texto\|\|''\)\)/g) || [];
  assert.equal(usos.length, 2);
});
