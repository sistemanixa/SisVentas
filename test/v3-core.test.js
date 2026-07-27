const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const { IdentityIndex } = require('../js/v3/identity-index.js');
const { DomainStore } = require('../js/v3/domain-store.js');
const Budget = require('../js/v3/budget-read-model.js');
const OT = require('../js/v3/ot-read-model.js');
const { SalesReadModel } = require('../js/v3/sales-read-model.js');
const { RecordRepository } = require('../js/v3/record-repository.js');
const MigrationAudit = require('../js/v3/migration-audit.js');
const LegacySnapshot = require('../js/v3/legacy-snapshot.js');
const ShadowComparison = require('../js/v3/shadow-comparison.js');
const { AttachmentTask } = require('../js/v3/attachment-task.js');
const { DataLifecycle } = require('../js/v3/data-lifecycle.js');
const { FeatureGates } = require('../js/v3/feature-gates.js');

test('presupuesto sin IVA conserva los precios netos y no agrega impuesto', () => {
  const result = Budget.build({
    id: 'PP-100',
    cliente: 'CLIENTE',
    conIva: false,
    items: [
      { cod: 'P-1', desc: 'Equipo', qty: 2, punit: 1000, disc: 10, sub: 1800 },
      { cod: 'P-2', desc: 'Servicio', qty: 1, punit: 500, sub: 500 }
    ],
    descuentoGeneral: 10,
    subtotal: 2300,
    descuentoAmt: 230,
    iva: 0,
    total: 2070
  });

  assert.equal(result.grossSubtotal, 2500);
  assert.equal(result.lineDiscount, 200);
  assert.equal(result.subtotal, 2300);
  assert.equal(result.generalDiscount, 230);
  assert.equal(result.iva, 0);
  assert.equal(result.total, 2070);
  assert.equal(result.ready, true);
});

test('presupuesto con IVA lo aplica una sola vez despuÃ©s de los descuentos', () => {
  const result = Budget.build({
    conIva: true,
    items: [{ cantidad: 2, precioUnitario: '1.000,50', descuentoPct: 5 }],
    descuentoPct: 10
  });

  assert.equal(result.grossSubtotal, 2001);
  assert.equal(result.subtotal, 1900.95);
  assert.equal(result.generalDiscount, 190.1);
  assert.equal(result.taxableBase, 1710.85);
  assert.equal(result.iva, 359.28);
  assert.equal(result.total, 2070.13);
});

test('un total guardado en cero no reemplaza el cÃ¡lculo de los Ã­tems', () => {
  const result = Budget.build({
    conIva: false,
    items: [{ qty: 3, punit: 8716, sub: 26148 }],
    subtotal: 0,
    total: 0
  });

  assert.equal(result.subtotal, 26148);
  assert.equal(result.total, 26148);
  assert.equal(result.conflicts.filter((entry) => entry.kind === 'subtotal-mismatch').length, 1);
  assert.equal(result.conflicts.filter((entry) => entry.kind === 'total-mismatch').length, 1);
});

test('un total histÃ³rico distinto se informa como conflicto y nunca se usa como fuente', () => {
  const result = Budget.build({
    conIva: true,
    items: [{ qty: 1, punit: 100000, sub: 100000 }],
    iva: 21000,
    total: 2900000000
  });

  assert.equal(result.total, 121000);
  assert.equal(result.conflicts.filter((entry) => entry.kind === 'total-mismatch').length, 1);
});

test('un presupuesto histÃ³rico con total pero sin Ã­tems no se imprime como cero vÃ¡lido', () => {
  const result = Budget.build({ total: 605692, items: [] });
  assert.equal(result.mode, 'legacy-total-only');
  assert.equal(result.ready, false);
  assert.equal(result.conflicts.some((entry) => entry.kind === 'total-without-items'), true);
});

