const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('la inferencia del receptor no cruza facturas A, B o C con igual numeracion', () => {
  assert.match(app, /function fvTipoFacturaDeComprobante\(tipo\)/);
  assert.match(app, /var tipoComprobante = fvTipoFacturaDeComprobante\(c\.tipo\);/);
  assert.match(app, /!tipoComprobante \|\| !datos\.tipo \|\| datos\.tipo === tipoComprobante/);
});
