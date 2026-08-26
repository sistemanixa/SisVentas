const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('una nota de credito no infiere receptor por punto y numero', () => {
  assert.match(app, /if \(fvEsNotaCredito\(c\.tipo\) \|\| c\.ventaEliminadaId \|\| c\.ventaEliminadaFbKey\) return null;/);
  assert.match(app, /nombreComercial \|\| fiscal \|\| razonFiscalVenta \|\| 'Consumidor final'/);
});
