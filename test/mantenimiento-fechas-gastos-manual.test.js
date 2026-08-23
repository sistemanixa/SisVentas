const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const maintenance = fs.readFileSync('js/modules/maintenance.js', 'utf8');

test('Gastos no ejecuta migraciones durante su carga normal', () => {
  const inicio = app.indexOf('function fbCargarGastos()');
  const fin = app.indexOf('function _gastoFijoMesActual', inicio);
  const carga = app.slice(inicio, fin);
  assert.doesNotMatch(carga, /_migrarPagablesLegacyAGastos|_normalizarImputacionGastosPagados/);
});

test('Mantenimiento ofrece auditoría manual y corrección confirmada', () => {
  assert.match(html, /id="mnt-gastos-fecha-card"/);
  assert.match(html, /onclick="mntAuditarFechasGastos\(this\)"/);
  assert.match(html, /onclick="mntMigrarFechasGastos\(this\)" disabled/);
  assert.match(maintenance, /async function mntAuditarFechasGastos\(btn\)/);
  assert.match(maintenance, /async function mntMigrarFechasGastos\(btn\)/);
  assert.match(maintenance, /await window\.svConfirm\(/);
});

test('la migración manual conserva fecha original y registra su marca', () => {
  assert.match(maintenance, /updates\[base\+'\/fechaOriginal'\]=p\.fecha/);
  assert.match(maintenance, /updates\[base\+'\/fechaImputacion'\]=p\.fechaPago/);
  assert.match(maintenance, /sisventas\/config\/migraciones\/gastos_fecha_pago_v1/);
  assert.match(maintenance, /estado:'completada'/);
});
