const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('la identidad del proveedor determina cómo se interpreta un código numérico', () => {
  assert.match(app, /function normalizarUrlProveedorProducto\(url, nombreProveedor\)/);
  assert.match(app, /esProveedorTecnoprices\(nombreProveedor\)/);
  assert.match(app, /la URL pertenece a otro proveedor/);
});

test('la publicación corresponde a v2.0.241', () => {
  assert.match(app, /VERSION: 'v2\.0\.241-firebase'/);
  assert.match(index, /app\.v2\.0\.241\.js/);
  assert.match(index, /version\.v2\.0\.241\.js/);
  assert.match(sw, /sisventas-v2\.0\.241/);
});
