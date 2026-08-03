const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.279.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const cotizador = fs.readFileSync(path.join(root, 'cotizador', 'index.js'), 'utf8');

test('la publicación v2.0.279 mantiene referencias coherentes', () => {
  assert.match(index, /app\.v2\.0\.279\.js/);
  assert.match(index, /version\.v2\.0\.279\.js/);
  assert.match(worker, /sisventas-v2\.0\.279/);
});

test('el estado de carga permanece legible sin bloquear el cálculo', () => {
  assert.match(app, /inicioCarga = Date\.now\(\)/);
  assert.match(app, /550 - \(Date\.now\(\) - \(inicioCarga/);
  assert.match(app, /pendientesRevisionTodos\.slice\(0, 15\)/);
});

test('Mercado Libre espera el contenido dinámico antes de leer el precio', () => {
  assert.match(cotizador, /selectoresPrecio\.join\(', '\)/);
  assert.match(cotizador, /timeout:12000/);
});
