const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v2.0.292.js', 'utf8');
const dateStart = source.indexOf('function _fechaCalendarioLocal');
const dateEnd = source.indexOf('function kpiIva', dateStart);
const ctaStart = source.indexOf('function _ctaEmpMesDeMov');
const ctaEnd = source.indexOf('function _ctaEmpEsGastoPersonalEmpleado', ctaStart);
assert.notEqual(dateStart, -1);
assert.notEqual(ctaStart, -1);

const context = { String, Number, Date, Math, Object, isFinite, window: {}, _buscarGastoRelacionadoMovEmp: () => null };
vm.createContext(context);
vm.runInContext(source.slice(dateStart, dateEnd), context);
vm.runInContext(source.slice(ctaStart, ctaEnd), context);

test('un gasto fechado el 30/07 queda en julio aunque incluya hora/zona', () => {
  const mov = { fecha: '2026-07-30T23:30:00-03:00', mes: '2026-08', tipo: 'gasto_empresa' };
  assert.equal(context._ctaEmpFechaMovimiento(mov), '2026-07-30');
  assert.equal(context._ctaEmpMesDeMov(mov), '2026-07');
});

test('la fecha explícita prevalece sobre un mes legado desplazado', () => {
  const mov = { fecha: '30/07/2026', mes: '2026-08' };
  assert.equal(context._ctaEmpFechaMovimiento(mov), '2026-07-30');
});

test('cargos son negativos y haberes/horas permanecen positivos', () => {
  assert.equal(context._ctaEmpEsCargo({ tipo: 'adelanto' }), true);
  assert.equal(context._ctaEmpEsCargo({ tipo: 'gasto_empresa' }), true);
  assert.equal(context._ctaEmpEsCargo({ tipo: 'sueldo' }), false);
  assert.equal(context._ctaEmpEsCargo({ tipo: 'hextra' }), false);
});

test('la tabla usa fecha comercial local y descuenta cargos del saldo', () => {
  assert.match(source, /function _movEmpEnPeriodo[\s\S]*_ctaEmpFechaMovimiento/);
  assert.match(source, /var total = haberes - adelantosACompensar - cargos/);
  assert.match(source, /var esEgreso  = _ctaEmpEsCargo\(m\)/);
});