test('la comparaciÃ³n sombra bloquea presupuestos con totales persistidos incoherentes', () => {
  const records = [{
    fbKey: '-ppto-1',
    conIva: false,
    items: [{ qty: 2, punit: 1000, sub: 2000 }],
    subtotal: 2000,
    descuentoAmt: 0,
    iva: 0,
    total: 0
  }];
  const comparison = ShadowComparison.compareBudgets(records, records);
  assert.equal(comparison.ready, false);
  assert.equal(comparison.comparisons[0].total.next, 2000);
});

test('la comparaciÃ³n sombra aprueba presupuestos sÃ³lo con todos sus importes iguales', () => {
  const records = [{
    fbKey: '-ppto-2',
    conIva: true,
    items: [{ qty: 1, punit: 1000, sub: 1000 }],
    subtotal: 1000,
    descuentoAmt: 0,
    iva: 210,
    total: 1210
  }];
  const comparison = ShadowComparison.compareBudgets(records, records);
  assert.equal(comparison.ready, true);
});

test('dos números comerciales iguales sólo se resuelven por fbKey', () => {
  const esteban = { fbKey: '-pres-esteban', id: 'PP-0031', cliente: 'ESTEBAN' };
  const sandra = { fbKey: '-pres-sandra', id: 'PP-0031', cliente: 'SANDRA' };
  const index = new IdentityIndex([esteban, sandra], {
    businessFields: ['id']
  });

  assert.equal(index.resolveTechnical('-pres-esteban').value, esteban);
  assert.equal(index.resolveTechnical('-pres-sandra').value, sandra);
  const ambiguous = index.resolveBusiness('pp-0031');
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.value, null);
  assert.equal(ambiguous.candidates.length, 2);
});

test('una referencia técnica vencida no cae a un número visible diferente', () => {
  const sale = { fbKey: '-sale-real', id: 'V-001' };
  const store = new DomainStore({ ventas: [sale] });
  const resolved = store.resolveSale({
    ventaFbKey: '-sale-eliminada',
    ventaId: 'V-001'
  });

  assert.equal(resolved.status, 'missing');
  assert.equal(resolved.matchedBy, 'technical');
  assert.equal(resolved.value, null);
});

test('la compatibilidad por nombre de cliente funciona sólo cuando es única', () => {
  const ana = { fbKey: '-ana', nombre: 'Ana Pérez' };
  const store = new DomainStore({ clientes: [ana] });
  assert.equal(store.resolveClient({ cliente: 'ana pérez' }).value, ana);

  store.replace('clientes', [
    ana,
    { fbKey: '-otra-ana', nombre: 'Ana Pérez' }
  ]);
  assert.equal(store.resolveClient({ cliente: 'Ana Pérez' }).status, 'ambiguous');
});

test('el KPI Para hoy y la tabla Hoy usan exactamente las mismas OT', () => {
  const records = [
    { fbKey: '-ot-1', id: 'OT-001', fechaProgramada: '24/07/2026', estado: 'Pendiente' },
    { fbKey: '-ot-2', id: 'OT-002', fecha: '2026-07-24', estado: 'En progreso' },
    { fbKey: '-ot-3', id: 'OT-003', fecha: '2026-07-24', estado: 'Completada' },
    { fbKey: '-ot-4', id: 'OT-004', fecha: '2026-07-25', estado: 'Pendiente' },
    { fbKey: '-ot-2', id: 'OT-002 duplicada', fecha: '2026-07-24', estado: 'Pendiente' }
  ];
  const model = OT.createReadModel(records, '2026-07-24');

  assert.equal(model.metrics.today, 2);
  assert.equal(model.filterPeriod('today').length, model.metrics.today);
  assert.deepEqual(model.todayRows.map((row) => row.fbKey), ['-ot-1', '-ot-2']);
  assert.equal(model.conflicts.filter((item) => item.kind === 'duplicate-technical-key').length, 1);
});

