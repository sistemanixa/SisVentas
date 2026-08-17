const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.365 usa los 11 dígitos del documento fiscal aunque la API cambie su rótulo', () => {
  const app = read('js/app.js');
  assert.match(read('index.html'), /VERSION: 'v2\.0\.365-firebase'/);
  assert.match(app, /var cuitFiscal = String\(clienteFiscal\.documento_nro \|\| ''\)\.replace/);
  assert.match(app, /cuitExistente = existente && existente\.cliente/);
  assert.equal(read('js/app.v2.0.365.js'), app);
});
