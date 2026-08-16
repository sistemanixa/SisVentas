const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.349.js'), 'utf8');
const appBase = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const cotizador = fs.readFileSync(path.join(root, 'cotizador', 'index.js'), 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio + desde.length);
  assert.ok(inicio >= 0, `falta ${desde}`);
  assert.ok(fin > inicio, `falta el cierre ${hasta}`);
  return app.slice(inicio, fin);
}

test('la confirmación humana aplica el precio ya leído sin consultar otra vez Mercado Libre', () => {
  const confirmacion = bloque(
    'async function confirmarIdentidadMercadoLibreActualizador',
    'async function guardarUrlFallidoActualizador'
  );
  assert.match(confirmacion, /resultadoManualMercadoLibreActualizador\(fallo\)/);
  assert.doesNotMatch(confirmacion, /\bfetch\s*\(/);
  assert.match(confirmacion, /guardarCandidatosSegurosActualizador\(\[candidato\]\)/);
  assert.match(confirmacion, /_actualizadorSesionPrecios\.fallos\s*=/);
  assert.match(confirmacion, /_actualizadosAutomaticos/);
});

test('el resultado confirmado conserva evidencia, moneda e identidad manual', () => {
  const resultado = bloque(
    'function resultadoManualMercadoLibreActualizador',
    'async function confirmarIdentidadMercadoLibreActualizador'
  );
  assert.match(resultado, /precioCandidatoArs/);
  assert.match(resultado, /moneda:'ARS'/);
  assert.match(resultado, /selectorPrecio/);
  assert.match(resultado, /manual:true/);
  assert.match(resultado, /confirmacionHumanaCompleta:true/);
  assert.match(resultado, /mercado_libre_identidad_confirmada_usuario/);
});

test('el título abre la ficha interna y la publicación conserva su botón exclusivo', () => {
  const render = bloque('function actualizadorHtmlFallos', 'function mostrarVistaPreviaActualizador');
  assert.match(render, /abrirProductoDesdeFalloActualizador/);
  assert.match(render, /> Abrir publicación<\/a>/);
  assert.doesNotMatch(render, /title="Abrir producto en el proveedor"/);
});

test('la confirmación humana queda ligada a la URL y se reutiliza en futuros lotes', () => {
  const actualizacion = bloque('function datosActualizadosProductoBiosegur', 'function validarResultadoActualizadorProveedor');
  const lote = bloque('async function ejecutarActualizadorMasivoBiosegur', 'function asegurarMargenProductoDefaultEnForm');
  assert.match(actualizacion, /identidadConfirmadaUrl\s*=\s*String\(item\.url/);
  assert.match(actualizacion, /variacionAprobadaPor\s*=\s*currentUser/);
  assert.match(lote, /confirmarIdentidadManual:identidadMercadoLibreConfirmadaParaUrl\(x\.proveedor, x\.url\)/);
  assert.match(app, /urlsProveedorEquivalentes\(urlConfirmada, url\)/);
  assert.match(cotizador, /item\.confirmarIdentidadManual === true/);
  assert.match(cotizador, /metodo:'confirmacion_manual_guardada'/);
});

test('cambiar la URL borra la confirmación anterior', () => {
  const cambioUrl = bloque('async function guardarUrlFallidoActualizador', 'async function eliminarProductoFallidoActualizador');
  assert.match(cambioUrl, /identidadConfirmadaManualmente:null/);
  assert.match(cambioUrl, /identidadConfirmadaUrl:null/);
});

test('la aplicación activa y su espejo permanecen idénticos', () => {
  assert.equal(app, appBase);
});
