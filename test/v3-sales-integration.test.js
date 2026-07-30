const test = require('node:test');
const assert = require('node:assert/strict');

const Sales = require('../js/v3/sales-integration.js');

function fixture() {
  const sale = {
    fbKey: '-sale-a',
    id: 'V-1',
    cliente: 'CLIENTE',
    clienteFbKey: '-client-a',
    conIva: false,
    items: [{ cod: 'P-1', desc: 'Equipo', qty: 2, punit: 1000 }],
    total: 2000
  };
  const payments = [
    { fbKey: '-pay-a', ventaFbKey: '-sale-a', monto: 600 },
    { fbKey: '-pay-b', ventaId: 'V-1', monto: 400 }
  ];
  return { sale, payments };
}

test('venta, pagos y saldo comparten un único resumen canónico', () => {
  const data = fixture();
  const result = Sales.summary([data.sale], data.payments, data.sale);

  assert.equal(result.status, 'found');
  assert.equal(result.total, 2000);
  assert.equal(result.paid, 1000);
  assert.equal(result.balance, 1000);
  assert.equal(result.payments.length, 2);
});

test('un pago duplicado u huérfano bloquea la conciliación', () => {
  const data = fixture();
  const readModel = Sales.model([data.sale], [
    data.payments[0],
    Object.assign({}, data.payments[0]),
    { fbKey: '-orphan', ventaFbKey: '-missing', monto: 20 }
  ]);

  assert.deepEqual(readModel.conflicts.map((entry) => entry.kind), ['duplicate-payment', 'orphan-payment']);
});

function fakeRoot() {
  const calls = [];
  return {
    calls,
    root: {
      fbDB: {},
      fbRef: (_db, path) => ({ path }),
      fbGet: () => Promise.resolve({ val: () => ({}) }),
      fbPush: (ref) => ({ key: ref.path.endsWith('/ventas') ? '-sale-new' : '-pay-new' }),
      fbSet: (ref, value) => { calls.push(['set', ref.path, value]); return Promise.resolve(); },
      fbUpdate: (ref, value) => { calls.push(['update', ref.path, value]); return Promise.resolve(); },
      fbRemove: (ref) => { calls.push(['remove', ref.path]); return Promise.resolve(); }
    }
  };
}

test('repositorios de ventas y pagos conservan relaciones por fbKey', async () => {
  const fake = fakeRoot();
  const adapter = Sales.create(fake.root);
  const data = fixture();
  const sale = Object.assign({}, data.sale);
  delete sale.fbKey;
  const createdSale = await adapter.saveSale(sale);
  const createdPayment = await adapter.savePayment({ ventaFbKey: createdSale.fbKey, ventaId: 'V-1', monto: 500 });
  await adapter.updateSale(createdSale.fbKey, { estadoPago: 'seniado' });
  await adapter.removePayment(createdPayment.fbKey);

  assert.equal(createdSale.fbKey, '-sale-new');
  assert.equal(createdPayment.fbKey, '-pay-new');
  assert.deepEqual(fake.calls.map((call) => call.slice(0, 2)), [
    ['set', 'sisventas/ventas/-sale-new'],
    ['set', 'sisventas/pagos/-pay-new'],
    ['update', 'sisventas/ventas/-sale-new'],
    ['remove', 'sisventas/pagos/-pay-new']
  ]);
});

test('no permite crear ventas o pagos sin claves técnicas relacionadas', async () => {
  const fake = fakeRoot();
  const adapter = Sales.create(fake.root);

  await assert.rejects(
    adapter.saveSale({ items: [{ qty: 1, punit: 100 }], conIva: false }),
    /clave técnica del cliente/
  );
  await assert.rejects(adapter.savePayment({ ventaId: 'V-1', monto: 100 }), /clave técnica de la venta/);
  assert.equal(fake.calls.length, 0);
});
