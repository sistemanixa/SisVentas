const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v3.7.5.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio);
  assert.ok(inicio >= 0 && fin > inicio, `No se encontró ${desde}`);
  return app.slice(inicio, fin);
}

test('muestra el precio USD original publicado separado del costo ARS', () => {
  assert.match(html, /Precio publicado USD/);
  assert.match(html, /Costo real ARS/);
  const codigo = bloque('function valorPublicadoUsdProveedor', 'function proveedorVisibleEnProducto');
  const contexto = {};
  vm.runInNewContext(`${codigo}; resultado = valorPublicadoUsdProveedor({precioOriginal:32,monedaOriginal:'USD'});`, contexto);
  assert.equal(contexto.resultado, 32);
  vm.runInNewContext(`${codigo}; resultadoLocal = valorPublicadoUsdProveedor({precioOriginal:48960,monedaOriginal:'ARS'});`, contexto);
  assert.equal(contexto.resultadoLocal, 0);
});

test('actualizar desde la ficha valida y guarda automáticamente sin abrir el editor', () => {
  const funcion = bloque('async function actualizarProveedoresDesdeFicha', 'var _proveedoresEnFicha');
  assert.match(funcion, /productosBiosegurActualizables\(\)/);
  assert.match(funcion, /validarResultadoActualizadorProveedor/);
  assert.match(funcion, /guardarCandidatosSegurosActualizador\(candidatos\)/);
  assert.match(funcion, /registrarVariacionPendienteActualizador/);
  assert.match(funcion, /guardarán automáticamente/);
  assert.doesNotMatch(funcion, /abrirProveedoresEnFicha/);
  assert.doesNotMatch(funcion, /guardarProducto\(/);
});

test('la interfaz identifica si actualiza uno o todos y bloquea guardar durante la consulta', () => {
  assert.match(html, /id="btn-pd-actualizar-proveedores"[^>]*>[^<]*<i[^>]*><\/i> Actualizar todos/);
  assert.match(app, /data-provider-index=/);
  assert.match(app, /Actualizando ' \+ items\.length \+ ' proveedor/);
  assert.match(app, /actualizarBloqueoControlesCotizacionProducto\(true/);
  assert.match(app, /Esperando actualización/);
  assert.match(app, /if \(_cotizacionProductoActiva\) \{ notify\('Esperá que termine la actualización de precios antes de guardar'/);
});

test('la persistencia conserva precio y moneda originales aunque no llegue el objeto conversion', () => {
  const funcion = bloque('function datosActualizadosProductoBiosegur', 'function validarResultadoActualizadorProveedor');
  assert.match(funcion, /resultado\.precioOriginal != null/);
  assert.match(funcion, /pv\.monedaOriginal = String\(resultado\.monedaOriginal\)\.toUpperCase\(\)/);
  assert.match(funcion, /if \(resultado\.conversion\) pv\.conversion = resultado\.conversion/);
});
