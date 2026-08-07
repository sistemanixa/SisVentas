const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.290.js'), 'utf8');

function sourceOfFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'No se encontró ' + name);
  const firstBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Función incompleta: ' + name);
}

function serialTransactionStore(initial) {
  let value = initial;
  let queue = Promise.resolve();
  return {
    run(_ref, update) {
      const operation = queue.then(() => {
        const next = update(value);
        const committed = next !== undefined;
        if (committed) value = next;
        return { committed, snapshot: { val: () => value } };
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    },
    value: () => value
  };
}

test('informes: nuevo limpia identidad y editar la restaura luego de preparar el formulario', () => {
  const nuevo = sourceOfFunction('abrirNuevoInforme');
  const editar = sourceOfFunction('editarInforme');
  const volver = sourceOfFunction('volverListaInformes');
  const guardar = sourceOfFunction('guardarInforme');
  assert.match(nuevo, /informeActualId = null/);
  assert.match(volver, /informeActualId = null/);
  assert.ok(editar.indexOf('abrirNuevoInforme()') < editar.indexOf('informeActualId = fbKey'));
  assert.match(guardar, /informeActualId\s*\?\s*window\.fbUpdate[\s\S]*:\s*window\.fbPush/);
});

test('cobros: dos intentos concurrentes contra el mismo saldo dejan un comprobante y un resumen coherente', async () => {
  const store = serialTransactionStore({ ventas: { v1: { total: 100, totalPagado: 0 } }, pagos: {} });
  const sandbox = {
    window: { fbDB: {}, fbRef: (_db, route) => route, fbRunTransaction: store.run.bind(store) },
    Promise, Date, Math, Object, parseFloat, Error
  };
  vm.runInNewContext(sourceOfFunction('_registrarCobroAtomico'), sandbox);
  const [first, second] = await Promise.allSettled([
    sandbox._registrarCobroAtomico('v1', { monto: 100 }),
    sandbox._registrarCobroAtomico('v1', { monto: 100 })
  ]);
  assert.equal([first, second].filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(store.value().ventas.v1.totalPagado, 100);
  assert.equal(Object.keys(store.value().pagos).length, 1);
});

test('pagos de gastos: dos intentos concurrentes no duplican historial ni montoPagado', async () => {
  const store = serialTransactionStore({ monto: 100, montoPagado: 0, pagos: {} });
  const sandbox = {
    gastosData: [{ fbKey: 'g1', monto: 100 }], currentUser: 'admin', currentRole: 'admin',
    window: { fbDB: {}, fbRef: (_db, route) => route, fbRunTransaction: store.run.bind(store) },
    Promise, Date, Math, Object, parseFloat, Error,
    pagoGastoEstaAnulado: () => false,
    _actualizarCtaEmpPorPagoGasto: () => {}
  };
  vm.runInNewContext(sourceOfFunction('_registrarPagoGastoUnitario'), sandbox);
  const results = await Promise.allSettled([
    sandbox._registrarPagoGastoUnitario('g1', 100, 'Efectivo', null, null),
    sandbox._registrarPagoGastoUnitario('g1', 100, 'Efectivo', null, null)
  ]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(store.value().montoPagado, 100);
  assert.equal(Object.keys(store.value().pagos).length, 1);
});

test('conversión de presupuesto: dos sesiones obtienen la misma venta y reservan un solo número', async () => {
  const store = serialTransactionStore({
    presupuestos: { pp1: { id: 'PP-0001', audit: [] } }, ventas: {}, contadores: { venta: 9 }
  });
  const sandbox = {
    window: { fbDB: {}, fbRef: (_db, route) => route, fbRunTransaction: store.run.bind(store) },
    ventasList: [], Promise, Date, Math, Object, String, parseInt, Error
  };
  vm.runInNewContext(sourceOfFunction('_maxNumeroVentaLocal') + '\n' + sourceOfFunction('_convertirPresupuestoEnVentaAtomico'), sandbox);
  const base = { cliente: 'Cliente', total: 100, items: [] };
  const audit = { fecha: 'hoy', usuario: 'admin', accion: 'Convertido' };
  const [a, b] = await Promise.all([
    sandbox._convertirPresupuestoEnVentaAtomico({ fbKey: 'pp1', id: 'PP-0001' }, base, audit),
    sandbox._convertirPresupuestoEnVentaAtomico({ fbKey: 'pp1', id: 'PP-0001' }, base, audit)
  ]);
  assert.equal(a.ventaFbKey, b.ventaFbKey);
  assert.equal(Object.keys(store.value().ventas).length, 1);
  assert.equal(store.value().contadores.venta, 10);
  assert.equal(store.value().presupuestos.pp1.ventaGeneradaFbKey, a.ventaFbKey);
});

test('las rutas normales siguen protegidas: UI en curso, finally y conversión transaccional', () => {
  const cobro = sourceOfFunction('registrarPago');
  const gasto = sourceOfFunction('confirmarPagoGasto');
  const ppto = sourceOfFunction('pptoAccion');
  assert.match(cobro, /window\._cobroGuardadoEnCurso/);
  assert.match(cobro, /\.finally\(function\(\)\{ window\._cobroGuardadoEnCurso = false/);
  assert.match(gasto, /window\._pagoGastoGuardadoEnCurso/);
  assert.match(gasto, /\.finally\(function\(\)\{ window\._pagoGastoGuardadoEnCurso = false/);
  assert.match(ppto, /await _convertirPresupuestoEnVentaAtomico/);
});
