const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.3.6.js', 'utf8');

test('el nombre publicado por cada proveedor no renombra el producto interno', () => {
  assert.match(app, /var puedeCambiarNombre = false/);
  assert.match(app, /var puedeCorregirNombreProducto = false/);
});

test('cada URL de proveedor requiere una única confirmación humana de identidad', () => {
  assert.match(app, /function identidadProveedorConfirmadaParaUrl\(proveedor, url\)/);
  assert.match(app, /!identidadProveedorConfirmadaParaUrl\(prodProveedoresActuales\[match\.idx\], urlRes \|\| match\.url\)/);
  assert.match(app, /requiereConfirmacionIdentidad = true;[\s\S]{0,100}precioCandidatoIdentidad = precio/);
});

test('la ficha espera la confirmación de Firebase antes de cerrarse', () => {
  assert.match(app, /return productoPersistirGuardar\(prod\)/);
  assert.match(app, /if \(await fbGuardarProducto\(datos\)\) cerrarFormProducto\(\)/);
});
