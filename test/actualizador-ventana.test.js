const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.317.js', 'utf8');

test('el actualizador contiene el desplazamiento dentro del cuerpo redimensionable', () => {
  const inicio = app.indexOf('function abrirActualizadorMasivoPrecios');
  const fin = app.indexOf('document.body.appendChild(overlay)', inicio);
  const modal = app.slice(inicio, fin);
  assert.match(modal, /id="actualizador-precios-panel"[^>]+overflow:hidden;resize:both/);
  assert.match(modal, /id="actualizador-precios-cuerpo"[^>]+flex:1 1 0;height:0;[^>]+overflow-y:auto;overflow-x:hidden/);
  assert.match(modal, /id="actualizador-precios-fallos"[^>]+flex:1 1 220px;min-height:180px;max-height:none;overflow:auto/);
});

test('las acciones quedan fijas fuera del cuerpo desplazable', () => {
  const inicio = app.indexOf('function abrirActualizadorMasivoPrecios');
  const fin = app.indexOf('document.body.appendChild(overlay)', inicio);
  const modal = app.slice(inicio, fin);
  const cuerpo = modal.indexOf('id="actualizador-precios-cuerpo"');
  const cierreCuerpo = modal.indexOf("'</div>' +", cuerpo);
  const acciones = modal.indexOf('id="actualizador-precios-acciones"');

  assert.ok(cuerpo >= 0);
  assert.ok(acciones > cierreCuerpo);
  assert.match(modal, /id="actualizador-precios-acciones"[^>]+flex:0 0 auto[^>]+border-top/);
});

test('restaurar desde la barra minimizada conserva el layout flex del panel', () => {
  const inicio = app.indexOf('function restaurarActualizadorMasivoPrecios');
  const fin = app.indexOf('function abrirDesdeBarraActualizadorMinimizado', inicio);
  const funcion = app.slice(inicio, fin);
  assert.match(funcion, /panel\.style\.display = 'flex';/);
  assert.doesNotMatch(funcion, /panel\.style\.display = '';/);
});

test('corregir un nombre recalcula los pendientes de la ventana abierta', () => {
  const inicio = app.indexOf('async function reintentarProductoConNombreCorregidoActualizador');
  const fin = app.indexOf('async function guardarUrlFallidoActualizador', inicio);
  const funcion = app.slice(inicio, fin);
  assert.match(funcion, /actualizadorRefrescarResumen\(modal\);/);
  assert.match(funcion, /mostrarVistaPreviaActualizador\(modal/);
});
