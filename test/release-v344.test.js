const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.344 publica la confirmación definitiva del actualizador', () => {
  const index = read('index.html');
  const app = read('js/app.v2.0.344.js');
  const core = read('js/core/version.v2.0.344.js');
  assert.match(index, /VERSION: 'v2\.0\.344-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.344\.js/);
  assert.match(app, /VERSION: 'v2\.0\.344-firebase'/);
  assert.match(app, /version: 'v2\.0\.344'/);
  assert.match(app, /confirmacion_manual_guardada|identidadMercadoLibreConfirmadaParaUrl/);
  assert.equal(read('js/app.js'), app);
  assert.match(core, /SISVENTAS_PWA_VERSION = 'v2\.0\.344'/);
  assert.equal(read('js/core/version.js'), core);
  assert.match(read('sw.js'), /sisventas-v2\.0\.344/);
});
