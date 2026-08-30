const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const match = index.match(/src="\.\/js\/core\/(version\.v[0-9.]+\.js)"/);

test('el marcador inmutable publicado completa todos los rótulos de versión', () => {
  assert.ok(match, 'index.html debe cargar un marcador inmutable');
  const source = fs.readFileSync('js/core/' + match[1], 'utf8');
  assert.match(source, /function aplicarVersionSisVentas/);
  for (const id of ['loading-version', 'login-version-lbl', 'up-version', 's-version-el']) {
    assert.match(source, new RegExp(id));
  }
  assert.match(source, /DOMContentLoaded/);
});
