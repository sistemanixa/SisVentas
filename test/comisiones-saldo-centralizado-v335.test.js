const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.3.6.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const modulo = fs.readFileSync('js/modules/commissions.js', 'utf8');

test('una comisión pendiente de aprobación no integra el saldo del empleado', () => {
  assert.match(app, /if \(String\(m\.tipo \|\| ''\)\.toLowerCase\(\) === 'comision'\)[\s\S]*?estadoComision === 'aprobado' \|\| estadoComision === 'pagado_parcial'/);
});

test('las comisiones históricas se incorporan al módulo central sin duplicarlas', () => {
  assert.match(app, /function sincronizarComisionesLegacyConModulo\(\)/);
  assert.match(app, /String\(g\.legacyKey\|\|''\) === legacyKey/);
  assert.match(app, /gastoFbKey:claveExistente/);
  assert.match(modulo, /window\.sincronizarComisionesLegacyConModulo\(\)/);
});

test('la carga y las decisiones quedan en Comisiones', () => {
  assert.match(html, /onclick="abrirModalComisionVenta\(\)"[^>]*>[\s\S]*?Nueva comisión/);
  assert.doesNotMatch(app, /m\.tipo === 'comision'[\s\S]{0,300}?aprobarComision\(\\'/);
  assert.match(app, /m\.tipo === 'comision'[\s\S]{0,300}?abrirComisionDesdeGasto/);
});