test('pagos se asignan por clave interna y los números duplicados quedan en conflicto', () => {
  const sales = [
    { fbKey: '-sale-a', id: 'V-100', total: 1000 },
    { fbKey: '-sale-b', id: 'V-100', total: 2000 }
  ];
  const payments = [
    { fbKey: '-pay-a', ventaFbKey: '-sale-a', ventaId: 'V-100', monto: 400 },
    { fbKey: '-pay-b', ventaId: 'V-100', monto: 900 },
    { fbKey: '-pay-stale', ventaFbKey: '-missing', ventaId: 'V-100', monto: 700 }
  ];
  const model = new SalesReadModel(sales, payments);

  assert.equal(model.summaryFor('-sale-a').paid, 400);
  assert.equal(model.summaryFor('-sale-a').balance, 600);
  assert.equal(model.summaryFor('-sale-b').paid, 0);
  assert.equal(model.audit().relations.filter((item) => item.kind === 'ambiguous-payment-sale').length, 1);
  assert.equal(model.audit().relations.filter((item) => item.kind === 'orphan-payment').length, 1);
});

test('un mismo pago técnico nunca se cuenta dos veces', () => {
  const sale = { fbKey: '-sale-a', id: 'V-101', total: 1000 };
  const payment = { fbKey: '-pay-a', ventaFbKey: '-sale-a', monto: 250 };
  const model = new SalesReadModel([sale], [payment, { ...payment }]);

  assert.equal(model.summaryFor(sale).paid, 250);
  assert.equal(model.audit().relations.filter((item) => item.kind === 'duplicate-payment').length, 1);
});

test('50.000 consultas sobre 10.000 ventas permanecen indexadas', () => {
  const sales = Array.from({ length: 10000 }, (_, index) => ({
    fbKey: `-sale-${index}`,
    id: `V-${index}`,
    total: index + 100
  }));
  const payments = sales.map((sale, index) => ({
    fbKey: `-payment-${index}`,
    ventaFbKey: sale.fbKey,
    monto: 10
  }));
  const start = performance.now();
  const model = new SalesReadModel(sales, payments);
  for (let index = 0; index < 50000; index += 1) {
    const summary = model.summaryFor(`-sale-${index % sales.length}`);
    assert.equal(summary.status, 'found');
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1500, `La prueba indexada tardó ${elapsed.toFixed(1)} ms`);
});

test('editar usa exclusivamente fbKey aunque dos presupuestos compartan número', async () => {
  const calls = [];
  const adapter = {
    list: async () => [],
    createKey: async () => '-generated',
    set: async (...args) => calls.push(['set', ...args]),
    update: async (...args) => calls.push(['update', ...args]),
    remove: async (...args) => calls.push(['remove', ...args])
  };
  const repository = new RecordRepository({
    collection: 'presupuestos',
    adapter
  });

  await repository.update(
    { fbKey: '-sandra', id: 'PP-0031' },
    { id: 'PP-0031', cliente: 'SANDRA SALEM' }
  );
  assert.deepEqual(calls[0], [
    'update',
    'presupuestos',
    '-sandra',
    { id: 'PP-0031', cliente: 'SANDRA SALEM' }
  ]);
});

test('el repositorio rechaza editar o eliminar mediante un número comercial', () => {
  const adapter = {
    list: async () => [],
    createKey: async () => '-generated',
    set: async () => {},
    update: async () => {},
    remove: async () => {}
  };
  const repository = new RecordRepository({ collection: 'ventas', adapter });

  assert.throws(() => repository.update({ id: 'V-100' }, { total: 1 }), /clave técnica/);
  assert.throws(() => repository.remove({ id: 'V-100' }), /clave técnica/);
});

test('crear ignora cualquier fbKey recibido y usa la clave generada por la base', async () => {
  const calls = [];
  const adapter = {
    list: async () => [],
    createKey: async () => '-generated-safe',
    set: async (...args) => calls.push(args),
    update: async () => {},
    remove: async () => {}
  };
  const repository = new RecordRepository({ collection: 'ventas', adapter });
  const created = await repository.create({ fbKey: 'V-EDITABLE', id: 'V-100', total: 10 });

  assert.equal(created.fbKey, '-generated-safe');
  assert.equal(calls[0][1], '-generated-safe');
  assert.equal(calls[0][2].id, 'V-100');
});

