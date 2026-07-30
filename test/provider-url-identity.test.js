const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'app.js'), 'utf8');

test('los códigos numéricos sólo se convierten para Tecnoprices', () => {
  assert.match(app, /function normalizarUrlProveedorProducto\(url, nombreProveedor\)/);
  assert.match(app, /\/\^\\d\+\$\/\.test\(u\) && esProveedorTecnoprices\(nombreProveedor\)/);
  assert.doesNotMatch(app, /if \(\/\^\\d\+\$\/\.test\(u\)\) return 'https:\/\/www\.tecnoprices\.com\/' \+ u/);
});

test('la auditoría detecta un dominio incompatible con el proveedor', () => {
  assert.match(app, /la URL pertenece a otro proveedor/);
  assert.match(app, /tiene un código numérico, pero falta una URL verificable del proveedor/);
});

test('la revisión exige una URL completa para proveedores no Tecnoprices', () => {
  assert.match(app, /normalizarUrlProveedorProducto\(input \? input\.value : '', proveedores\[proveedorIdx\]\.nombre/);
  assert.match(app, /Ingresá la URL exacta del producto/);
});
