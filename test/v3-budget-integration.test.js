const test = require('node:test');
const assert = require('node:assert/strict');

const Budget = require('../js/v3/budget-integration.js');

test('formulario, guardado, impresión y conversión comparten un único cálculo', () => {
  const record = {
    id: 'PP-10',
    cliente: 'CLIENTE',
    conIva: true,
    descuentoGeneral: 10,
    items: [
      { cod: 'P-1', desc: 'Equipo', qty: 2, punit: 1000, disc: 5, productoFbKey: '-product-a' }
    ]
  };
  const model = Budget.build(record);
  const saved = Budget.fields(record);
  const printed = Budget.printModel(record);
  const sale = Budget.toSale(record);

  assert.equal(model.subtotal, 1900);
  assert.equal(model.generalDiscount, 190);
  assert.equal(model.iva, 359.1);
  assert.equal(model.total, 2069.1);
  assert.equal(saved.total, model.total);
  assert.equal(printed.total, model.total);
  assert.equal(sale.total, model.total);
  assert.equal(sale.discountAmount, 290);
  assert.equal(sale.items[0].productoFbKey, '-product-a');
});

test('un total histórico sin ítems puede listarse pero no imprimirse ni convertirse', () => {
  const record = { id: 'PP-OLD', cliente: 'CLIENTE', total: 5000 };

  assert.equal(Budget.tableTotal(record), 5000);
  assert.equal(Budget.printModel(record).ready, false);
  assert.equal(Budget.printModel(record).mode, 'legacy-total-only');
  assert.equal(Budget.toSale(record).ready, false);
});

test('el adaptador se registra en el puente sin activar el módulo por sí solo', () => {
  let registered = null;
  const root = {
    SisVentas: {
      V3Bridge: {
        adapter: () => null,
        register: (name, adapter) => { registered = { name, adapter }; }
      }
    }
  };

  const adapter = Budget.create(root);
  assert.equal(registered.name, 'presupuestos');
  assert.equal(registered.adapter, adapter);
  assert.equal(adapter.tableTotal({ items: [{ qty: 1, punit: 100 }], conIva: false }), 100);
});

function rootConFirebase() {
  const calls = [];
  return {
    calls,
    root: {
      fbDB: {},
      fbRef: (_db, path) => ({ path }),
      fbGet: () => Promise.resolve({ val: () => ({}) }),
      fbPush: () => ({ key: '-budget-new' }),
      fbSet: (ref, value) => { calls.push(['set', ref.path, value]); return Promise.resolve(); },
      fbUpdate: (ref, value) => { calls.push(['update', ref.path, value]); return Promise.resolve(); },
      fbRemove: (ref) => { calls.push(['remove', ref.path]); return Promise.resolve(); }
    }
  };
}

test('el repositorio de presupuestos crea, edita y elimina usando fbKey', async () => {
  const fake = rootConFirebase();
  const adapter = Budget.create(fake.root);
  const base = {
    id: 'PP-20',
    cliente: 'CLIENTE',
    clienteFbKey: '-client-a',
    conIva: false,
    items: [{ cod: 'P-1', desc: 'Equipo', qty: 1, punit: 1000 }]
  };

  const created = await adapter.save(base);
  await adapter.save(Object.assign({}, base, { fbKey: created.fbKey, estado: 'revision' }));
  await adapter.update(created.fbKey, { estado: 'aprobado_int' });
  await adapter.remove(created.fbKey);

  assert.equal(created.fbKey, '-budget-new');
  assert.equal(fake.calls[0][0], 'set');
  assert.equal(fake.calls[0][1], 'sisventas/presupuestos/-budget-new');
  assert.equal(fake.calls[0][2].fbKey, '-budget-new');
  assert.deepEqual(fake.calls.slice(1).map((call) => call.slice(0, 2)), [
    ['update', 'sisventas/presupuestos/-budget-new'],
    ['update', 'sisventas/presupuestos/-budget-new'],
    ['remove', 'sisventas/presupuestos/-budget-new']
  ]);
});

test('el repositorio rechaza un presupuesto nuevo sin cliente técnico o con importes inconsistentes', async () => {
  const fake = rootConFirebase();
  const adapter = Budget.create(fake.root);

  await assert.rejects(
    adapter.save({ items: [{ qty: 1, punit: 100 }], total: 999 }),
    /clave técnica del cliente/
  );
  assert.equal(fake.calls.length, 0);
});
