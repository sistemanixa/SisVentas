const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.2.8.js', 'utf8');

test('venta conserva cliente principal y domicilio seleccionado', () => {
  assert.match(html, /id="cli-fbkey"/);
  assert.match(html, /<label>ID domicilio<\/label>/);
  assert.match(app, /clientePrincipalKey: vinculoClienteVenta\.clientePrincipalKey/);
  assert.match(app, /domicilioFbKey: vinculoClienteVenta\.domicilioFbKey/);
  assert.match(app, /direccionCliente: vinculoClienteVenta\.direccion/);
});

test('presupuesto y OT guardan el mismo vínculo canónico', () => {
  assert.match(app, /clientePrincipalKey: vinculoClientePpto\.clientePrincipalKey/);
  assert.match(app, /domicilioFbKey: vinculoClientePpto\.domicilioFbKey/);
  assert.match(app, /ot\.clientePrincipalKey = vinculo\.clientePrincipalKey/);
  assert.match(app, /ot\.domicilioFbKey = vinculo\.domicilioFbKey/);
});

test('cuenta corriente agrupa operaciones por cliente principal', () => {
  assert.match(app, /function _svClaveClientePrincipalRegistro/);
  assert.match(app, /var key = _svClaveClientePrincipalRegistro\(venta\)/);
  assert.match(app, /var clavePrincipalPago = _svClaveClientePrincipalRegistro\(pago\)/);
});

test('los selectores excluyen domicilios inactivos y los identifican por dirección', () => {
  assert.match(app, /filter\(function\(c\)\{ return c && c\.activo !== false; \}\)/);
  assert.match(app, /var categoria = _clienteCategoriaSede\(c\) \|\| 'Domicilio'/);
  assert.match(app, /Domicilio ID/);
});

test('la baja de un domicilio preserva los documentos históricos', () => {
  assert.match(app, /Dar de baja domicilio/);
  assert.match(app, /Se conservarán ventas, presupuestos, OT, cuenta corriente y credenciales/);
  assert.match(app, /updatesBaja\[FB_PATHS\.clientes \+ '\/' \+ cli\.fbKey \+ '\/activo'\] = false/);
});

test('la carga de productos continúa automáticamente en venta y presupuesto', () => {
  assert.match(app, /var esFilaVenta = !!\(filaSeleccionada && filaSeleccionada\.closest\('#det-body'\)\)/);
  assert.match(app, /if \(esFilaPpto\) agregarProductoPresupuesto\(\)/);
  assert.match(app, /else agregarProductoVenta\(\)/);
});

test('kits y OT mantienen el selector listo para cargar el siguiente producto', () => {
  assert.match(app, /buscarKit\.value = ''; buscarKit\.focus\(\)/);
  assert.match(app, /filtrarSelectorKit\(''\)/);
  assert.match(app, /buscarOT\.value = ''; buscarOT\.focus\(\)/);
  assert.match(app, /otFiltrarSelectorProductos\(''\)/);
});
