const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function functionBody(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `No se encontró ${name}`);
  assert.notEqual(end, -1, `No se encontró el límite ${nextName}`);
  return app.slice(start, end);
}

test('la aprobación mantiene venta y agrega la comparación completa de compra', () => {
  assert.match(app, /P\. venta/);
  assert.match(app, /P\. compra/);
  assert.match(app, /Compra total/);
  assert.match(app, /Ganancia/);
  assert.match(app, /Subtotal venta/);
  assert.match(app, /Comparar compra \/ venta/);
});

test('la vista previa está disponible en detalle y durante la revisión', () => {
  assert.match(app, /revision:\s*\['imprimir','aprobar','rechazar'\]/);
  assert.match(app, /Vista previa \/ imprimir/);
  assert.match(index, /Vista previa \/ imprimir/);
});

test('los ítems conservan identidad e imagen al guardarse y reabrirse', () => {
  const normalizer = functionBody('pptoNormalizarItemGuardado', 'pptoDatosParaVenta');
  assert.match(normalizer, /productoFbKey/);
  assert.match(normalizer, /imagenUrl/);
  assert.match(app, /item\.imagenUrl/);
});

test('la vista previa incorpora miniaturas y no imprime sin decisión del usuario', () => {
  const print = functionBody('imprimirPresupuesto', 'asegurarOTVentaConPago');
  assert.match(print, /fotoImpresion/);
  assert.match(print, /opciones\.imprimirAutomaticamente === true/);
  assert.doesNotMatch(print, /document\.close\(\);\s*setTimeout\(function\(\)\{ w\.print\(\); \}, 600\)/);
});
