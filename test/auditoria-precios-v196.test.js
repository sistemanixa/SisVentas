const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('la auditoría integral de precios fue retirada de la interfaz y del motor', () => {
  assert.doesNotMatch(app, /function abrirAuditoriaIntegridadPrecios\(/);
  assert.doesNotMatch(app, /function detectarCasosIntegridadPrecios\(/);
  assert.doesNotMatch(index, /Auditar precios|Auditar catálogo/);
});

test('el actualizador de proveedores y la normalización manual siguen disponibles', () => {
  assert.match(app, /function normalizarTodosProductosARS\(/);
  assert.match(app, /function abrirActualizadorMasivoPrecios\(/);
});
