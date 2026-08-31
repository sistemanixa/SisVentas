const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const appActivo = (index.match(/<script src="\.\/js\/(app\.v[^"?]+\.js)/) || [])[1];
assert.ok(appActivo, 'index.html debe declarar el archivo principal activo');
const app = fs.readFileSync('js/' + appActivo, 'utf8');
const permisos = fs.readFileSync('js/modules/action-permissions.js', 'utf8');

test('Roles ofrece permisos independientes para márgenes de ventas y presupuestos', () => {
  assert.match(permisos, /'ventas\.verMargen'\s*:\s*\{\s*modulo:'detalle',\s*roles:\['admin'\]/);
  assert.match(permisos, /'presupuestos\.verMargen'\s*:\s*\{\s*modulo:'presupuesto',\s*roles:\['admin'\]/);
  assert.match(app, /'ventas\.verMargen':'Ver margen y costo de ventas(?: \(solo Admin\))?'/);
  assert.match(app, /'presupuestos\.verMargen':'Ver margen y costo de presupuestos(?: \(solo Admin\))?'/);
});

test('los controles y detalles consultan el permiso, no el nombre fijo del rol', () => {
  assert.match(index, /class="permiso-margen-venta"/);
  assert.match(index, /class="permiso-margen-presupuesto"/);
  assert.match(app, /function puedeVerMargenVenta\(\)[\s\S]*?tienePermiso\('ventas\.verMargen'\)/);
  assert.match(app, /function puedeVerMargenPresupuesto\(\)[\s\S]*?tienePermiso\('presupuestos\.verMargen'\)/);
  assert.match(app, /if \(!puedeVerMargenVenta\(\)\) \{ box\.style\.display = 'none'; return; \}/);
  assert.match(app, /if \(!puedeVerMargenPresupuesto\(\)\) \{ box\.style\.display = 'none'; return; \}/);
  assert.match(app, /Ganancia: \$/);
  assert.match(app, /var puedeVerInternosVenta = puedeVerMargenVenta\(\)/);
  assert.match(app, /var puedeVerMargenPpto = puedeVerMargenPresupuesto\(\)/);
});

test('Ventas y Presupuestos muestran sus acciones sensibles al abrir Roles', () => {
  assert.match(app, /ROLES_MODULOS_EXPANDIDOS\s*=\s*\{\s*detalle:true,\s*presupuesto:true\s*\}/);
  assert.ok(index.indexOf('js/modules/action-permissions.js') < index.indexOf('js/' + appActivo));
});
