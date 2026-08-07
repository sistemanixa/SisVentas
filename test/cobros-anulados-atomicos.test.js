const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.0.301.js'), 'utf8');

function sourceOfFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'No se encontr\u00f3 ' + name);
  const firstBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Funci\u00f3n incompleta: ' + name);
}

function transactionStore(initial) {
  let value = initial;
  return {
    run(_ref, update) {
      const next = update(value);
      const committed = next !== undefined;
      if (committed) value = next;
      return Promise.resolve({ committed, snapshot: { val: () => value } });
    },
    value: () => value
  };
}

test('cobros: un comprobante anulado por estado no consume el saldo disponible', async () => {
  const store = transactionStore({
    ventas: { ventaA: { id: '#V-910108', total: 1353009, totalPagado: 0 } },
    pagos: {
      cobroAnulado: { ventaId: '#V-910108', monto: 1353009, estado: 'anulado' }
    }
  });
  const sandbox = {
    window: { fbDB: {}, fbRef: (_db, route) => route, fbRunTransaction: store.run.bind(store) },
    Promise, Date, Math, Object, parseFloat, String, Error
  };
  vm.runInNewContext(sourceOfFunction('_registrarCobroAtomico'), sandbox);

  const resultado = await sandbox._registrarCobroAtomico('ventaA', { monto: 900000 });

  assert.equal(resultado.venta.totalPagado, 900000);
  assert.equal(resultado.pago.saldoAnterior, 1353009);
  assert.equal(resultado.pago.saldoRestante, 453009);
});

test('cobros: a legacy sale without a saved total uses its real line items', async () => {
  const store = transactionStore({
    ventas: {
      ventaA: {
        id: '#V-910108', total: 0, descuento: 50000, conIva: false,
        items: [
          { qty: 1, punit: 1000000 },
          { qty: 1, punit: 403009 }
        ]
      }
    },
    pagos: {}
  });
  const sandbox = {
    window: { fbDB: {}, fbRef: (_db, route) => route, fbRunTransaction: store.run.bind(store) },
    Promise, Date, Math, Object, parseFloat, String, Number, Error, isFinite
  };
  vm.runInNewContext(sourceOfFunction('_registrarCobroAtomico'), sandbox);

  const resultado = await sandbox._registrarCobroAtomico('ventaA', { monto: 900000 });

  assert.equal(resultado.venta.total, 1353009);
  assert.equal(resultado.venta.totalPagado, 900000);
  assert.equal(resultado.pago.saldoRestante, 453009);
});

test('publicacion: el archivo activo y su version interna son la misma version', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const active = index.match(/src="\.\/js\/(app\.v[\d.]+\.js)"/);
  assert.ok(active, 'index debe cargar una aplicación versionada');
  const activeSource = fs.readFileSync(path.join(__dirname, '..', 'js', active[1]), 'utf8');
  const fromFile = active[1].match(/app\.(v[\d.]+)\.js/)[1];
  const fromConfig = activeSource.match(/VERSION:\s*'(v[\d.]+)-firebase'/)[1];
  const fromIndex = index.match(/VERSION:\s*'(v[\d.]+)-firebase'/)[1];
  assert.equal(fromConfig, fromFile);
  assert.equal(fromIndex, fromFile);
});
