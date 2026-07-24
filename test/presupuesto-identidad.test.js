const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'js', 'app.js');
const appSource = fs.readFileSync(appPath, 'utf8');

function cargarBuscador(presupuestos) {
  const inicio = appSource.indexOf('function buscarPptoPorRef(');
  const fin = appSource.indexOf('function imprimirPresupuestoDesdeListado(', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'No se encontró buscarPptoPorRef en app.js');

  const contexto = {
    pptoData: presupuestos,
    console: { error() {} }
  };
  vm.createContext(contexto);
  vm.runInContext(appSource.slice(inicio, fin), contexto);
  return contexto.buscarPptoPorRef;
}

test('dos PP-0031 se resuelven por su fbKey sin mezclar clientes', () => {
  const esteban = { fbKey: '-fb-esteban', id: 'PP-0031', cliente: 'ESTEBAN PENNA' };
  const sandra = { fbKey: '-fb-sandra', id: 'PP-0031', cliente: 'SANDRA SALEM' };
  const buscar = cargarBuscador([esteban, sandra]);

  assert.equal(buscar('-fb-esteban').cliente, 'ESTEBAN PENNA');
  assert.equal(buscar('-fb-sandra').cliente, 'SANDRA SALEM');
  assert.equal(buscar('PP-0031'), null, 'un número duplicado no debe elegir el primer registro');
});

test('un número comercial único mantiene compatibilidad con datos históricos', () => {
  const buscar = cargarBuscador([
    { fbKey: '-fb-unico', id: 'PP-0042', cliente: 'CLIENTE ÚNICO' }
  ]);

  assert.equal(buscar('pp-0042').fbKey, '-fb-unico');
});

test('el botón Editar del detalle pasa primero la clave interna', () => {
  assert.match(
    appSource,
    /abrirEditorPpto\(\\'' \+ escapeHTML\(p\.fbKey\|\|p\.id\|\|''\)/,
    'Editar no debe volver a identificar el presupuesto sólo por PP-XXXX'
  );
});
