const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.327.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('la cuenta abre mostrando todos los saldos pendientes acumulados', () => {
  assert.match(html, /id="ctaemp-btn-pendientes"[^>]*>Pendientes acumulados/);
  assert.match(app, /window\._ctaEmpVista = 'pendientes'/);
  assert.match(app, /_ctaEmpMovHastaPeriodo\(m, mesCta\) && _movEmpEsCobrable\(m\) && _movEmpSaldoPendiente\(m\) > 0/);
});

test('los filtros mensuales siguen disponibles sin cambiar el saldo acumulado del KPI', () => {
  assert.match(html, /setCtaEmpPeriodo\('anterior'\)/);
  assert.match(html, /setCtaEmpPeriodo\('actual'\)/);
  assert.match(app, /var listaSaldoAcumulado = movsEmpData\.filter/);
  assert.match(app, /periodoEl\.textContent = 'saldo acumulado hasta '/);
});

test('las horas extra anteriores se muestran y se pueden llevar a pago', () => {
  assert.match(app, /\['hextra','bonificacion','transporte','materiales','gasto_empresa','otro'\]\.includes/);
  assert.match(app, /\['gasto_empresa','bonificacion','hextra'\]\.includes\(m\.tipo\) && m\.gastoFbKey/);
  assert.match(app, /puedeGestionarGasto[\s\S]*?<i class="ti ti-external-link"><\/i> Revisar/);
});

test('el KPI identifica que el importe corresponde al saldo acumulado', () => {
  assert.match(html, /Saldo pendiente acumulado/);
});

test('la vista acumulada muestra el saldo restante y no el importe ya abonado', () => {
  assert.match(app, /var montoVisible = vistaCta === 'pendientes' \? _movEmpSaldoPendiente\(m\)/);
  const saldo = (monto, pagado) => Math.max(0, monto - pagado);
  assert.equal(saldo(202400, 0), 202400);
  assert.equal(saldo(500000, 0), 500000);
  assert.equal(saldo(100000, 40000), 60000);
});
