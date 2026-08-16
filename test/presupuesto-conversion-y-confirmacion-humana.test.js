const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function sourceOfFunction(name) {
  const markers = ['async function ' + name + '(', 'function ' + name + '('];
  const start = markers.map(marker => app.indexOf(marker)).find(index => index >= 0);
  assert.notEqual(start, undefined, 'No se encontró ' + name);
  const firstBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Función incompleta: ' + name);
}

function memoryFirebase(initial) {
  const root = structuredClone(initial);
  const transactionRoutes = [];
  function parts(route) { return String(route || '').split('/').filter(Boolean); }
  function read(route) {
    return parts(route).reduce((value, key) => value == null ? value : value[key], root);
  }
  function write(route, value) {
    const keys = parts(route);
    let cursor = root;
    keys.slice(0, -1).forEach(key => { cursor[key] = cursor[key] || {}; cursor = cursor[key]; });
    const last = keys[keys.length - 1];
    if (value === null) delete cursor[last];
    else cursor[last] = structuredClone(value);
  }
  return {
    root,
    transactionRoutes,
    ref: (_db, route) => route,
    get: async route => ({ val: () => structuredClone(read(route)) }),
    update: async (route, updates) => {
      Object.entries(updates).forEach(([relative, value]) => write([route, relative].filter(Boolean).join('/'), value));
    },
    transaction: async (route, updater) => {
      transactionRoutes.push(route);
      const current = structuredClone(read(route));
      const next = updater(current);
      if (next === undefined) return { committed:false, snapshot:{ val:() => structuredClone(current) } };
      write(route, next);
      return { committed:true, snapshot:{ val:() => structuredClone(read(route)) } };
    }
  };
}

test('la conversión usa un bloqueo acotado y una escritura multipath idempotente', async () => {
  const db = memoryFirebase({
    sisventas:{ presupuestos:{ pp1:{ id:'PP-0001', audit:[] } }, ventas:{}, contadores:{ venta:9 } }
  });
  const sandbox = {
    window:{ fbDB:{}, fbRef:db.ref, fbGet:db.get, fbUpdate:db.update, fbRunTransaction:db.transaction },
    FB_PATHS:{ presupuestos:'sisventas/presupuestos', ventas:'sisventas/ventas' },
    ventasList:[], currentUser:'Admin', currentUserEmail:'',
    Promise, Date, Math, Object, Array, String, parseInt, Error
  };
  vm.runInNewContext(
    sourceOfFunction('_maxNumeroVentaLocal') + '\n' +
    sourceOfFunction('_resultadoConversionPresupuestoExistente') + '\n' +
    sourceOfFunction('_convertirPresupuestoEnVentaAtomico'),
    sandbox
  );
  const base = { cliente:'Cliente', total:100, items:[] };
  const audit = { fecha:'hoy', usuario:'Admin', accion:'Convertido' };
  const first = await sandbox._convertirPresupuestoEnVentaAtomico({ fbKey:'pp1', id:'PP-0001' }, base, audit);
  const second = await sandbox._convertirPresupuestoEnVentaAtomico({ fbKey:'pp1', id:'PP-0001' }, base, audit);

  assert.equal(first.ventaFbKey, 'ppto_pp1');
  assert.equal(second.ventaFbKey, first.ventaFbKey);
  assert.equal(second.reutilizada, true);
  assert.equal(Object.keys(db.root.sisventas.ventas).length, 1);
  assert.equal(db.root.sisventas.contadores.venta, 10);
  assert.equal(db.root.sisventas.presupuestos.pp1.estado, 'convertido');
  assert.equal(db.transactionRoutes.includes('sisventas'), false, 'no debe transaccionar toda la base');
  assert.equal(db.transactionRoutes.filter(route => route === 'sisventas/contadores/venta').length, 1);
});

test('confirmar que es el mismo producto también autoriza una variación excepcional', () => {
  const sandbox = {
    parsePrecioProveedorARS:value => Number(value) || 0,
    _costoProveedorProductoSinAuditar:() => 100,
    precioGremioARSDesdeProducto:() => 100,
    factorIvaProveedorProducto:() => 1,
    obtenerDolarReferenciaProducto:() => ({ valor:1510 }),
    _relacionCercanaProducto:() => false,
    Object, String, Number, Math, parseFloat, isFinite
  };
  vm.runInNewContext(sourceOfFunction('validarResultadoActualizadorProveedor'), sandbox);
  const item = { producto:{}, proveedor:{} };
  const result = {
    precioArs:1000,
    moneda:'ARS',
    selectorPrecio:'api',
    identidad:{ ok:true, manual:true }
  };
  assert.equal(sandbox.validarResultadoActualizadorProveedor(item, result).ok, false);
  assert.equal(sandbox.validarResultadoActualizadorProveedor(item, result, { confirmacionHumanaCompleta:true }).ok, true);
  assert.match(app, /variacionAprobadaPor = currentUser/);
  assert.match(app, /identidadConfirmadaUrl = String\(item\.url/);
});
