const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('la auditoria solo convierte importes legacy realmente marcados como USD', () => {
  assert.match(app, /monedaCosto === 'USD'/);
  assert.match(app, /monedaVenta === 'USD'/);
  assert.match(app, /function _auditoriaPrecioYaAplicada\(/);
});

test('la auditoria permite buscar por producto, proveedor y URL', () => {
  assert.match(app, /function filtrarAuditoriaIntegridadPrecios\(/);
  assert.match(app, /Buscar por código, producto, proveedor o URL/);
  assert.match(app, /data-auditoria-precio-item/);
  assert.match(app, /p\.codWeb/);
  assert.match(app, /p\.urlProveedor/);
});
