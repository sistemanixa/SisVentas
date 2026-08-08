const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.305.js', 'utf8');

test('el saldo de cuenta corriente acumula movimientos pendientes de meses anteriores', () => {
  assert.match(app, /function _ctaEmpMovHastaPeriodo\(m, mes\)/);
  assert.match(app, /var listaSaldoAcumulado = movsEmpData\.filter/);
  assert.match(app, /TIPOS_HABER\.includes\(m\.tipo\) && _movEmpEsCobrable\(m\)/);
  assert.match(app, /_ctaEmpAdelantosPendientes\(mesCta\)/);

  const hasta = (fecha, mes) => !fecha || fecha.slice(0, 7) <= mes;
  const movimientos = [
    { tipo: 'hextra', fecha: '2026-06-30', saldo: 18000 },
    { tipo: 'adelanto', fecha: '2026-07-15', saldo: 5000 },
    { tipo: 'sueldo', fecha: '2026-08-31', saldo: 100000 }
  ];
  const aAgosto = movimientos.filter(m => hasta(m.fecha, '2026-08'));
  assert.equal(aAgosto.reduce((s, m) => s + (m.tipo === 'adelanto' ? -m.saldo : m.saldo), 0), 113000);
  assert.equal(movimientos.filter(m => hasta(m.fecha, '2026-06')).length, 1);
});

test('la interfaz identifica el total como saldo acumulado del período', () => {
  assert.match(app, /periodoEl\.textContent = 'saldo acumulado hasta ' \+ etiquetaPeriodo/);
});

test('el KPI aclara cuando un adelanto anterior se aplica al haber actual', () => {
  assert.match(app, /adelanto de mes anterior aplicado al haber/);
  assert.match(fs.readFileSync('index.html', 'utf8'), /Adelanto aplicado/);
});
