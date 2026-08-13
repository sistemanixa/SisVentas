const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.336.js'), 'utf8');

test('la revisión de repetidos sólo registra decisiones y no unifica clientes', () => {
  const inicio = app.indexOf('var CLIENTES_REVISION_PATH');
  const fin = app.indexOf('function renderTablaClientes', inicio);
  const bloque = app.slice(inicio, fin);
  assert.ok(inicio >= 0);
  assert.match(bloque, /function abrirRevisionClientesDuplicados/);
  assert.match(bloque, /sisventas\/config\/migracionClientes\/revision/);
  assert.match(bloque, /Mismo cliente: unificar después/);
  assert.doesNotMatch(bloque, /FB_PATHS\.clientes \+ '\/' \+ .*clientePrincipalFbKey/);
  assert.match(app, /function unificarClientesFiltrados\(\) \{ abrirRevisionClientesDuplicados\(\); \}/);
});

test('los candidatos se generan sólo por nombres repetidos y son revisables', () => {
  assert.match(app, /function obtenerCandidatosClientesDuplicados\(\)/);
  assert.match(app, /if \(!cliente \|\| cliente\.clientePrincipalFbKey\) return/);
  assert.match(app, /estado === 'unificar'/);
  assert.match(app, /estado === 'independientes'/);
  assert.match(app, /estado === 'pendiente'/);
});

test('la migración genera un índice legacy y sedes sin escribir sobre clientes legacy', () => {
  const inicio = app.indexOf('function _clienteClaveEstructura');
  const fin = app.indexOf('function _resumenClienteRevision', inicio);
  const contexto = {
    clientesData: [], currentUser: 'Admin', String, Array, Object,
    clienteRaizRegistro: (c) => c,
    obtenerCandidatosClientesDuplicados: () => [],
    _clienteCategoriaSede: (c) => c.empresa || ''
  };
  vm.createContext(contexto);
  vm.runInContext(app.slice(inicio, fin), contexto);
  const plan = contexto.construirPlanEstructuraClientes([
    {fbKey:'a', id:'1', nombre:'CLIENTE A', dir:'CALLE 1'},
    {fbKey:'b', id:'2', nombre:'CLIENTE B', dir:'CALLE 2'}
  ]);
  const updates = contexto.construirActualizacionesEstructuraClientes(plan, 123);
  assert.equal(plan.length, 2);
  assert.equal(Object.keys(updates).some((k) => k.startsWith('sisventas/clientes/')), false);
  assert.equal(Object.keys(updates).filter((k) => k.startsWith('sisventas/clientes_unificados/')).length, 2);
  assert.equal(Object.keys(updates).filter((k) => k.startsWith('sisventas/clientes_unificados_indice/')).length, 2);
});

test('la pantalla usa el índice estructural y permite preparar una sede nueva', () => {
  assert.match(app, /function fbCargarClientesUnificados\(\)/);
  assert.match(app, /fbCargarClientesUnificados\(\);/);
  assert.match(app, /function obtenerEstructuraClientePorLegacy\(cliente\)/);
  assert.match(app, /function abrirNuevaSedeCliente\(el\)/);
  assert.match(app, /Agregar sede/);
  assert.match(app, /sincronizarClienteEnEstructura\(cli, clienteKeyEstructura\)/);
});
