const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'js', 'app.v2.0.289.js');
const app = fs.readFileSync(appPath, 'utf8');

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

test('nuevos formularios limpian identidad de edición y los editores la restauran', () => {
  const nuevoCliente = sourceOfFunction('abrirModalNuevo');
  const editarCliente = sourceOfFunction('editarCliente');
  const cerrarCliente = sourceOfFunction('cerrarModalNuevoGenerico');
  const nuevoPpto = sourceOfFunction('abrirNuevoPresupuesto');
  const editarPpto = sourceOfFunction('abrirEditorPpto');

  assert.match(nuevoCliente, /if \(tipo === 'cliente'\) window\._editingClienteId = null/);
  assert.ok(editarCliente.indexOf("abrirModalNuevo('cliente')") < editarCliente.indexOf('window._editingClienteId ='));
  assert.match(cerrarCliente, /if \(tipoCerrado === 'cliente'\) window\._editingClienteId = null/);
  assert.match(nuevoPpto, /window\._pptoEditandoFbKey = null/);
  assert.ok(editarPpto.indexOf('abrirNuevoPresupuesto()') < editarPpto.indexOf('window._pptoEditandoFbKey ='));
});

test('confirmarVenta es de una sola ejecución y reserva el número antes de guardar', () => {
  const confirmar = sourceOfFunction('confirmarVenta');
  assert.match(confirmar, /if \(window\._ventaGuardadoEnCurso\)/);
  assert.match(confirmar, /window\._ventaGuardadoEnCurso = true/);
  assert.match(confirmar, /await reservarSiguienteVentaId\(\)/);
  assert.match(confirmar, /await fbGuardarVenta\(nuevaVenta\)/);
  assert.match(confirmar, /finally \{[\s\S]*window\._ventaGuardadoEnCurso = false/);
  assert.doesNotMatch(confirmar, /guardarPromise/);
  assert.match(sourceOfFunction('pptoAccion'), /numVenta = await reservarSiguienteVentaId\(\)/);
  assert.match(sourceOfFunction('otConfirmarVentaAdicional'), /idVentaAdicional = await reservarSiguienteVentaId\(\)/);
});

test('la reserva de ventas usa una transacción compartida y da números distintos en dos altas concurrentes', async () => {
  let contador = 41;
  let cola = Promise.resolve();
  const sandbox = {
    ventasList: [],
    window: {
      fbDB: {},
      fbRef: (_db, ruta) => ruta,
      fbRunTransaction: (_ref, actualizar) => {
        const operacion = cola.then(() => {
          contador = actualizar(contador);
          return { snapshot: { val: () => contador } };
        });
        cola = operacion.then(() => undefined, () => undefined);
        return operacion;
      }
    },
    Promise,
    Math,
    String,
    parseInt,
    Error
  };
  vm.runInNewContext(sourceOfFunction('_maxNumeroVentaLocal') + '\n' + sourceOfFunction('reservarSiguienteVentaId'), sandbox);
  const [primera, segunda] = await Promise.all([
    sandbox.reservarSiguienteVentaId(),
    sandbox.reservarSiguienteVentaId()
  ]);
  assert.deepEqual([primera, segunda], ['#V-000042', '#V-000043']);
});
