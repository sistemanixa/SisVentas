const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.0.8.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const permisos = fs.readFileSync('js/modules/action-permissions.js', 'utf8');

test('Roles ofrece permisos independientes para márgenes de ventas y presupuestos', () => {
  assert.match(permisos, /'ventas\.verMargen'\s*:\s*\{\s*modulo:'detalle',\s*roles:\['admin'\]/);
  assert.match(permisos, /'presupuestos\.verMargen'\s*:\s*\{\s*modulo:'presupuesto',\s*roles:\['admin'\]/);
  assert.match(app, /'ventas\.verMargen':'Ver margen y costo de ventas'/);
  assert.match(app, /'presupuestos\.verMargen':'Ver margen y costo de presupuestos'/);
});

test('los controles y detalles consultan el permiso, no el nombre fijo del rol', () => {
  assert.match(index, /class="permiso-margen-venta"/);
  assert.match(index, /class="permiso-margen-presupuesto"/);
  assert.match(app, /function puedeVerMargenVenta\(\)[\s\S]*?tienePermiso\('ventas\.verMargen'\)/);
  assert.match(app, /function puedeVerMargenPresupuesto\(\)[\s\S]*?tienePermiso\('presupuestos\.verMargen'\)/);
  assert.match(app, /var puedeVerInternosVenta = puedeVerMargenVenta\(\)/);
  assert.match(app, /var puedeVerMargenPpto = puedeVerMargenPresupuesto\(\)/);
});
