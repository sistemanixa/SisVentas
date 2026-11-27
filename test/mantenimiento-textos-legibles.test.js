const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'modules', 'maintenance-center.js'),
  'utf8'
);

test('el informe conserva acentos y declara el alcance de sus revisiones', () => {
  assert.match(source, /Informe de mantenimiento/);
  assert.match(source, /Conexión:/);
  assert.match(source, /Versión:/);
  assert.match(source, /No certifica saldos, contabilidad ni la ausencia de otros vínculos/);
  assert.doesNotMatch(source, /diagn\?stico|Sesi\?n|Conexi\?n|Versi\?n/);
});
