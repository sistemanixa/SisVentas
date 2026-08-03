const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.278.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const cotizador = fs.readFileSync(path.join(root, 'cotizador', 'index.js'), 'utf8');

test('la publicación v2.0.278 mantiene referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.278\.js/);
  assert.match(index, /version\.v2\.0\.278\.js/);
  assert.match(worker, /sisventas-v2\.0\.278/);
});

test('el actualizador muestra carga antes de procesar y limita el resumen inicial', () => {
  assert.match(index, /id="mod-ap-loading"/);
  assert.match(app, /requestAnimationFrame\(function\(\)/);
  assert.match(app, /pendientesRevisionTodos\.slice\(0, 15\)/);
  assert.match(app, /abrirProductosSinVentaActualizador/);
});

test('Mercado Libre toma el precio principal visible y deja trazabilidad', () => {
  assert.match(cotizador, /ui-pdp-price__main-container/);
  assert.match(cotizador, /candidato\.isVisible/);
  assert.match(cotizador, /selectorPrecio:datos\.selectorPrecio/);
});
