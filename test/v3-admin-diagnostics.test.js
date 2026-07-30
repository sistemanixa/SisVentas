const test = require('node:test');
const assert = require('node:assert/strict');

const Diagnostics = require('../js/v3/admin-diagnostics.js');

test('el resumen administrativo separa aptitud, incidencias y diferencias por módulo', () => {
  const summary = Diagnostics.summarize({
    ready: false,
    generatedAt: '2026-07-30T12:00:00.000Z',
    gates: {
      presupuestos: true,
      ventasPagos: false,
      ordenesTrabajo: true,
      productosProveedores: false
    },
    summary: { totalIssues: 4 },
    comparisons: {
      presupuestos: { ready: true },
      ventasPagos: { ready: false, differences: [{ equal: false }] },
      ordenesTrabajo: { ready: true, differences: [] },
      productosProveedores: {
        ready: false,
        differences: [{ name: 'pendingProducts', legacy: 2, next: 3, delta: 1, equal: false }]
      }
    },
    issues: {
      identity: {
        presupuestos: { technical: 0, business: 0, names: 0, missingTechnical: 0 },
        ventas: { technical: 0, business: 1, names: 0, missingTechnical: 0 },
        ordenesTrabajo: { technical: 0, business: 0, names: 0, missingTechnical: 0 }
      },
      salesRelations: [{ kind: 'missing-relation' }],
      payments: [{ kind: 'missing-sale' }],
      productsProviders: [{ kind: 'missing-provider', productFbKey: '-product-a' }]
    }
  });

  assert.equal(summary.ready, false);
  assert.equal(summary.totalIssues, 4);
  assert.equal(summary.modules.find((module) => module.id === 'presupuestos').eligible, true);
  assert.equal(summary.modules.find((module) => module.id === 'ventasPagos').issues, 3);
  assert.equal(summary.modules.find((module) => module.id === 'productosProveedores').differences, 1);
});

test('el panel agrupa conflictos sin incluir nombres ni contenido comercial', () => {
  const groups = Diagnostics.groupedIssues({
    issues: {
      payments: [
        { kind: 'missing-sale', fbKey: '-pay-a', cliente: 'CLIENTE PRIVADO' },
        { kind: 'missing-sale', fbKey: '-pay-b', cliente: 'OTRO CLIENTE' }
      ],
      productsProviders: [
        { kind: 'missing-provider', productFbKey: '-product-a', nombre: 'PRODUCTO PRIVADO' }
      ]
    }
  });

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find((group) => group.kind === 'missing-sale').examples, ['-pay-a', '-pay-b']);
  assert.equal(JSON.stringify(groups).includes('CLIENTE PRIVADO'), false);
  assert.equal(JSON.stringify(groups).includes('PRODUCTO PRIVADO'), false);
});

test('el resumen cuenta las incidencias de identidad entregadas como listas reales', () => {
  const summary = Diagnostics.summarize({
    gates: {},
    comparisons: {},
    issues: {
      identity: {
        presupuestos: {
          technical: [{ key: '-duplicate' }],
          business: [{ id: 'PP-1' }, { id: 'PP-2' }],
          names: [],
          missingTechnical: [{ id: 'PP-3' }]
        }
      }
    }
  });

  assert.equal(summary.modules.find((module) => module.id === 'presupuestos').issues, 4);
});

test('la lista de compuertas administrativas contiene los cuatro dominios migrables', () => {
  assert.deepEqual(Diagnostics.modules.map((module) => module.id), [
    'presupuestos',
    'ventasPagos',
    'ordenesTrabajo',
    'productosProveedores'
  ]);
});
