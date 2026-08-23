const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  assert.ok(inicio >= 0, `falta ${desde}`);
  assert.ok(fin > inicio, `falta el cierre ${hasta}`);
  return app.slice(inicio, fin);
}

test('guardar una URL pendiente vuelve a consultar y conserva el fallo hasta resolverlo', () => {
  const guardar = bloque('async function guardarUrlFallidoActualizador', 'async function eliminarProductoFallidoActualizador');
  assert.match(guardar, /fallo\.item\.url = url/);
  assert.match(guardar, /reintentarProductoConNombreCorregidoActualizador\(fbKey, proveedorIdx, 'url'\)/);
  assert.doesNotMatch(guardar, /Quedará pendiente para el próximo intento/);
});

test('una nueva URL válida guarda el precio y quita sólo ese proveedor de pendientes', () => {
  const reintento = bloque('async function reintentarProductoConNombreCorregidoActualizador', 'function resultadoManualMercadoLibreActualizador');
  assert.match(reintento, /guardarCandidatosSegurosActualizador\(\[candidato\]\)/);
  assert.match(reintento, /f\.proveedorIdx/);
  assert.match(reintento, /URL verificada y precio actualizado/);
  assert.match(reintento, /falloSiguePendiente/);
});

test('Ir al proveedor abre el editor y selecciona la URL completa', () => {
  const editor = bloque('function editarProductoFallidoActualizador', 'function abrirProductoDesdeFalloActualizador');
  const render = bloque('function actualizadorHtmlFallos', 'function mostrarVistaPreviaActualizador');
  assert.match(editor, /input\.focus\(\); input\.select\(\)/);
  assert.match(render, /onclick="editarProductoFallidoActualizador\([^\n]+,true\)"/);
  assert.match(render, /> Ir al proveedor<\/a>/);
});
