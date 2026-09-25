const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { readActiveApp } = require('./helpers/active-app');

const app = readActiveApp().source;
const treasury = fs.readFileSync('js/modules/treasury.js', 'utf8');

test('el acceso flotante de administración abre el mismo alta de Gastos', () => {
  const inicio = app.indexOf('function fabAccion(tipo)');
  const fin = app.indexOf("document.addEventListener('click'", inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /puedeAdministrarGastos\(\)/);
  assert.match(bloque, /svNavegarDirecto\('gastos',[\s\S]*abrirFormGasto\(null\)/);
  assert.ok(bloque.indexOf('puedeAdministrarGastos()') < bloque.indexOf("tienePermiso('gastos.cargarPropio')"));
});

test('las altas pagadas generan un pago visible para Tesorería', () => {
  const rapido = app.slice(app.indexOf('function guardarGastoRapido'), app.indexOf('// CUENTA CORRIENTE EMPLEADOS'));
  const completo = app.slice(app.indexOf('function guardarGastoCompleto'), app.indexOf('var _gastoFbKeyPago'));
  assert.match(rapido, /datos\.pagos\['pago_inicial_' \+ ahora\]/);
  assert.match(rapido, /origen: 'gasto_rapido'/);
  assert.match(completo, /!gastoActualFbKey && pagado > 0/);
  assert.match(completo, /datos\.pagos\['pago_inicial_' \+ pagoInicialTs\]/);
});

test('Tesorería recupera gastos históricos pagados sin nodo pagos', () => {
  const document = { getElementById(){ return null; }, addEventListener(){} };
  const context = { window:{ gastosData:[], movsEmpData:[] }, document, CustomEvent:function(){} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(treasury, context);
  context.window.gastosData = [{
    fbKey:'gasto-viejo', descripcion:'Combustible', categoria:'Transporte',
    fecha:'2026-09-25', monto:15000, montoPagado:15000,
    estado:'pagado', medio:'Efectivo', usuario:'Admin', ts:123
  }];
  const pagos = context.window._tesoreriaPagos();
  assert.equal(pagos.length, 1);
  assert.equal(pagos[0].gastoKey, 'gasto-viejo');
  assert.equal(pagos[0].monto, 15000);
  assert.equal(pagos[0].origenLegacy, true);
});

test('Tesorería no duplica un gasto que ya tiene pagos canónicos', () => {
  const document = { getElementById(){ return null; }, addEventListener(){} };
  const context = { window:{ gastosData:[], movsEmpData:[] }, document, CustomEvent:function(){} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(treasury, context);
  context.window.gastosData = [{
    fbKey:'gasto-nuevo', descripcion:'Insumos', fecha:'2026-09-25', monto:8000,
    montoPagado:8000, estado:'pagado', medio:'Transferencia',
    pagos:{ pago_1:{ fecha:'2026-09-25', monto:8000, medio:'Transferencia' } }
  }];
  const pagos = context.window._tesoreriaPagos();
  assert.equal(pagos.length, 1);
  assert.equal(pagos[0].origenLegacy, undefined);
});
