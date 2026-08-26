const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('vacaciones usa años y el formato visual único de fechas', () => {
  assert.match(app, /anios<1\?'< 1 año':anios\+' año'/);
  assert.match(app, /escapeHTML\(_mostrarFecha\(periEmp\[periEmp\.length-1\]\.desde\)\)/);
  assert.match(app, /escapeHTML\(_mostrarFecha\(p\.desde\)\)/);
  assert.match(app, /escapeHTML\(_mostrarFecha\(p\.hasta\)\)/);
});
