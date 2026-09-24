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

test('el filtro de Gastos separa empleados activos del historial de inactivos', () => {
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
  assert.match(select.innerHTML, /<optgroup label="Empleados activos">/);
  assert.match(select.innerHTML, /Osmar Tello/);
  assert.doesNotMatch(select.innerHTML, /Osmar Tello \(Inactivo\)/);
  assert.match(select.innerHTML, /<optgroup label="Historial de empleados inactivos">/);
  assert.match(select.innerHTML, /Marcos Tello \(Inactivo\)/);
});

test('el formulario de adelanto se mueve al body y queda visible desde Empleados', () => {
  const paginaOculta = {};
  const modal = { parentElement: paginaOculta, style: { display: 'none' }, dataset: {} };
  const elementos = {
    'modal-movi-emp': modal,
    'movi-modal-titulo': { textContent: '' },
    'movi-fecha': { value: '' },
    'movi-tipo': { value: '', options: [{ value: 'adelanto' }, { value: 'sueldo' }] },
    'movi-tipo-wrap': { style: {} },
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
  vm.runInContext(bloque('function abrirNuevoMovEmp(tipoInicial, opciones)', 'function cerrarModalMovEmp()'), contexto);
  contexto.abrirNuevoMovEmp('adelanto');
  assert.equal(modal.parentElement, body);
  assert.equal(modal.style.display, 'flex');
  assert.equal(modal.dataset.modo, 'movimiento-general');
  assert.equal(elementos['movi-tipo-wrap'].style.display, '');
  assert.equal(elementos['movi-periodico-wrap'].style.display, '');
});

test('Cargar adelanto fija el tipo y oculta estado y repeticion mensual', () => {
  const modal = { parentElement: null, style: { display: 'none' }, dataset: {} };
  const guardar = { innerHTML: '', dataset: {} };
  const elementos = {
    'modal-movi-emp': modal,
    'movi-modal-titulo': { textContent: '' },
    'movi-fecha': { value: '' },
    'movi-tipo': { value: '', options: [{ value: 'adelanto' }, { value: 'transporte' }, { value: 'otro' }] },
    'movi-tipo-wrap': { style: {} },
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
    document: { body, getElementById: id => elementos[id] || null, querySelector: () => guardar },
    window: { tienePermiso: () => true },
    notify: () => {},
    svFechaLocalISO: () => '2026-09-24',
    _puedeGestionarAdelantos: () => true,
    _setMontoInput: () => {},
    onMoviPeriodicoChange: () => {},
    onMoviTipoChange: () => {},
    movEmpFotoBase64: null
  };
  vm.createContext(contexto);
  vm.runInContext(bloque('function abrirNuevoMovEmp(tipoInicial, opciones)', 'function cerrarModalMovEmp()'), contexto);
  contexto.abrirNuevoMovEmp('adelanto', { soloAdelanto: true });
  assert.equal(modal.dataset.modo, 'adelanto-directo');
  assert.equal(elementos['movi-tipo'].value, 'adelanto');
  assert.equal(elementos['movi-tipo-wrap'].style.display, 'none');
  assert.equal(elementos['movi-estado-wrap'].style.display, 'none');
  assert.equal(elementos['movi-periodico-wrap'].style.display, 'none');
  assert.equal(elementos['movi-periodico'].checked, false);
  assert.match(guardar.innerHTML, /Registrar adelanto/);
});

test('Continuar resuelve el empleado real y abre el formulario aunque empleadosData no exista', () => {
  let tipoAbierto = '';
  let estadoActualizado = false;
  const modalSelector = { remove() {} };
  const elementos = {
    'adelanto-general-empleado': { value: 'emp-mauro' },
    'modal-adelanto-general': modalSelector,
    'modal-nuevo': null,
    'movi-modal-titulo': { textContent: '' },
    'movi-desc': { value: '' },
    'movi-estado': { value: '' },
    'movi-monto': { focus() {}, select() {} }
  };
  const contexto = {
    empData: { 'emp-mauro': { fbKey:'emp-mauro', nombre:'Mauro Bechir', activo:true } },
    document: { getElementById: id => elementos[id] || null },
    window: { tienePermiso: () => true },
    _puedeGestionarAdelantos: () => true,
    notify: mensaje => { throw new Error(mensaje); },
    cerrarModalAdelantoGeneral: () => modalSelector.remove(),
    abrirNuevoMovEmp: tipo => { tipoAbierto = tipo; },
    onMoviEstadoChange: () => { estadoActualizado = true; },
    setTimeout: fn => fn()
  };
  vm.createContext(contexto);
  vm.runInContext(bloque('function continuarAdelantoGeneral()', 'function _movEmpTotalPagado'), contexto);
  contexto.continuarAdelantoGeneral();
  assert.equal(contexto.ctaEmpActual, 'emp-mauro');
  assert.equal(tipoAbierto, 'adelanto');
  assert.equal(elementos['movi-modal-titulo'].textContent, 'Cargar adelanto — Mauro Bechir');
  assert.equal(elementos['movi-estado'].value, 'pagado');
  assert.equal(estadoActualizado, true);
});