test('la auditoría detecta duplicados, relaciones ambiguas y huérfanas sin escribir', () => {
  const report = MigrationAudit.run({
    clientes: [
      { fbKey: '-client-a', nombre: 'CLIENTE REPETIDO' },
      { fbKey: '-client-b', nombre: 'CLIENTE REPETIDO' }
    ],
    presupuestos: [
      { fbKey: '-budget-a', id: 'PP-0031', cliente: 'CLIENTE REPETIDO' },
      { fbKey: '-budget-b', id: 'PP-0031', clienteFbKey: '-missing-client' }
    ],
    ventas: [
      { fbKey: '-sale-a', id: 'V-1', clienteFbKey: '-client-a' }
    ],
    pagos: [
      { fbKey: '-payment-a', ventaFbKey: '-missing-sale', monto: 100 }
    ],
    ordenesTrabajo: [
      { fbKey: '-ot-a', id: 'OT-1', clienteFbKey: '-client-a', ventaFbKey: '-missing-sale' }
    ]
  }, { today: '2026-07-24' });

  assert.ok(report.summary.identityIssues >= 2);
  assert.ok(report.summary.relationIssues >= 3);
  assert.equal(report.summary.paymentIssues, 1);
  assert.ok(report.summary.totalIssues >= 6);
});

test('el adaptador legacy conserva la clave Firebase de colecciones por objeto', () => {
  const snapshot = LegacySnapshot.create({
    ventasData: {
      '-sale-a': { id: 'V-1', total: 100 },
      '-sale-b': { fbKey: '-sale-existing', id: 'V-2', total: 200 }
    },
    pptoData: [{ fbKey: '-budget-a', id: 'PP-1' }]
  });

  assert.equal(snapshot.ventas[0].fbKey, '-sale-a');
  assert.equal(snapshot.ventas[1].fbKey, '-sale-existing');
  assert.equal(snapshot.presupuestos[0].fbKey, '-budget-a');
});

test('la comparación sombra no habilita migración cuando difieren métricas', () => {
  const result = ShadowComparison.compareOT([
    { fbKey: '-ot-a', fecha: '2026-07-24', estado: 'Pendiente' }
  ], '2026-07-24', {
    open: 1,
    today: 4,
    completed: 0
  });

  assert.equal(result.ready, false);
  assert.equal(result.differences.find((item) => item.name === 'today').delta, -3);
});

test('la comparación sombra habilita ventas sólo con totales y relaciones iguales', () => {
  const result = ShadowComparison.compareSales([
    { fbKey: '-sale-a', id: 'V-1', total: 1000 }
  ], [
    { fbKey: '-payment-a', ventaFbKey: '-sale-a', monto: 300 }
  ], [
    { fbKey: '-sale-a', total: 1000, paid: 300, balance: 700 }
  ]);

  assert.equal(result.ready, true);
  assert.equal(result.comparisons[0].balance.equal, true);
});

test('una foto se registra recién después de confirmar la subida', async () => {
  const events = [];
  const adapter = {
    upload: async ({ ownerKey, onProgress }) => {
      events.push(`upload:${ownerKey}`);
      onProgress(45);
      return { url: 'storage://ot/-ot-a/photo.jpg', size: 123 };
    },
    saveMetadata: async ({ ownerKey, uploaded }) => {
      events.push(`metadata:${ownerKey}:${uploaded.url}`);
      return { fbKey: '-attachment-a' };
    }
  };
  const states = [];
  const task = new AttachmentTask({
    adapter,
    ownerCollection: 'ordenesTrabajo',
    ownerKey: '-ot-a',
    kind: 'foto-tecnica',
    file: { name: 'photo.jpg' },
    onChange: (state) => states.push(state.state)
  });
  const result = await task.start();

  assert.deepEqual(events, [
    'upload:-ot-a',
    'metadata:-ot-a:storage://ot/-ot-a/photo.jpg'
  ]);
  assert.equal(result.metadata.fbKey, '-attachment-a');
  assert.equal(task.state, 'completed');
  assert.ok(states.includes('uploading'));
  assert.ok(states.includes('saving'));
  assert.ok(states.includes('completed'));
});

