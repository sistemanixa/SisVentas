const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.236.js'), 'utf8');

test('productos y proveedores consultan V3 mediante el puente reversible', () => {
  assert.match(source, /function productosProveedoresV3Invocar\(/);
  assert.match(source, /bridge\.invoke\('productosProveedores'/);
  assert.match(source, /productosProveedoresV3Invocar\('isLabor'/);
  assert.match(source, /productosProveedoresV3Invocar\('freshness'/);
  assert.match(source, /productosProveedoresV3Invocar\('summary'/);
  assert.match(source, /resumenV3\.reviewProducts/);
  assert.match(source, /productosProveedoresV3Invocar\('links'/);
});

test('las operaciones normales de productos y proveedores usan repositorios V3', () => {
  assert.match(source, /function productoPersistirGuardar\(/);
  assert.match(source, /function productoPersistirActualizar\(/);
  assert.match(source, /function productoPersistirEliminar\(/);
  assert.match(source, /function productosPersistirLote\(/);
  assert.match(source, /function proveedorPersistirGuardar\(/);
  assert.match(source, /function proveedorPersistirActualizar\(/);
  assert.match(source, /function proveedorPersistirEliminar\(/);
  assert.match(source, /function proveedoresPersistirLote\(/);
  assert.match(source, /proveedorPersistirGuardar\(registroProveedor\)/);
  assert.match(source, /coleccion === 'proveedores'\) \{\s*proveedorPersistirActualizar/);
  assert.match(source, /coleccion === 'proveedores'\s*\? proveedorPersistirEliminar/);
  assert.match(source, /proveedoresPersistirLote\(actualizaciones\)/);
});

test('la revisión de URL y el actualizador masivo conservan la persistencia V3', () => {
  assert.match(source, /productoPersistirActualizar\(fbKey, cambios\)/);
  assert.match(source, /productosPersistirLote\(productosEntradasDesdeMultipath\(cambios\)/);
});
