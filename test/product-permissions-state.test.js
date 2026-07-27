const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const permisos = fs.readFileSync(path.join(root, 'js', 'modules', 'action-permissions.js'), 'utf8');

test('administrativo con acceso al módulo puede eliminar productos desde cualquier vista', () => {
  assert.match(permisos, /'productos\.eliminar':\s*\{ modulo:'productos', roles:\['admin','administrativo'\] \}/);
  assert.match(app, /window\.tienePermiso\('productos\.eliminar'/);
  assert.match(app, /async function eliminarProductoPorId\(pid, desdeDetalle\)/);
});

test('el regreso al catálogo conserva búsqueda, campo, categoría y filtro sin precio', () => {
  assert.match(app, /function capturarEstadoListaProductos\(\)/);
  assert.match(app, /busqueda: buscador \? buscador\.value : ''/);
  assert.match(app, /campo: campo \? campo\.value : 'todo'/);
  assert.match(app, /categoria: window\._prodCategoriaFiltro/);
  assert.match(app, /soloSinPrecio: !!_filtroProductosSinPrecio/);
  assert.match(app, /renderTablaProductos\(filtros\.busqueda \|\| ''\)/);
});
