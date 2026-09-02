const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.2.5.js', 'utf8');

test('la impresión local embebe imágenes antes de construir la ventana blob', () => {
  assert.match(app, /async function imprimirPresupuesto\(pptoRef, opciones\)/);
  assert.match(app, /async function imagenEmbebidaPresupuesto\(src\)/);
  assert.match(app, /lector\.readAsDataURL\(blobImagen\)/);
  assert.match(app, /await imagenEmbebidaPresupuesto/);
  assert.match(app, /await Promise\.all\(modelo\.items\.map/);
});

test('al volver al listado el render recupera los filtros visibles', () => {
  assert.match(app, /function renderPptoTabla\(filtroEstado, filtroTexto\)/);
  assert.match(app, /if \(filtroEstado === undefined\)/);
  assert.match(app, /if \(filtroTexto === undefined\) filtroTexto = \(document\.getElementById\('ppto-buscar'\)/);
});
