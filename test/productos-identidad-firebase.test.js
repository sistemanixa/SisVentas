const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v3.6.19.js', 'utf8');
const start = source.indexOf('function normalizarProductosFirebase(data)');
const end = source.indexOf('\nfunction fbCargarProductos()', start);
const scope = {};
vm.createContext(scope);
vm.runInContext(source.slice(start, end), scope);

test('una clave push con dígitos 1 y 3 no oculta al producto P-13', () => {
  const productos = scope.normalizarProductosFirebase({
    '-P1cKLXKbn_upl3RnNYz': { codigo: 'P-62920', nombre: 'Cerradura' },
    'P-13': { codigo: 'P-13', nombre: 'Instalación de cámara', activo: true }
  });
  assert.equal(productos.length, 2);
  assert.deepEqual(Array.from(productos, p => p.codigo).sort(), ['P-13', 'P-62920']);
});

test('una clave push sin números tampoco oculta al producto', () => {
  const productos = scope.normalizarProductosFirebase({
    '-OyJLgAGOOrWvZSdFDRY': { codigo: 'P-2223', nombre: 'Pilas' }
  });
  assert.equal(productos.length, 1);
  assert.equal(productos[0].codigo, 'P-2223');
});

test('un duplicado con el mismo código prefiere la entrada prod_', () => {
  const productos = scope.normalizarProductosFirebase({
    'P-13': { codigo: 'P-13', nombre: 'Anterior' },
    'prod_13': { codigo: 'P-13', nombre: 'Vigente' }
  });
  assert.equal(productos.length, 1);
  assert.equal(productos[0].nombre, 'Vigente');
});
