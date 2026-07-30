const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ProductProviderReadModel,
  isLabor,
  normalizeUrl,
  providerType,
  freshness
} = require('../js/v3/product-provider-read-model.js');

const NOW = Date.UTC(2026, 6, 29, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function masters(extra) {
  return [
    { fbKey: 'prov-bio', nombre: 'BIOSEGUR', activo: true },
    { fbKey: 'prov-free', nombre: 'FREE ELECTRON', activo: true },
    { fbKey: 'prov-tecno', nombre: 'TECNOPRICES', activo: true },
    { fbKey: 'prov-meli', nombre: 'MERCADO LIBRE', activo: true }
  ].concat(extra || []);
}

test('mano de obra se reconoce y queda completamente fuera del actualizador', () => {
  const labor = {
    fbKey: 'prod-labor',
    codigo: 'MO-1',
    nombre: 'Instalación de alarma',
    categoria: 'Mano de obra',
    proveedor: 'NIXA',
    codWeb: 'https://nixa.example/servicio'
  };
  const model = new ProductProviderReadModel([labor], masters(), { now: NOW });

  assert.equal(isLabor(labor), true);
  assert.equal(model.compatibleLinks().length, 0);
  assert.deepEqual(model.summary(), {
    catalogProducts: 0,
    laborExcluded: 1,
    automatableProducts: 0,
    pendingProducts: 0,
    currentProducts: 0,
    manualProducts: 0,
    compatibleLinks: 0,
    pendingLinks: 0
  });
  assert.equal(model.audit().issues[0].kind, 'labor-has-provider');
});

test('un proveedor se automatiza sólo si coinciden clave maestra, nombre y dominio', () => {
  const product = {
    fbKey: 'prod-1',
    codigo: 'P-1',
    nombre: 'Detector PIR',
    proveedores: [{
      proveedorKey: 'prov-bio',
      nombre: 'BIOSEGUR',
      url: 'https://www.biosegur.com.ar/detector-pir--det--P134',
      actualizadoEn: NOW - HOUR
    }]
  };
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });
  const link = model.compatibleLinks()[0];

  assert.equal(link.providerFbKey, 'prov-bio');
  assert.equal(link.providerMatchedBy, 'technical');
  assert.equal(link.type, 'biosegur');
  assert.equal(link.current.current, true);
  assert.equal(model.audit().ready, true);
});

test('una clave técnica vencida jamás cae a un proveedor de igual nombre', () => {
  const product = {
    fbKey: 'prod-2',
    codigo: 'P-2',
    proveedores: [{
      proveedorKey: 'prov-eliminado',
      nombre: 'BIOSEGUR',
      url: 'https://biosegur.com.ar/producto'
    }]
  };
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });

  assert.equal(model.compatibleLinks().length, 0);
  assert.equal(model.audit().issues.some((entry) => entry.kind === 'missing-provider'), true);
});

test('nombres maestros duplicados quedan ambiguos salvo referencia por fbKey', () => {
  const duplicateMasters = masters([{ fbKey: 'prov-bio-2', nombre: 'BIOSEGUR', activo: true }]);
  const ambiguous = {
    fbKey: 'prod-a',
    proveedores: [{ nombre: 'BIOSEGUR', url: 'https://biosegur.com.ar/a' }]
  };
  const exact = {
    fbKey: 'prod-b',
    proveedores: [{ proveedorKey: 'prov-bio-2', nombre: 'BIOSEGUR', url: 'https://biosegur.com.ar/b' }]
  };
  const model = new ProductProviderReadModel([ambiguous, exact], duplicateMasters, { now: NOW });

  assert.deepEqual(model.compatibleLinks().map((link) => link.productFbKey), ['prod-b']);
  assert.equal(model.audit().issues.some((entry) => entry.productFbKey === 'prod-a' && entry.kind === 'ambiguous-provider'), true);
});

test('cada proveedor conserva su propia vigencia cuando un producto tiene varios', () => {
  const product = {
    fbKey: 'prod-multi',
    precioActualizadoEn: NOW,
    proveedores: [
      { proveedorKey: 'prov-bio', nombre: 'BIOSEGUR', url: 'https://biosegur.com.ar/a', actualizadoEn: NOW - HOUR },
      { proveedorKey: 'prov-tecno', nombre: 'TECNOPRICES', url: 'https://tecnoprices.com/900163' }
    ]
  };
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });
  const links = model.compatibleLinks();

  assert.equal(links[0].current.current, true);
  assert.equal(links[1].current.status, 'unverified');
  assert.deepEqual(model.compatibleLinks({ pendingOnly: true }).map((link) => link.type), ['tecnoprices']);
  assert.equal(model.summary().pendingProducts, 1);
});

test('el producto legacy con un único proveedor sí puede heredar su fecha raíz', () => {
  const model = new ProductProviderReadModel([{
    fbKey: 'prod-legacy',
    proveedor: 'TECNOPRICES',
    codWeb: '900163',
    precioActualizadoEn: NOW - HOUR
  }], masters(), { now: NOW });
  const link = model.compatibleLinks()[0];

  assert.equal(normalizeUrl('900163'), 'https://www.tecnoprices.com/900163');
  assert.equal(providerType('900163'), 'tecnoprices');
  assert.equal(link.current.current, true);
});

test('Mercado Libre existe pero queda fuera de la selección automática inicial', () => {
  const product = {
    fbKey: 'prod-meli',
    proveedores: [{
      proveedorKey: 'prov-meli',
      nombre: 'Mercado Libre',
      url: 'https://articulo.mercadolibre.com.ar/MLA-1'
    }]
  };
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });

  assert.equal(model.compatibleLinks().length, 0);
  assert.equal(model.compatibleLinks({ selectedTypes: ['mercado_libre'] }).length, 1);
});

test('una URL soportada con nombre incompatible no ingresa al lote', () => {
  const product = {
    fbKey: 'prod-mismatch',
    proveedores: [{
      proveedorKey: 'prov-bio',
      nombre: 'TECNOPRICES',
      url: 'https://biosegur.com.ar/producto'
    }]
  };
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });

  assert.equal(model.compatibleLinks().length, 0);
  assert.equal(model.audit().issues.some((entry) => entry.kind === 'provider-name-url-mismatch'), true);
});

test('la lectura no modifica productos ni proveedores recibidos', () => {
  const product = {
    fbKey: 'prod-immutable',
    proveedores: [{ proveedorKey: 'prov-free', nombre: 'FREE ELECTRON', url: 'free-electron.com.ar/p/1' }]
  };
  const before = JSON.stringify(product);
  const model = new ProductProviderReadModel([product], masters(), { now: NOW });
  model.audit();
  model.summary();

  assert.equal(JSON.stringify(product), before);
});

test('freshness distingue sin verificar, vigente y vencido de forma determinista', () => {
  assert.equal(freshness({}, {}, { now: NOW }).status, 'unverified');
  assert.equal(freshness({}, { actualizadoEn: NOW - HOUR }, { now: NOW }).status, 'current');
  assert.equal(freshness({}, { actualizadoEn: NOW - 25 * HOUR }, { now: NOW }).status, 'expired');
});
