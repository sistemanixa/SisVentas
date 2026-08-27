const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.2.6.js', 'utf8');

test('solo una decisión confirmada manualmente puede unificar domicilios', () => {
  assert.match(app, /decision\.confirmadaManualmente === true/);
  assert.match(app, /_clienteDecisionManualValida\(_clientesRevisionDecisiones\[candidato\.clave\], 'unificar'\)/);
  assert.match(app, /confirmadaManualmente: true/);
});

test('la migración se bloquea mientras exista algún grupo pendiente', () => {
  assert.match(app, /var pendientes = candidaturas\.filter/);
  assert.match(app, /Falta revisar manualmente/);
  assert.match(app, /No se modificó la estructura/);
});

test('la estructura y el índice se reemplazan atómicamente', () => {
  assert.match(app, /'sisventas\/clientes_unificados': clientesUnificados/);
  assert.match(app, /'sisventas\/clientes_unificados_indice': indiceUnificado/);
  assert.doesNotMatch(app, /updates\[CLIENTES_REVISION_PATH \+ '\/' \+ grupo\.clave\]/);
});

test('el plan no confía en agrupaciones automáticas anteriores', () => {
  const bloque = app.slice(app.indexOf('function construirPlanEstructuraClientes'), app.indexOf('function construirActualizacionesEstructuraClientes'));
  assert.match(bloque, /raizLegacyExplicita/);
  assert.doesNotMatch(bloque, /clienteRaizRegistro/);
});
