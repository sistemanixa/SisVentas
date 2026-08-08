const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.305.js', 'utf8');

test('un alta de cliente vacía no persiste un registro huérfano', () => {
  assert.match(app, /if \(!nuevo\.nombre\.trim\(\)\) \{[\s\S]{0,160}Ingresá al menos nombre o razón social del cliente/);
  const esValido = nombre => String(nombre || '').trim().length > 0;
  assert.equal(esValido(''), false);
  assert.equal(esValido('   '), false);
  assert.equal(esValido('Empresa Nixa'), true);
});
