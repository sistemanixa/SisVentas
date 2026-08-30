const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'app.v3.0.9.js'), 'utf8');

test('cerrar la edición manual vuelve directamente a la revisión conservada', () => {
  assert.match(app, /_prodRevisionRetorno\s*&&\s*\(_prodDetalleOrigenAntesForm\s*===\s*'revision-precios'/);
  assert.match(app, /_revisionPreciosEstadoPendiente\s*=\s*retornoRevision;[\s\S]*?abrirGestionRevisionPrecios\(\);/);
});

test('la revisión permite eliminar con el control seguro existente', () => {
  assert.match(app, /async function eliminarProductoDesdeRevisionPrecios\(fbKey\)/);
  assert.match(app, /await eliminarProductoPorId\(String\(fbKey \|\| ''\), false\)/);
  assert.match(app, /currentRole[\s\S]*?=== 'admin'[\s\S]*?eliminarProductoDesdeRevisionPrecios/);
});

test('el producto eliminado desaparece inmediatamente de la copia local y las grillas', () => {
  assert.match(app, /await window\.fbRemove[\s\S]*?delete prodData\[claveProd\]/);
  assert.match(app, /renderTablaProductos\(busquedaProductos\)/);
  assert.match(app, /actualizarStatProductos\(\)/);
});
