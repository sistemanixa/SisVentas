const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.2.5.js'), 'utf8');

test('las imágenes del presupuesto no dependen del servidor auxiliar local', () => {
  assert.doesNotMatch(app, /127\.0\.0\.1:8787/);
  const proxyUses = app.match(/var baseProxy = SISVENTAS_FUNCTIONS\.cotizadorProveedor;/g) || [];
  assert.ok(proxyUses.length >= 2, 'la vista y el archivado deben usar el proxy disponible');
});
