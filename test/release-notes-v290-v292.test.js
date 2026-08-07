const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.294.js', 'utf8');
const deploy = fs.readFileSync('scripts/actualizar-nodo-version.ps1', 'utf8');

test('Novedades contiene las versiones publicadas desde v2.0.289', () => {
  const history = app.slice(app.indexOf('RELEASE_HISTORY'), app.indexOf('Object.freeze({', app.indexOf("version: 'v2.0.288'")));
  for (const version of ['v2.0.290', 'v2.0.291', 'v2.0.292', 'v2.0.293', 'v2.0.294']) {
    assert.match(history, new RegExp("version: '" + version.replaceAll('.', '\\.') + "'"));
  }
  assert.match(history, /Crédito de productos históricos/);
  assert.match(history, /Vínculos seguros en Reclamos/);
  assert.match(history, /Movimientos claros y Novedades completas/);
  assert.match(history, /Operaciones de personal y Caja protegidas/);
});

test('el procedimiento de deploy exige una entrada de Novedades', () => {
  assert.match(deploy, /RELEASE_HISTORY.*version:/s);
  assert.match(deploy, /novedad obligatoria/);
});
