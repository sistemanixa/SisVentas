const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

test('la grilla y cabecera muestran el proveedor final conciliado', () => {
  assert.match(source, /function orderProviderSummary\(order\)/);
  assert.match(source, /item\.proveedorFinal/);
  assert.match(source, /return 'Varios proveedores'/);
  assert.match(source, /esc\(orderProviderSummary\(o\)\)/);
  assert.match(source, /esc\(orderProviderSummary\(order\)\)/);
});

test('guardar recepción o conciliación persiste el resumen final', async () => {
  const {fixture,actor} = require('./helpers/purchase-command-fixture.cjs');
  const f = fixture();
  f.state.sisventas.ordenes.o.proveedor = 'Proveedor presupuestado anterior';
  await f.service.execute(actor,f.request('receipt'));
  let order = f.state.sisventas.ordenes.o;
  assert.equal(order.items[0].proveedorFinalKey,'p');
  assert.equal(order.items[0].proveedorFinal,'Proveedor ficticio');
  assert.equal(order.proveedorFinalResumen,'Proveedor ficticio');
  assert.deepEqual(order.proveedoresFinales,['Proveedor ficticio']);
  await f.service.execute(actor,f.request('reconcile'));
  order = f.state.sisventas.ordenes.o;
  assert.equal(order.items[0].proveedorFinalKey,'q');
  assert.equal(order.items[0].proveedorFinal,'Otro proveedor');
  assert.equal(order.proveedorFinalResumen,'Otro proveedor');
  assert.deepEqual(order.proveedoresFinales,['Otro proveedor']);
  assert.equal(f.state.sisventas.ventas.s.items[0].proveedorCompraReal,'Otro proveedor');

  const mixed = fixture();
  mixed.state.sisventas.ventas.s.items.push({cod:'P2',pid:'p2',qty:2,punit:200,costoUnitarioCompra:100,costoTotalCompra:200,costoUnitarioAntesPreparacion:100});
  mixed.state.sisventas.ordenes.o.items.push({productoKey:'p2',codigo:'P2',descripcion:'Segundo producto ficticio',saleItemIndex:1,cantidadOrdenada:2,cantidadRecibida:0,costoUnitario:100,costoUnitarioPresupuestado:100});
  mixed.state.sisventas.inventario_operativo.p2={general:0,reservado:0,enCompra:2};
  await mixed.service.execute(actor,mixed.request('receipt',{movements:[{index:0,qty:1,costoUnitarioReal:80,proveedorKey:'p'},{index:1,qty:1,costoUnitarioReal:90,proveedorKey:'q'}]}));
  assert.equal(mixed.state.sisventas.ordenes.o.proveedorFinalResumen,'Varios proveedores');
  assert.deepEqual(mixed.state.sisventas.ordenes.o.proveedoresFinales,['Proveedor ficticio','Otro proveedor']);
  await mixed.service.execute(actor,mixed.request('reconcile',{changes:[{index:0,costoUnitarioReal:95,proveedorKey:'q'},{index:1,costoUnitarioReal:90,proveedorKey:'q'}]}));
  assert.equal(mixed.state.sisventas.ordenes.o.proveedorFinalResumen,'Otro proveedor');
  assert.deepEqual(mixed.state.sisventas.ordenes.o.proveedoresFinales,['Otro proveedor']);
});
