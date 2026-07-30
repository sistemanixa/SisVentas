const test = require('node:test');
const assert = require('node:assert/strict');

const Integration = require('../js/v3/product-provider-integration.js');

function fixtures(now) {
  const providers = [
    { fbKey: '-bio', nombre: 'BIOSEGUR', activo: true },
    { fbKey: '-free', nombre: 'FREE ELECTRON', activo: true }
  ];
  const products = [
    {
      fbKey: '-p1', codigo: 'P-1', nombre: 'Sensor', activo: true,
      proveedores: [{ nombre: 'BIOSEGUR', proveedorKey: '-bio', url: 'https://www.biosegur.com.ar/item', actualizadoEn: now }]
    },
    {
      fbKey: '-p2', codigo: 'MO-1', nombre: 'Mano de obra instalación', activo: true,
      proveedores: [{ nombre: 'NIXA', url: 'https://nixa.example/servicio' }]
    }
  ];
  return { providers, products };
}

test('los enlaces compatibles conservan la forma esperada por el actualizador actual', () => {
  const now = Date.now();
  const data = fixtures(now);
  const links = Integration.legacyLinks(data.products, data.providers, { now, selectedTypes: ['biosegur'] });

  assert.equal(links.length, 1);
  assert.equal(links[0].producto.fbKey, '-p1');
  assert.equal(links[0].proveedorIdx, 0);
  assert.equal(links[0].proveedorKey, '-bio');
  assert.equal(links[0].tipo, 'biosegur');
  assert.equal(links[0].vigente, true);
});

test('mano de obra nunca conserva proveedor, incluida NIXA', () => {
  const clean = Integration.sanitizeProduct({
    fbKey: '-labor',
    nombre: 'Mano de obra cableado',
    categoria: 'Mano de obra',
    proveedor: 'NIXA',
    proveedorKey: '-nixa',
    proveedores: [{ nombre: 'NIXA' }]
  });

  assert.deepEqual(clean.proveedores, []);
  assert.equal('proveedor' in clean, false);
  assert.equal('proveedorKey' in clean, false);
});

function fakeRoot() {
  const calls = [];
  return {
    calls,
    root: {
      fbDB: {},
      fbRef: (_db, path) => ({ path }),
      fbGet: () => Promise.resolve({ val: () => ({}) }),
      fbPush: (ref) => ({ key: ref.path.endsWith('/productos') ? '-product-new' : '-provider-new' }),
      fbSet: (ref, value) => { calls.push(['set', ref.path, value]); return Promise.resolve(); },
      fbUpdate: (ref, value) => { calls.push(['update', ref.path, value]); return Promise.resolve(); },
      fbRemove: (ref) => { calls.push(['remove', ref.path]); return Promise.resolve(); }
    }
  };
}

test('productos, proveedores y lotes persisten por repositorios con claves técnicas', async () => {
  const fake = fakeRoot();
  const adapter = Integration.create(fake.root);
  const product = await adapter.saveProduct({ codigo: 'P-10', nombre: 'Equipo' });
  const provider = await adapter.saveProvider({ nombre: 'BIOSEGUR' });
  await adapter.updateProducts([{ fbKey: product.fbKey, changes: { compraARS: 100 } }]);
  await adapter.updateProviders([{ fbKey: provider.fbKey, changes: { base: true } }]);
  await adapter.removeProduct(product.fbKey);
  await adapter.removeProvider(provider.fbKey);

  assert.equal(product.fbKey, '-product-new');
  assert.equal(provider.fbKey, '-provider-new');
  assert.deepEqual(fake.calls.map((call) => call.slice(0, 2)), [
    ['set', 'sisventas/productos/-product-new'],
    ['set', 'sisventas/proveedores/-provider-new'],
    ['update', 'sisventas/productos'],
    ['update', 'sisventas/proveedores'],
    ['remove', 'sisventas/productos/-product-new'],
    ['remove', 'sisventas/proveedores/-provider-new']
  ]);
});
