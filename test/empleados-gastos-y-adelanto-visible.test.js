const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readActiveApp } = require('./helpers/active-app');

const app = readActiveApp().source;

function bloque(desde, hasta) {
  const inicio = app.indexOf(desde);
  const fin = app.indexOf(hasta, inicio);
  assert.ok(inicio >= 0 && fin > inicio, `No se encontro el bloque ${desde}`);
  return app.slice(inicio, fin);
}

test('Gastos vuelve a poblar el filtro cuando finaliza la carga de empleados', () => {
  const carga = bloque('function fbCargarEmpleados()', '// HABERES DEL MES');
  assert.ok((carga.match(/_cargarFiltroEmpleadosGastos\(\)/g) || []).length >= 2);
});

test('el filtro de Gastos incluye empleados activos e inactivos', () => {
  const select = { value: '', innerHTML: '' };
  const contexto = {
    empData: {
      activo: { fbKey: 'emp-activo', nombre: 'Osmar Tello', activo: true },
      inactivo: { fbKey: 'emp-inactivo', nombre: 'Marcos Tello', activo: false, tipoBaja: 'Despido' }
    },
    document: { getElementById: id => id === 'gas-f-empleado' ? select : null },
    escapeHTML: valor => String(valor)
  };
  vm.createContext(contexto);
  vm.runInContext(bloque('function _cargarFiltroEmpleadosGastos()', 'function filtrarGastosPorEmpleado()'), contexto);
  contexto._cargarFiltroEmpleadosGastos();
  assert.match(select.innerHTML, /Osmar Tello \(Activo\)/);
  assert.match(select.innerHTML, /Marcos Tello \(Inactivo\)/);
});

test('el formulario de adelanto se mueve al body y queda visible desde Empleados', () => {
  const paginaOculta = {};
  const modal = { parentElement: paginaOculta, style: { display: 'none' } };
  const elementos = {
    'modal-movi-emp': modal,
    'movi-modal-titulo': { textContent: '' },
    'movi-fecha': { value: '' },
    'movi-tipo': { value: '', options: [{ value: 'adelanto' }, { value: 'sueldo' }] },
    'movi-desc': { value: '' },
    'movi-monto': { value: '' },
    'movi-estado': { value: '' },
    'movi-medio': { value: '' },
    'movi-estado-wrap': { style: {} },
    'movi-periodico-wrap': { style: {} },
    'movi-periodico': { checked: true },
    'movi-foto-preview': { style: {} },
    'movi-foto-nombre': { textContent: '' },
    'movi-foto-input': { value: 'archivo' }
  };
  const body = { appendChild(el) { el.parentElement = body; } };
  const contexto = {
    ctaEmpActual: 'emp-osmar',
    document: {
      body,
      getElementById: id => elementos[id] || null,
      querySelector: () => null
    },
    window: { tienePermiso: () => true },
    notify: () => {},
    svFechaLocalISO: () => '2026-09-24',
    _puedeGestionarAdelantos: () => true,
    _setMontoInput: () => {},
    onMoviPeriodicoChange: () => {},
    onMoviTipoChange: () => {},
    movEmpFotoBase64: 'anterior'
  };
  vm.createContext(contexto);
  vm.runInContext(bloque('function abrirNuevoMovEmp(tipoInicial)', 'function cerrarModalMovEmp()'), contexto);
  contexto.abrirNuevoMovEmp('adelanto');
  assert.equal(modal.parentElement, body);
  assert.equal(modal.style.display, 'flex');
});

