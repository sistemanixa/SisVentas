const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v2.0.291.js', 'utf8');
const start = source.indexOf('function _buscarOTCanonicaPorClave');
const end = source.indexOf('function spPasarAVisitaYGenerarOT', start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);

const context = { String, Object, Array, Promise, parseInt, console, window: {}, ventasList: [], otData: [] };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

test('un vínculo de OT sólo se considera válido si el registro existe y conserva su número', () => {
  context.otData = [{ fbKey: 'ot-a', id: 'OT-072', reclamoKey: 'r-1' }];
  assert.equal(context._buscarOTCanonicaPorClave('ot-a', 'OT-072').id, 'OT-072');
  assert.equal(context._buscarOTCanonicaPorClave('ot-inexistente', 'OT-999'), null);
});

test('la venta se resuelve por claves reales de venta u OT, no por nombre de cliente', () => {
  context.ventasList = [{ fbKey: 'v-a', id: '#SP-1', cliente: 'JUAN', reclamoKey: 'r-1' }];
  assert.equal(context._buscarVentaCanonicaReclamo({ ventaKey: 'v-a', cliente: 'OTRO' }, null).fbKey, 'v-a');
  assert.equal(context._buscarVentaCanonicaReclamo({ ventaKey: 'v-inexistente', cliente: 'JUAN' }, null), null);
});

test('las candidatas para reparación requieren una referencia exacta del reclamo', () => {
  const reclamo = { fbKey: 'r-1', cliente: 'JUAN' };
  context.otData = [{ fbKey: 'ot-a', reclamoKey: 'r-1' }, { fbKey: 'ot-b', cliente: 'JUAN' }];
  context.ventasList = [{ fbKey: 'v-a', reclamoFbKey: 'r-1' }, { fbKey: 'v-b', cliente: 'JUAN' }];
  assert.deepEqual(context._candidatasOTReclamo(reclamo).map(x => x.fbKey), ['ot-a']);
  assert.deepEqual(context._candidatasVentaReclamo(reclamo, null).map(x => x.fbKey), ['v-a']);
});

test('el flujo exige producto de visita configurado y protege borrados vinculados', () => {
  assert.match(source, /function spProductoVisitaTecnicaConfigurado/);
  assert.match(source, /productoVisitaTecnicaFbKey/);
  assert.match(source, /Repará o cerrá primero ese vínculo desde Reclamos/);
  assert.match(source, /Vínculo de OT roto/);
  assert.match(source, /Vínculo de venta roto/);
});
