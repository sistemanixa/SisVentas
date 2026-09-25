const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readAppUnderTest() {
  const root = path.resolve(__dirname, '..');
  const entry = fs.existsSync(path.join(root, 'index-preview-ot.html')) ? 'index-preview-ot.html' : 'index.html';
  const index = fs.readFileSync(path.join(root, entry), 'utf8');
  const match = index.match(/<script src="\.\/js\/(app\.v[\d.]+\.js)(?:\?[^\"]*)?"/);
  assert.ok(match, entry + ' debe declarar una aplicación inmutable');
  return fs.readFileSync(path.join(root, 'js', match[1]), 'utf8');
}

test('el actualizador excluye proveedores que sólo admiten precios manuales', () => {
  const source = readAppUnderTest();
  const inicio = source.indexOf('function mostrarOtrosProveedoresActualizador(cont) {');
  const fin = source.indexOf('function resumenProductosProveedorRegistrado(proveedor) {', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const render = source.slice(inicio, fin);
  assert.match(render, /conexionAutomatica\.estado !== 'verificado'\) return/);
  assert.doesNotMatch(render, /Cargar precio manual|Requiere intervención/);
});
