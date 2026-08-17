const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.364 refresca una copia fiscal A sin CUIT antes de emitir una NC', () => {
  const app = read('js/app.v2.0.364.js');
  assert.match(app, /cuitExistente\.length === 11/);
  assert.match(app, /ARCA no devolvió un CUIT válido del cliente/);
  assert.match(app, /version: 'v2\.0\.364'/);
});
