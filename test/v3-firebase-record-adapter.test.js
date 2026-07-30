const test = require('node:test');
const assert = require('node:assert/strict');

const FirebaseRecordAdapter = require('../js/v3/firebase-record-adapter.js');

function fakeFirebase(initial) {
  const calls = [];
  const root = {
    fbDB: { name: 'test-db' },
    fbRef: (_db, path) => ({ path }),
    fbGet: (ref) => {
      calls.push(['get', ref.path]);
      return Promise.resolve({ val: () => initial || null });
    },
    fbPush: (ref) => {
      calls.push(['push', ref.path]);
      return { key: '-generated-key' };
    },
    fbSet: (ref, value) => {
      calls.push(['set', ref.path, value]);
      return Promise.resolve();
    },
    fbUpdate: (ref, value) => {
      calls.push(['update', ref.path, value]);
      return Promise.resolve();
    },
    fbRemove: (ref) => {
      calls.push(['remove', ref.path]);
      return Promise.resolve();
    }
  };
  return { root, calls };
}

test('solo permite colecciones V3 expresamente autorizadas', () => {
  assert.equal(FirebaseRecordAdapter.collectionPath('presupuestos'), 'sisventas/presupuestos');
  assert.throws(() => FirebaseRecordAdapter.collectionPath('usuarios'), /no autorizada/);
  assert.throws(() => FirebaseRecordAdapter.cleanKey('cliente/invalido'), /caracteres/);
  assert.throws(() => FirebaseRecordAdapter.cleanKey(''), /clave técnica/);
});

test('lista registros conservando la clave técnica real de Firebase', async () => {
  const fake = fakeFirebase({
    '-a': { fbKey: 'incorrecta', id: 'PP-1' },
    '-b': { id: 'PP-2' }
  });
  const adapter = FirebaseRecordAdapter.create(fake.root);

  const records = await adapter.list('presupuestos');

  assert.deepEqual(records.map((record) => record.fbKey), ['-a', '-b']);
  assert.deepEqual(fake.calls[0], ['get', 'sisventas/presupuestos']);
});

test('crear, guardar, actualizar y eliminar nunca permiten cambiar fbKey', async () => {
  const fake = fakeFirebase();
  const adapter = FirebaseRecordAdapter.create(fake.root);

  assert.equal(adapter.createKey('presupuestos'), '-generated-key');
  await adapter.set('presupuestos', '-generated-key', { id: 'PP-3', fbKey: 'falsa' });
  await adapter.update('presupuestos', '-generated-key', { estado: 'revision', fbKey: 'otra' });
  await adapter.remove('presupuestos', '-generated-key');

  assert.deepEqual(fake.calls, [
    ['push', 'sisventas/presupuestos'],
    ['set', 'sisventas/presupuestos/-generated-key', { id: 'PP-3', fbKey: '-generated-key' }],
    ['update', 'sisventas/presupuestos/-generated-key', { estado: 'revision' }],
    ['remove', 'sisventas/presupuestos/-generated-key']
  ]);
});

test('los lotes se guardan en una sola actualización multipath autorizada', async () => {
  const fake = fakeFirebase();
  const adapter = FirebaseRecordAdapter.create(fake.root);

  const result = await adapter.updateMany('productos', [
    { fbKey: '-a', changes: { compraARS: 100, 'proveedores/0/actualizadoEn': 123 } },
    { fbKey: '-b', changes: { activo: false } }
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(fake.calls, [[
    'update',
    'sisventas/productos',
    {
      '-a/compraARS': 100,
      '-a/proveedores/0/actualizadoEn': 123,
      '-b/activo': false
    }
  ]]);
  assert.throws(
    () => adapter.updateMany('usuarios', [{ fbKey: '-a', changes: { activo: true } }]),
    /no autorizada/
  );
});