test('cancelar una subida evita guardar metadatos y termina la espera', async () => {
  let metadataCalls = 0;
  const adapter = {
    upload: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortada')));
    }),
    saveMetadata: async () => { metadataCalls += 1; }
  };
  const task = new AttachmentTask({
    adapter,
    ownerCollection: 'ordenesTrabajo',
    ownerKey: '-ot-a',
    kind: 'foto-tecnica',
    file: { name: 'photo.jpg' }
  });
  const running = task.start();
  assert.equal(task.cancel('Cancelada para volver a intentar'), true);
  await assert.rejects(running, /abortada|cancelada/i);

  assert.equal(task.state, 'cancelled');
  assert.equal(metadataCalls, 0);
});

test('el tiempo límite cancela una subida detenida', async () => {
  const adapter = {
    upload: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('abortada por tiempo límite')));
    }),
    saveMetadata: async () => {}
  };
  const task = new AttachmentTask({
    adapter,
    ownerCollection: 'facturas',
    ownerKey: '-invoice-a',
    kind: 'comprobante',
    file: { name: 'invoice.pdf' },
    timeoutMs: 20
  });

  await assert.rejects(task.start(), /abortada|cancelada/i);
  assert.equal(task.state, 'cancelled');
  assert.match(task.error.message, /tiempo límite/i);
});

test('una respuesta vieja no puede contaminar una sesión nueva', () => {
  const lifecycle = new DataLifecycle(['ventas', 'clientes']);
  const firstGeneration = lifecycle.beginSession();
  lifecycle.loading('ventas', firstGeneration);
  const secondGeneration = lifecycle.beginSession();

  assert.equal(lifecycle.ready('ventas', firstGeneration), false);
  assert.equal(lifecycle.snapshot().collections.ventas.state, 'idle');
  assert.equal(lifecycle.ready('ventas', secondGeneration), true);
  assert.equal(lifecycle.canRenderPrivateUI(), false);
  assert.equal(lifecycle.ready('clientes', secondGeneration), true);
  assert.equal(lifecycle.canRenderPrivateUI(), true);
});

test('cerrar sesión invalida cargas pendientes y oculta datos privados', () => {
  const lifecycle = new DataLifecycle(['ventas']);
  const generation = lifecycle.beginSession();
  lifecycle.loading('ventas', generation);
  lifecycle.endSession();

  assert.equal(lifecycle.ready('ventas', generation), false);
  assert.equal(lifecycle.snapshot().sessionState, 'signed-out');
  assert.equal(lifecycle.canRenderPrivateUI(), false);
});

test('ningún módulo v3 toma control solo por aprobar la comparación sombra', () => {
  const report = {
    gates: {
      presupuestos: true,
      ventasPagos: true,
      ordenesTrabajo: false
    }
  };
  const shadow = new FeatureGates({ allowed: ['presupuestos'] });
  shadow.update(report);
  assert.equal(shadow.decision('presupuestos').active, false);
  assert.equal(shadow.decision('presupuestos').reason, 'shadow-only');

  const active = new FeatureGates({ mode: 'active', allowed: ['presupuestos'] });
  active.update(report);
  assert.equal(active.decision('presupuestos').active, true);
  assert.equal(active.decision('ventasPagos').active, false);
  assert.equal(active.decision('ordenesTrabajo').reason, 'shadow-blocked');
});
