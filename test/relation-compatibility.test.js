const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'core', 'relation-compatibility.js'),
  'utf8'
);

function cargar(datos = {}) {
  const window = Object.assign({}, datos);
  const contexto = { window };
  vm.createContext(contexto);
  vm.runInContext(source, contexto);
  return window.SisVentas.Relations;
}

test('una clave técnica de venta inválida no se reemplaza por un número coincidente', () => {
  const relations = cargar({
    ventasList: [{ fbKey: '-venta-real', id: '#V-100' }]
  });

  assert.equal(relations.sale({ ventaFbKey: '-inexistente', ventaId: '#V-100' }), null);
});

test('una relación legacy sólo se completa cuando el número es único', () => {
  const relations = cargar({
    ventasList: [
      { fbKey: '-venta-a', id: '#V-100' },
      { fbKey: '-venta-b', id: '#V-100' }
    ]
  });

  assert.equal(relations.sale({ ventaId: '#V-100' }), null);
});

test('una clave técnica de cliente prevalece sobre un nombre homónimo', () => {
  const relations = cargar({
    clientesData: [
      { fbKey: '-cliente-a', id: '10', nombre: 'MISMO NOMBRE' },
      { fbKey: '-cliente-b', id: '11', nombre: 'MISMO NOMBRE' }
    ]
  });

  assert.equal(relations.client({ clienteFbKey: '-cliente-b', cliente: 'MISMO NOMBRE' }).id, '11');
  assert.equal(relations.client({ clienteFbKey: '-inexistente', cliente: 'MISMO NOMBRE' }), null);
});
