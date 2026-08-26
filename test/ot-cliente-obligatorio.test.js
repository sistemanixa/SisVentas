const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /function _svVariantesClaveCliente\(valor\)/, 'Debe existir una normalización específica de identificadores de cliente');
assert.match(app, /if \(\/\^\\d\+\$\/\.test\(clave\)\) variantes\.push\(String\(parseInt\(clave, 10\)\)\)/, 'Los IDs históricos 0009 y 9 deben ser equivalentes');
assert.match(app, /clienteVentaOT = typeof _svResolverClienteRegistro/, 'La OT debe resolver primero la ficha real del cliente');
assert.match(app, /if \(!clienteVentaOT\)/, 'Una venta sin cliente identificable debe bloquear la creación de OT');
assert.match(app, /if \(ventaData && \(!nombreClienteVentaOT \|\| !clienteFbKeyVentaOT\)\)/, 'Nombre y clave interna deben ser obligatorios');
assert.match(app, /cliente:\s+nombreClienteVentaOT/, 'La OT debe guardar el nombre resuelto');
assert.match(app, /clienteFbKey: clienteFbKeyVentaOT/, 'La OT debe guardar la clave Firebase del cliente');
assert.match(app, /clienteKey: clienteFbKeyVentaOT/, 'La OT debe conservar la referencia compatible de cliente');

console.log('ot-cliente-obligatorio.test.js OK');
