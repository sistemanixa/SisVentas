const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'modules', 'maintenance-center.js'),
  'utf8'
);

test('el diagnóstico actual conserva acentos y explica su alcance', () => {
  assert.match(source, /Diagnóstico de sesión/);
  assert.match(source, /Conexión:/);
  assert.match(source, /Versión:/);
  assert.match(source, /No comprueba saldos ni la integridad completa de la base/);
  assert.doesNotMatch(source, /diagn\?stico|Sesi\?n|Conexi\?n|Versi\?n/);
});
