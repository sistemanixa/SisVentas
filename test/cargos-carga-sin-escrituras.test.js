const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const index = fs.readFileSync('index.html', 'utf8');
const appPath = index.match(/src=["']\.\/([^"]*app\.v[^"']+\.js)/)[1];
const app = fs.readFileSync(appPath, 'utf8');
const source = app.slice(app.indexOf('function cargarCargos()'), app.indexOf('function _cargoHistorialValorHora('));
let listener;
let subscriptions = 0;
const writes = [];
const context = {
  CARGOS_DATA: {},
  renderCargosConfig() {},
  window: {
    fbDB: {},
    fbRef: (_, path) => path,
    fbOnValue: (_, callback) => { listener = callback; subscriptions++; },
    fbSet: (...args) => writes.push(args),
    fbUpdate: (...args) => writes.push(args)
  }
};
vm.createContext(context);
vm.runInContext(source + '\ncargarCargos(); cargarCargos();', context);
assert.equal(subscriptions, 1);
const custom = { tecnico_b: { valorHora: 6450, valorHoraExtra: 6200 } };
for (const value of [null, custom, null, {}, custom]) {
  listener({ val: () => value });
  assert.equal(writes.length, 0, 'Ni vacío ni reconexión deben escribir tarifas');
}
assert.equal(context.CARGOS_DATA.tecnico_b.valorHoraExtra, 6200,
  'Conserva una tarifa independiente; no aplica porcentaje ni la iguala');
console.log('OK: carga vacía, reconexión y tarifa independiente sin escrituras');
