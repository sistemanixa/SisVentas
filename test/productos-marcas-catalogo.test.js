const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.2.5.js'), 'utf8');

test('la lista de marcas usa una única fuente de productos comerciales activos', () => {
  assert.match(app, /function obtenerMarcasProductosSistema\(\)/);
  assert.match(app, /p\.activo !== false[\s\S]*?p\.estado[\s\S]*?!esProductoManoDeObra\(p\)/);
  assert.equal((app.match(/var marcas(?:Disponibles)? = obtenerMarcasProductosSistema\(\);/g) || []).length, 2);
});
