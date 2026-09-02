const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.3.5.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('venta y presupuesto muestran el domicilio histórico del cliente', () => {
  assert.match(app, /function _svDireccionClienteDocumento\(reg\)/);
  assert.match(app, /reg\.direccionCliente, reg\.clienteDir, reg\.direccion, reg\.dir/);
  assert.match(app, /direccionClienteVentaDetalle/);
  assert.match(app, /direccionPptoDetalle/);
  assert.match(index, /id="ppto-det-direccion"/);
});

test('Ventas permite consultar anuladas en una solapa separada', () => {
  assert.match(index, /id="vtab-anuladas"[^>]*tabVentas\('anuladas'/);
  assert.match(app, /if \(f\.tab === 'anuladas'\) lista = lista\.filter\(ventaEstaAnulada\)/);
  assert.match(app, /else lista = lista\.filter\(function\(v\)\{ return !ventaEstaAnulada\(v\); \}\)/);
});

test('Catálogo vuelve al producto y a la posición desde la ficha interna', () => {
  assert.match(app, /data-catalogo-pid=/);
  assert.match(app, /productoFbKey:fbKey/);
  assert.match(app, /scrollTop:contenidoCatalogo \? contenidoCatalogo\.scrollTop : 0/);
  assert.match(app, /contenidoRetorno\.scrollTop = Math\.max/);
});

test('Catálogo presenta el valor de venta más IVA en cada tarjeta', () => {
  assert.match(app, /var precioVentaCatalogo = metricasListaProducto\(p\)\.venta/);
  assert.match(app, /catalogo-precio/);
  assert.match(app, /\+ IVA/);
});
