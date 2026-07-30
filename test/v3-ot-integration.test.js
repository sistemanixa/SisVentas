const test = require('node:test');
const assert = require('node:assert/strict');

const OT = require('../js/v3/ot-integration.js');

function fakeRoot() {
  const calls = [];
  return {
    calls,
    root: {
      fbDB: {},
      fbRef: (_db, path) => ({ path }),
      fbGet: () => Promise.resolve({ val: () => ({}) }),
      fbPush: () => ({ key: '-ot-new' }),
      fbSet: (ref, value) => { calls.push(['set', ref.path, value]); return Promise.resolve(); },
      fbUpdate: (ref, value) => { calls.push(['update', ref.path, value]); return Promise.resolve(); },
      fbRemove: (ref) => { calls.push(['remove', ref.path]); return Promise.resolve(); }
    }
  };
}

test('métricas y filtros de OT usan el mismo modelo canónico', () => {
  const rows = [
    { fbKey: '-a', estado: 'pendiente', fecha: '2026-07-30' },
    { fbKey: '-b', estado: 'completada', fecha: '2026-07-29' },
    { fbKey: '-c', estado: 'en_curso', fecha: '30/07/2026' }
  ];
  const result = OT.model(rows, '2026-07-30');

  assert.deepEqual(result.metrics, { open: 2, today: 2, completed: 1 });
  assert.equal(result.filterPeriod('open').length, 2);
  assert.equal(result.filterPeriod('completed').length, 1);
});

test('el repositorio de OT exige cliente técnico al crear y conserva fbKey', async () => {
  const fake = fakeRoot();
  const adapter = OT.create(fake.root);

  await assert.rejects(adapter.save({ cliente: 'CLIENTE' }), /clave técnica del cliente/);
  const created = await adapter.save({ cliente: 'CLIENTE', clienteFbKey: '-client-a', estado: 'pendiente' });
  await adapter.update(created.fbKey, { estado: 'en_curso' });
  await adapter.remove(created.fbKey);

  assert.equal(created.fbKey, '-ot-new');
  assert.deepEqual(fake.calls.map((call) => call.slice(0, 2)), [
    ['set', 'sisventas/ordenes_trabajo/-ot-new'],
    ['update', 'sisventas/ordenes_trabajo/-ot-new'],
    ['remove', 'sisventas/ordenes_trabajo/-ot-new']
  ]);
});

test('las tareas de adjuntos se cancelan juntas al terminar sesión', async () => {
  const fake = fakeRoot();
  const adapter = OT.create(fake.root);
  let aborted = false;
  const task = adapter.createAttachmentTask({
    ownerKey: '-ot-a',
    kind: 'foto',
    file: { name: 'foto.jpg' },
    adapter: {
      upload: ({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(new Error('abortada')); });
      }),
      saveMetadata: () => Promise.resolve()
    },
    timeoutMs: 5000
  });
  const running = task.start();

  assert.equal(adapter.activeAttachmentCount(), 1);
  assert.equal(adapter.cancelAttachments('logout'), 1);
  await assert.rejects(running, /abortada/);
  assert.equal(aborted, true);
  assert.equal(task.snapshot().state, 'cancelled');
  assert.equal(adapter.activeAttachmentCount(), 0);
});
