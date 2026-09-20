const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readActiveApp } = require('./helpers/active-app');

const app = readActiveApp().source;
function block(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `No se encontró ${start}`);
  return app.slice(from, to);
}
const context = vm.createContext({ Date, Object, Number, String, Array, parseInt, parseFloat, isNaN });
vm.runInContext(
  block('function _cargoValorHoraParaMes(', 'function _habCrearFilas(') + '\n' +
  block('function _cargoHistorialValorHora(', 'function _cargoAjusteRegistro('),
  context
);

function ajuste(fecha, anterior, nuevo) {
  return { ts: new Date(fecha + 'T12:00:00').getTime(), fecha, anterior, nuevo,
    porcentaje: anterior ? (nuevo - anterior) / anterior * 100 : null };
}

test('dos aumentos en el mismo mes se comparan con el cierre del mes anterior', () => {
  const cargo = { valorHora: 6500, historialValorHora: {
    a: ajuste('2026-09-03', 5000, 5800), b: ajuste('2026-09-20', 5800, 6500)
  } };
  const resultado = context._cargoVariacionMesAnterior(cargo);
  assert.equal(resultado.anterior, 5000);
  assert.equal(resultado.actual, 6500);
  assert.equal(resultado.porcentaje, 30);
  assert.equal(resultado.referencia, 'mes_anterior');
  assert.equal(Math.round(cargo.historialValorHora.b.porcentaje * 100) / 100, 12.07); // historial individual intacto
});

test('al mes siguiente la referencia cambia al cierre del mes anterior', () => {
  const cargo = { valorHora: 7150, historialValorHora: [
    ajuste('2026-09-03', 5000, 5800), ajuste('2026-09-20', 5800, 6500),
    ajuste('2026-10-03', 6500, 7150)
  ] };
  const resultado = context._cargoVariacionMesAnterior(cargo);
  assert.equal(resultado.anterior, 6500);
  assert.equal(resultado.porcentaje, 10);
});

test('un cargo nuevo este mes declara referencia inicial y no un sueldo previo inexistente', () => {
  const cargo = { valorHora: 5500, historialValorHora: [
    ajuste('2026-09-01', 0, 5000), ajuste('2026-09-18', 5000, 5500)
  ] };
  const resultado = context._cargoVariacionMesAnterior(cargo);
  assert.equal(resultado.referencia, 'valor_inicial');
  assert.equal(resultado.anterior, 5000);
  assert.equal(resultado.porcentaje, 10);
});

test('reducciones posteriores muestran la variación neta frente al mes previo', () => {
  const cargo = { valorHora: 5400, historialValorHora: [
    ajuste('2026-09-02', 6000, 5700), ajuste('2026-09-19', 5700, 5400)
  ] };
  assert.equal(context._cargoVariacionMesAnterior(cargo).porcentaje, -10);
});
