'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { digest } = require('../cotizador/labor-guard');
const { create } = require('../cotizador/purchase-order-delete-review');
const { createPurchaseOrderDelete } = require('../cotizador/purchase-order-delete');
const { prepare } = require('../scripts/lib/purchase-delete-preparation.cjs');
const { createCoordinatedBackend } = require('./helpers/coordinated-backend.cjs');
const { fixture: cutFixture, sha } = require('./helpers/commercial-cut-manifest.cjs');

const targetPath = 'sisventas/ordenes/draft';
const otherPath = 'sisventas/ordenes/received';
const inventoryPath = 'sisventas/inventario_operativo/item';
const runtime = { coordinated: true, readOnly: false, commercialPages: true,
  operationalSummaries: true, clientAccounts: true, clientHistory: true };

async function fixture() {
  const order = { numero: 'OC-TEST-0049', estado: 'borrador', origen: 'manual',
    items: [{ productoKey: 'item', cantidadOrdenada: 2, cantidadRecibida: 0 }] };
  const protectedOrder = { numero: 'OC-TEST-0048', estado: 'recibida',
    items: [{ productoKey: 'item', cantidadOrdenada: 2, cantidadRecibida: 2 }] };
  const inventory = { general: 2, enCompra: 2, reservado: 0, costoReferenciaStock: { order: 'received', unit: 15 } };
  const backend = await createCoordinatedBackend({ ordenes: { draft: order, received: protectedOrder },
    inventario_operativo: { item: inventory } });
  const configs = {
    sv_labor_config: { ...backend.state.sv_labor_config, writerSchema: 2 },
    sv_operational_read_config: { schema: 1, ready: true, generation: 'fixture-operational' },
    sv_commercial_pages_config: backend.state.sv_commercial_pages_config,
    sv_client_accounts_config: backend.state.sv_client_accounts_config,
    sv_client_history_config: backend.state.sv_client_history_config
  };
  Object.assign(backend.state, structuredClone(configs), { sv_permisos: {
    admin: { indiceVersion: 2, indiceRevision: 1, indiceModulos: { ordenes: true }, acciones: { ordenes: { eliminar: true } } }
  } });
  const input = { cutManifest: cutFixture(), configs, order: { ...order, fbKey: 'draft' },
    protectedOrder: { ...protectedOrder, fbKey: 'received' }, inventoryByKey: { item: inventory },
    attribution: { item: { quantity: 2, evidenceSha256: sha('review of contribution for fixture draft') } } };
  const prepared = prepare(input);
  const env = { PURCHASE_ORDER_DELETE_READY: 'true', PURCHASE_ORDER_DELETE_REVIEW_JSON: prepared.reviewJson,
    PURCHASE_ORDER_DELETE_REVIEW_SHA256: prepared.reviewSha256 };
  const service = (environment = env, state = runtime) => createPurchaseOrderDelete({
    store: backend.store, guard: backend.guard, enabled: true, review: create({ env: environment, runtime: () => state }),
    authorize: async () => ({ uid: 'u', claims: { uid: 'u' } })
  });
  const body = { id: 'purchase-reviewed-fixture', orderKey: 'draft', expectedHash: digest(order) };
  const run = (command = service(), bodyOverride = body) => command.handle({ method: 'POST', url: '/compras/ordenes/eliminar' }, bodyOverride);
  return { backend, input, env, prepared, service, body, run };
}

test('reviewed cut uses one atomic commit, preserves the received order and physical stock, and recovers the same receipt', async () => {
  const f = await fixture();
  const before = f.backend.get(inventoryPath);
  const other = f.backend.get(otherPath);
  assert.equal(f.prepared.activationAuthorized, false);
  assert.deepEqual(f.prepared.inventoryChanges, [{ key: 'item', pendingChange: -2 }]);
  const service = f.service();
  assert.equal(await service.capability(), true);
  assert.equal((await f.run(service)).orderKey, 'draft');
  assert.equal((await f.run(service)).orderKey, 'draft');
  assert.equal(f.backend.commits.length, 1);
  assert.equal(f.backend.get(targetPath), null);
  assert.deepEqual(f.backend.get(otherPath), other);
  assert.equal(Object.hasOwn(f.backend.commits[0], otherPath), false);
  const after = f.backend.get(inventoryPath);
  for (const key of ['general', 'reservado', 'costoReferenciaStock']) assert.deepEqual(after[key], before[key]);
  assert.equal(after.enCompra, 0);
});

test('a flag alone, a changed review digest, or read-only runtime leaves the command closed', async () => {
  const f = await fixture();
  for (const service of [f.service({ PURCHASE_ORDER_DELETE_READY: 'true' }),
    f.service({ ...f.env, PURCHASE_ORDER_DELETE_REVIEW_SHA256: sha('wrong') }),
    f.service(f.env, { ...runtime, readOnly: true })]) {
    assert.equal(await service.capability(), false);
    await assert.rejects(f.run(service), { statusCode: 503 });
  }
  assert.equal(f.backend.commits.length, 0);
});

test('another order, changed inventory, or updated configuration cannot use the review', async () => {
  const f = await fixture();
  await assert.rejects(f.run(f.service(), { ...f.body, orderKey: 'received' }), /no está incluida/);
  f.backend.state.sisventas.inventario_operativo.item.enCompra += 2;
  await assert.rejects(f.run(), /cambiaron desde la revisión/);
  f.backend.state.sv_operational_read_config.generation = 'new-generation';
  assert.equal(await f.service().capability(), false);
  await assert.rejects(f.run(), { statusCode: 503 });
  assert.equal(f.backend.commits.length, 0);
  assert.ok(f.backend.get(targetPath));
});

test('late change to the received order aborts before committing', async () => {
  const f = await fixture();
  const read = f.backend.store.read;
  let protectedReads = 0;
  f.backend.store.read = path => {
    if (path === otherPath && ++protectedReads === 2) f.backend.state.sisventas.ordenes.received.notes = 'Concurrent edit';
    return read(path);
  };
  await assert.rejects(f.run(), /cambiaron desde la revisión/);
  assert.equal(f.backend.commits.length, 0);
  assert.equal(f.backend.get(inventoryPath).enCompra, 2);
  assert.ok(f.backend.get(targetPath));
});

test('offline preparation requires exact attribution, an unchanged draft and reviewed writers', async () => {
  const { input } = await fixture();
  const wrongQuantity = { item: { ...input.attribution.item, quantity: 1 } };
  assert.throws(() => prepare({ ...input, attribution: wrongQuantity }), /revisión de las cantidades/);
  assert.throws(() => prepare({ ...input, order: { ...input.order, recepciones: [{ quantity: 1 }] } }), /sin recepciones/);
  input.cutManifest.operations.find(row => row.name === 'orderDelete').writerIds.pop();
  assert.throws(() => prepare(input), { code: 'SV_COMMERCIAL_CUT_EVIDENCE' });
});
