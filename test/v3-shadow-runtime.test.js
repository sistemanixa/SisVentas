const test = require('node:test');
const assert = require('node:assert/strict');

const ShadowRuntime = require('../js/v3-shadow-runtime.js');

function fakeDocument() {
  const listeners = new Map();
  return {
    readyState: 'complete',
    addEventListener(name, callback) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    dispatchEvent(event) {
      const callbacks = listeners.get(event.type) || [];
      callbacks.forEach((callback) => callback(event));
    }
  };
}

function fakeRoot(search = '') {
  const document = fakeDocument();
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ['2026-07-24T12:00:00-03:00']));
    }
  }
  class FakeEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options && options.detail;
    }
  }
  const sale = {
    fbKey: '-sale-a',
    id: 'V-1',
    clienteFbKey: '-client-a',
    total: 1000
  };
  const payment = {
    fbKey: '-payment-a',
    ventaFbKey: '-sale-a',
    monto: 300
  };
  return {
    location: { search },
    document,
    CustomEvent: FakeEvent,
    Date: FixedDate,
    clientesData: [{ fbKey: '-client-a', nombre: 'CLIENTE A' }],
    empData: [],
    prodData: {},
    pptoData: [{
      fbKey: '-budget-a',
      id: 'PP-1',
      clienteFbKey: '-client-a',
      conIva: false,
      items: [{ cod: 'P-1', desc: 'EQUIPO', qty: 1, punit: 1000, sub: 1000 }],
      subtotal: 1000,
      descuentoAmt: 0,
      iva: 0,
      total: 1000
    }],
    ventasList: [sale],
    _historialPagosCompleto: [payment],
    otData: [{
      fbKey: '-ot-a',
      id: 'OT-1',
      clienteFbKey: '-client-a',
      ventaFbKey: '-sale-a',
      fecha: '2026-07-24',
      estado: 'Pendiente'
    }],
    svEstadoCargaInicial: () => ({ completo: true }),
    _svMontoPagadoVenta: () => 300,
    _svSaldoPendienteVenta: () => 700,
    SisVentas: {
      Metrics: {
        ot: () => ({
          abiertas: 1,
          hoy: 1,
          completadasTotal: 0
        })
      }
    },
    setTimeout,
    clearTimeout
  };
}

test('el modo sombra permanece inactivo sin query ni habilitación manual', () => {
  const runtime = ShadowRuntime.create(fakeRoot(), { autoStart: false });
  assert.equal(runtime.status().enabled, false);
  assert.equal(runtime.status().phase, 'idle');
  assert.equal(runtime.status().runCount, 0);
});

test('la auditoría sombra compara los mismos datos sin modificarlos', async () => {
  const root = fakeRoot('?v3_shadow=1');
  const originalSale = JSON.stringify(root.ventasList);
  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.equal(report.gates.presupuestos, true);
  assert.equal(report.gates.ventasPagos, true);
  assert.equal(report.gates.ordenesTrabajo, true);
  assert.equal(report.ready, true);
  assert.equal(report.comparisons.ventasPagos.sampleSize, 1);
  assert.equal(JSON.stringify(root.ventasList), originalSale);
  assert.equal(runtime.status().runCount, 1);
});

test('una diferencia entre KPI y tabla de OT bloquea la migración', async () => {
  const root = fakeRoot();
  root.SisVentas.Metrics.ot = () => ({
    abiertas: 1,
    hoy: 4,
    completadasTotal: 0
  });
  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.equal(report.ready, false);
  assert.equal(report.gates.ordenesTrabajo, false);
  const today = report.comparisons.ordenesTrabajo.differences
    .find((difference) => difference.name === 'today');
  assert.equal(today.delta, -3);
});

test('el informe resume identidad sin publicar datos personales', async () => {
  const root = fakeRoot();
  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.deepEqual(report.issues.identity.presupuestos, {
    technical: 0,
    business: 0,
    names: 0,
    missingTechnical: 0
  });
  assert.equal(JSON.stringify(report).includes('CLIENTE A'), false);
});

test('la espera de datos termina con error en vez de reintentar para siempre', async () => {
  const root = fakeRoot();
  root.svEstadoCargaInicial = () => ({ completo: false });
  const runtime = ShadowRuntime.create(root, {
    autoStart: false,
    readyTimeoutMs: 5,
    retryDelayMs: 1
  });

  runtime.enable();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(runtime.status().phase, 'error');
  assert.match(runtime.status().lastError, /tiempo esperado/i);
});

test('una relacion cruzada del recorrido bloquea el modulo aunque sus totales coincidan', async () => {
  const root = fakeRoot();
  root._historialPagosCompleto[0].clienteFbKey = '-client-b';
  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.equal(report.gates.presupuestos, true);
  assert.equal(report.gates.ventasPagos, false);
  assert.ok(report.issues.journeys.some((issue) =>
    issue.kind === 'crossed-client' && issue.stage === 'pago-venta-cliente'
  ));
});

test('la activacion manual del runtime siempre admite rollback inmediato', async () => {
  const root = fakeRoot();
  const runtime = ShadowRuntime.create(root, { autoStart: false });
  await runtime.run();

  assert.equal(runtime.activate('ventasPagos').active, true);
  assert.equal(runtime.activationStatus().modules.ventasPagos.active, true);

  const rolledBack = runtime.rollback();
  assert.equal(rolledBack.mode, 'shadow');
  assert.equal(rolledBack.modules.ventasPagos.active, false);
  assert.deepEqual(rolledBack.allowed, []);
});

test('productos y proveedores sólo habilitan su compuerta cuando coinciden con la pantalla actual', async () => {
  const root = fakeRoot();
  const product = {
    fbKey: '-product-a',
    codigo: 'P-1',
    proveedores: [{
      proveedorKey: '-provider-a',
      nombre: 'BIOSEGUR',
      url: 'https://biosegur.com.ar/producto',
      actualizadoEn: Date.now()
    }]
  };
  root.prodData = { '-product-a': product };
  root.proveedoresData = [{ fbKey: '-provider-a', nombre: 'BIOSEGUR', activo: true }];
  root.productosBiosegurActualizables = () => [{
    producto: product,
    proveedor: product.proveedores[0],
    tipo: 'biosegur'
  }];
  root.estadoVigenciaPrecioProveedor = () => ({ vigente: true });

  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.equal(report.gates.productosProveedores, true);
  assert.equal(report.comparisons.productosProveedores.ready, true);
  assert.equal(report.comparisons.productosProveedores.differences.every((entry) => entry.equal), true);
});

test('una diferencia del actualizador actual bloquea productos sin alterar los otros módulos', async () => {
  const root = fakeRoot();
  root.prodData = {
    '-product-a': {
      fbKey: '-product-a',
      proveedores: [{
        proveedorKey: '-provider-a',
        nombre: 'BIOSEGUR',
        url: 'https://biosegur.com.ar/producto'
      }]
    }
  };
  root.proveedoresData = [{ fbKey: '-provider-a', nombre: 'BIOSEGUR', activo: true }];
  root.productosBiosegurActualizables = () => [];
  root.estadoVigenciaPrecioProveedor = () => ({ vigente: false });

  const runtime = ShadowRuntime.create(root, { autoStart: false });
  const report = await runtime.run();

  assert.equal(report.gates.productosProveedores, false);
  assert.equal(report.gates.presupuestos, true);
  assert.equal(report.gates.ventasPagos, true);
  assert.equal(report.gates.ordenesTrabajo, true);
  assert.equal(report.comparisons.productosProveedores.differences
    .find((entry) => entry.name === 'automatableProducts').equal, false);
});
