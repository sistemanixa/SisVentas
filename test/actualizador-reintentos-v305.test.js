const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'app.v3.0.5.js'), 'utf8');

test('el actualizador reintenta fallas transitorias sin avanzar el bloque', () => {
  assert.match(app, /async function solicitarLoteCotizadorConReintentos/);
  assert.match(app, /var demoras = \[2000, 5000, 10000\]/);
  assert.match(app, /\[401, 429, 500, 502, 503, 504\]/);
  assert.match(app, /solicitarLoteCotizadorConReintentos\(\{/);
  assert.match(app, /Recuperando el mismo bloque/);
});

test('un reintento por sesión vencida fuerza la renovación del token', () => {
  assert.match(app, /getIdToken\(forzarRenovacion === true\)/);
  assert.match(app, /ultimoError\.status === 401/);
});
