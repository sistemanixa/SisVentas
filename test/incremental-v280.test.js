const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.280.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function cargarDetectoresObsolescencia() {
  const inicio = app.indexOf('function timestampEstadoPrecioProveedor');
  const fin = app.indexOf('function variacionPrecioPendienteProducto', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'no se encontraron los detectores de propuestas obsoletas');
  const contexto = {
    parsePrecioProveedorARS(valor) { return Number(valor) || 0; }
  };
  vm.runInNewContext(
    app.slice(inicio, fin) + '\nthis.esObsoleta = variacionPrecioPendienteEsObsoleta;',
    contexto
  );
  return contexto.esObsoleta;
}

test('la publicación v2.0.280 mantiene referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.280\.js/);
  assert.match(index, /version\.v2\.0\.280\.js/);
  assert.match(worker, /sisventas-v2\.0\.280/);
});

test('descarta la propuesta antigua causada por el separador de miles de Tecnoprices', () => {
  const esObsoleta = cargarDetectoresObsolescencia();
  assert.equal(esObsoleta(
    { precioArsPublicado:33023.93, actualizadoEn:100 },
    { precioCandidatoArs:33.02, detectadaEn:200 }
  ), true);
});

test('descarta propuestas anteriores a una actualización válida y conserva las realmente pendientes', () => {
  const esObsoleta = cargarDetectoresObsolescencia();
  assert.equal(esObsoleta(
    { precioArsPublicado:33023.93, actualizadoEn:300 },
    { precioCandidatoArs:38000, detectadaEn:200 }
  ), true);
  assert.equal(esObsoleta(
    { precioArsPublicado:33023.93, actualizadoEn:100 },
    { precioCandidatoArs:38000, detectadaEn:200 }
  ), false);
});

test('una actualización válida limpia el bloqueo y una bloqueada nunca se aplica', () => {
  assert.match(app, /pv\.variacionPendienteAprobacion = null;/);
  assert.match(app, /var aceptado = !!\(match && precio > 0 && !requiereAprobacion\);/);
  assert.match(app, /disponibilidadActualizadaEn: Date\.now\(\),\s*variacionPendienteAprobacion: null,/);
  assert.match(app, /function limpiarVariacionesPrecioObsoletas\(\)/);
  assert.match(app, /cambiosProducto\['proveedores\/\s*' \+ proveedorIdx \+ '\/variacionPendienteAprobacion'\] = null;/);
});
