const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'modules', 'ops-hardening.js'),
  'utf8'
);

test('el resumen operativo conserva acentos y separadores legibles', () => {
  assert.match(source, /críticos/);
  assert.match(source, /automáticos seguros/);
  assert.match(source, /huérfanas/);
  assert.match(source, /Acciones críticas conocidas protegidas por el módulo/);
  assert.match(source, /Histórico del dólar/);
  assert.doesNotMatch(source, /auditor\?a|Atenci\?n|cr\?ticos|autom\?ticos|hu\?rfanas|m\?dulo|Hist\?rico|d\?lar|Credenciales \? clientes/);
});
