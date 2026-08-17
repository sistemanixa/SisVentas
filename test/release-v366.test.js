const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.366 toma el CUIT normalizado que devuelve el servidor fiscal', () => {
  const app = read('js/app.v2.0.366.js');
  const server = read('cloud-functions/emitir-factura/index.js');
  assert.match(server, /clienteFiscal:/);
  assert.match(app, /resultado\.clienteFiscal/);
});
