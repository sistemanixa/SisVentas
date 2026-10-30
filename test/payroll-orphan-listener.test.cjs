'use strict';
// Extract the active application functions, then execute every payroll module
// in the same order as the active index. All SDK I/O below is in memory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const { readActiveApp } = require(path.join(repo, 'test/helpers/active-app.js'));
const { load } = require(path.join(repo, 'test/helpers/app-functions.cjs'));
const { createBackend } = require(path.join(repo, 'test/helpers/labor-ui-flow.cjs'));
const active = readActiveApp();
const copy = value => JSON.parse(JSON.stringify(value));
const NOW = Date.parse('2026-10-22T15:30:00Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}

const scripts = [...active.index.matchAll(/<script\b[^>]*\bsrc="([^"?#]+)(?:[^\"]*)"/g)]
  .map(match => match[1].replace(/^\.\//, ''));
const modules = scripts.filter(name => /^js\/modules\/payroll(?:-[\w-]+)?\.js$/.test(name))
  .map(name => ({ name, source: fs.readFileSync(path.join(repo, name), 'utf8') }));
assert.ok(modules.length, 'El índice activo debe cargar los módulos de Haberes/SAC');

const employees = {
  e1: { fbKey: 'e1', nombre: 'Ana', cargoId: 'c1', fechaIngreso: '2020-01-01' },
  e2: { fbKey: 'e2', nombre: 'Bea', cargoId: 'c1', fechaIngreso: '2026-09-10' },
  inactive: { fbKey: 'inactive', nombre: 'Inactivo', cargoId: 'c1', activo: false }
};
const salaries = {
  e1: { '2026_07': { sueldo: 1000 }, '2026_08': { sueldo: 1200 }, '2026_10': { sueldo: 1100 }, '2025_12': { sueldo: 99999 } },
  e2: { '2026_09': { sueldo: 1800 } }, inactive: { '2026_09': { sueldo: 80000 } }
};
const expenses = {
  a: { descripcion: 'Material Ana', empleadoId: 'e1', empleadoNombre: 'Ana', categoria: 'Materiales', tipo: 'Variable', fecha: '2026-08-02', monto: 120, pagos: { p: { fecha: '2026-10-20', monto: 70 }, v: { fecha: '2026-10-20', monto: 50, anulado: true } } },
  b: { descripcion: 'Haber Bea', empleadoFbKey: 'e2', empleadoNombre: 'Bea', categoria: 'Personal', tipoPagable: 'sueldo', tipo: 'Fijo', fecha: '2026-10-01', monto: 400, estado: 'aprobado', vencimiento: '2026-10-25' },
  c: { descripcion: 'Aguinaldo Ana 2do semestre 2026', empleadoFbKey: 'e1', empleadoNombre: 'Ana', categoria: 'Personal', tipoPagable: 'aguinaldo', semestre: '2026_S2', fecha: '2026-10-01', monto: 600, montoPagado: 600, estado: 'Pagado' },
  d: { descripcion: 'Viatico Ana', empleadoId: 'e1', empleadoNombre: 'Ana', fecha: '2026-09-01', fechaPago: '2026-10-03', monto: 20, montoPagado: 20 },
  conflict: { descripcion: 'Referencia contradictoria', empleadoId: 'e2', empleadoFbKey: 'e1', fecha: '2026-10-01', monto: 30 },
  void: { descripcion: 'Anulado Ana', empleadoId: 'e1', fecha: '2026-10-01', monto: 40, estado: 'anulado', pagos: { v: { fecha: '2026-10-01', monto: 40, estado: 'anulado' } } },
  archived: { descripcion: 'Archivado Ana', empleadoId: 'e1', fecha: '2026-10-01', monto: 50, montoPagado: 50, bajaAdministrativa: { uid: 'admin', usuario: 'Admin', ts: NOW - 1, auditKey: 'audit' } },
  commission: { descripcion: 'Comision venta evaluacion', tipoPagable: 'comision', empleadoFbKey: 'e1', fecha: '2026-10-01', monto: 33, estado: 'pendiente_aprobacion' },
  old: { descripcion: 'Historico Ana', empleadoId: 'e1', fecha: '2025-01-01', monto: 25, montoPagado: 25 }
};
// These marks must not become a second source of real payable expenses. They
// deliberately collide with the selected employees/semester and use high sums.
const legacyMarks = {
  e1: { '2026_S2': { monto: 999999, mejorSueldo: 1999998, fecha: '2026-12-01' } },
  e2: { '2026_S2': { monto: 888888, fecha: '2026-12-01' } }
};
const functionNames = [
  '_svSuscribirGastos', 'fbCargarGastos', 'gastosFiltradosActuales', '_normFechaGasto',
  '_gastoPagosArray', 'pagoGastoEstaAnulado', 'totalPagadoGasto', 'normalizarEstadoGasto',
  'normalizarTipoGasto', 'restoGasto', 'resumenGastosPagadosMes', 'fechaImputacionGasto',
  'gastoVisibleEnModuloGastos', '_gastoEstaRetirado', '_gastoCoincideKpi', '_claveGastoKpi',
  '_gastoCorrespondeEmpleado', '_formatearMontoKpiGasto', 'actualizarMetricasGastos',
  'svGastoCoincideCategoria','renderTablaGastos', 'gastoSeleccionableParaPago', '_mesesDelSemestre',
  '_mesesTrabajadosEnSemestre', '_calcularFilasAguinaldo'
];

function page(role = 'admin', options = {}) {
  const listeners = [], reads = [], directWrites = [], renders = [], commands = [], messages = [], confirmations = [], events = {};
  let allowed = role !== 'denied', fullDomain = role === 'admin', pageActive = true;
  let selected = new Set(['e1', 'e2']);
  let salariesNow = copy(salaries);
  const element = (value = '') => ({ value, dataset: {}, style: {}, textContent: '', innerHTML: '',
    selectedOptions: [{ textContent: 'Ana' }], remove() { this.removed = true; } });
  const nodes = {};
  for (const id of ['gastos-tbody', 'gastos-paginacion', 'gas-f-tipo', 'gas-f-estado', 'gas-f-mes', 'gas-f-empleado', 'gas-buscar', 'gas-total', 'gas-total-sub', 'gas-pendiente', 'gas-pend-cant', 'gas-vencen', 'gas-vencen-cant', 'gas-reembolso', 'gas-reembolso-cant']) nodes[id] = element();
  Object.assign(nodes, { 'agu-sem-sel': element('2026-2'), 'agu-fecha': element('2026-12-01'), 'agu-maximo': element('700'), 'modal-aguinaldo': element() });
  nodes['modal-aguinaldo'].dataset.aguinaldoOperacion = 'fixture-sac';
  const context = {
    Date: FixedDate, console: { error() {} }, setTimeout() { return 1; }, clearTimeout() {},
    fbDB: {}, currentUserUid: 'uid-' + role, gastosData: [], _gastosUnsubscribe: null,
    _gastosDataReady: false, _gastosCargaError: '', _gastosPagosCache: new WeakMap(),
    _gastosFechaImputacionCache: new WeakMap(), _gastosPagoMultipleActivo: false, _gastosSeleccionadosPago: {},
    empData: copy(employees), CARGOS_DATA: { c1: { valorHora: 10, diasMes: 20 } }, ctaEmpActual: null,
    document: {
      getElementById: id => nodes[id] || null,
      querySelector: selector => selector === '#gasto-list input.search-input' ? nodes['gas-buscar']
        : selector.startsWith('.agu-check-322') ? { checked: selected.has((selector.match(/data-key="([^"]+)"/) || [])[1]) } : null,
      querySelectorAll: () => [], addEventListener: (name, fn) => { (events[name] ||= []).push(fn); }
    },
    svPuedeLeerDominio: () => fullDomain, svEmpleadoPropio: () => allowed ? { fbKey: 'e1' } : null,
    permisoModulo: name => allowed && name === 'ctaemp', tienePermiso: () => allowed,
    fbRef: (_, key) => ({ path: key }), fbOrderByChild: field => ({ field }), fbEqualTo: equal => ({ equal }),
    fbQuery: (ref, ...parts) => Object.assign({}, ref, ...parts),
    fbOnValue: (ref, cb, error) => {
      const listener = { ref, cb, error, active: true };
      listeners.push(listener); return () => { listener.active = false; };
    },
    fbGet: async ref => {
      reads.push(ref.path); assert.equal(ref.path, 'sisventas/haberes', 'Lectura explícita de sueldo para calcular el SAC');
      return { val: () => copy(salariesNow) };
    },
    fbRemove: ref => { directWrites.push(ref.path); return Promise.resolve(); },
    notify: message => messages.push(message), svConfirm: async message => { confirmations.push(message); return true; },
    _guardarAguinaldosAtomico: async (...args) => {
      commands.push(copy(args)); return options.save ? options.save(...args) : { committed: true };
    },
    registrarActividad() {}, _paginaGastosActiva: () => pageActive, _svEsPaginaActiva: () => false,
    _cargarFiltroEmpleadosGastos() {}, _actualizarBadgeSolicitudesGastos() {}, _programarTareasSecundariasGastos() {},
    actualizarTarjetaComisionadosVenta() {}, actualizarResumenPagoMultiple() {}, _gastoDesgloseHaberHTML: () => '',
    escapeHTML: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    eliminarRegistro: async (...args) => ({ delegated: args })
  };
  context.window = context;
  load(context, functionNames);
  for (const module of modules) vm.runInContext(module.source, context, { filename: module.name });
  const realRender = context.renderTablaGastos;
  context.renderTablaGastos = function() { const result = realRender.apply(this, arguments); renders.push(nodes['gastos-tbody'].innerHTML); return result; };
  function emit(source, data) {
    for (const listener of listeners.filter(entry => entry.active && entry.ref.path === source)) {
      const values = listener.ref.field ? Object.fromEntries(Object.entries(data).filter(([, row]) => row[listener.ref.field] === listener.ref.equal)) : data;
      listener.cb({ val: () => copy(values) });
    }
  }
  function snapshot() {
    context.actualizarMetricasGastos(); context.renderTablaGastos();
    return copy({ data: context.gastosData, keys: context._gastosPaginaKeys, html: nodes['gastos-tbody'].innerHTML,
      pages: nodes['gastos-paginacion'].innerHTML, diagnostics: nodes['gastos-tbody'].dataset,
      metrics: Object.fromEntries(Object.entries(nodes).filter(([id]) => /^gas-(total|pendiente|pend-cant|vencen|reembolso)/.test(id)).map(([id, node]) => [id, node.textContent])),
      paidTotal: context.resumenGastosPagadosMes(context.gastosData, new FixedDate()).total,
      payments: context.gastosData.map(gasto => [gasto.fbKey, context.totalPagadoGasto(gasto), context.restoGasto(gasto), context.normalizarEstadoGasto(gasto)]) });
  }
  return { context, nodes, listeners, reads, directWrites, renders, commands, messages, confirmations, events, emit, snapshot,
    revoke() { allowed = false; fullDomain = false; }, setActive(value) { pageActive = value; },
    select(keys) { selected = new Set(keys); }, selectedKeys() { return [...selected]; },
    salaries(value) { salariesNow = copy(value); } };
}

for (const [role, expectedSources, expectedKeys] of [
  ['admin', 1, ['a', 'b', 'c', 'conflict', 'd', 'old', 'void']],
  ['own', 2, ['a', 'c', 'd', 'old', 'void']], ['denied', 0, []]
]) test('SAC sin listener legacy: carga real de Gastos, rol ' + role + ' y baja de todas las suscripciones', () => {
  const env = page(role), teardown = env.context.fbCargarGastos();
  const repeated = env.context.fbCargarGastos();
  assert.equal(repeated, teardown, 'Navegar/cargar dos veces debe reutilizar el contrato de baja');
  const business = env.listeners.filter(listener => listener.ref.path === 'sisventas/gastos');
  assert.equal(business.length, expectedSources);
  if (role === 'own') assert.deepEqual(business.map(listener => [listener.ref.field, listener.ref.equal]), [['empleadoId', 'e1'], ['empleadoFbKey', 'e1']]);
  env.emit('sisventas/gastos', expenses);
  const before = env.snapshot(), renderCount = env.renders.length;
  assert.deepEqual(before.keys.slice().sort(), expectedKeys);
  if (role !== 'denied') {
    assert.ok(before.html.includes('Aguinaldo Ana 2do semestre 2026'));
    assert.ok(!before.html.includes('Archivado Ana')); assert.ok(!before.html.includes('Comision venta evaluacion'));
  }
  env.setActive(false);
  env.emit('sisventas/aguinaldos', legacyMarks);
  assert.equal(env.renders.length, renderCount, 'Una marca SAC ajena a Gastos no debe repintar una pantalla oculta');
  assert.deepEqual(env.snapshot(), before, 'No agregar Gastos recuperados ni modificar pagos/totales desde otra colección');
  if (typeof teardown === 'function') teardown();
  assert.deepEqual(env.reads, []); assert.deepEqual(env.directWrites, []); assert.deepEqual(env.commands, []);
  assert.equal(env.listeners.filter(listener => listener.ref.path === 'sisventas/aguinaldos').length, 0, 'No suscribir toda la historia de marcas SAC');
  assert.equal(env.listeners.filter(listener => listener.active).length, 0, 'Ninguna escucha debe sobrevivir al cierre de Gastos');
});

test('Pagos activos/anulados, archivo administrativo y KPIs mantienen su fuente financiera', () => {
  const env = page(); env.context.fbCargarGastos(); env.emit('sisventas/gastos', expenses);
  const before = env.snapshot();
  assert.equal(before.paidTotal, 740, 'Incluye historia pagada archivada sin volver a mostrarla en la tabla');
  assert.deepEqual(before.payments.find(row => row[0] === 'a'), ['a', 70, 50, 'pagado_parcial']);
  assert.deepEqual(before.payments.find(row => row[0] === 'void'), ['void', 0, 40, 'anulado']);
  assert.equal(before.metrics['gas-pendiente'], '$480'); assert.equal(before.metrics['gas-pend-cant'], '3 gastos');
  assert.equal(before.metrics['gas-vencen'], '$400'); assert.equal(before.metrics['gas-reembolso'], '$480');
  env.emit('sisventas/aguinaldos', legacyMarks);
  assert.deepEqual(env.snapshot(), before);
  assert.deepEqual(env.directWrites, []); assert.deepEqual(env.commands, []);
});

const filterCases = [
  ['mes', { 'gas-f-mes': 'mes' }, ['b', 'c', 'conflict', 'void']],
  ['trimestre', { 'gas-f-mes': '3m' }, ['a', 'b', 'c', 'conflict', 'd', 'void']],
  ['año', { 'gas-f-mes': 'anio' }, ['a', 'b', 'c', 'conflict', 'd', 'void']],
  ['pagados', { 'gas-f-estado': 'pagado' }, ['c', 'd', 'old']],
  ['fijos', { 'gas-f-tipo': 'Fijo' }, ['b']],
  ['búsqueda', { 'gas-buscar': 'Ana' }, ['a', 'c', 'd', 'old', 'void']]
];
for (const [label, filters, expected] of filterCases) test('El render real conserva el filtro ' + label + ' sin recuperar marcas SAC', () => {
  const env = page(); env.context.fbCargarGastos(); env.emit('sisventas/gastos', expenses);
  for (const [id, value] of Object.entries(filters)) env.nodes[id].value = value;
  const before = env.snapshot(); assert.deepEqual(before.keys.slice().sort(), expected);
  env.emit('sisventas/aguinaldos', legacyMarks); assert.deepEqual(env.snapshot(), before);
  assert.deepEqual(env.directWrites, []); assert.deepEqual(env.commands, []);
});

test('La consulta propia conserva la revocación, el UID capturado y el cierre por error', () => {
  const revoked = page('own'); revoked.context.fbCargarGastos(); revoked.emit('sisventas/gastos', expenses);
  assert.ok(revoked.context.gastosData.length); revoked.revoke(); revoked.emit('sisventas/gastos', expenses);
  assert.equal(revoked.context.gastosData.length, 0);
  const switched = page('own'); const close = switched.context.fbCargarGastos(); switched.emit('sisventas/gastos', expenses);
  const old = copy(switched.context.gastosData); switched.context.currentUserUid = 'otro-uid';
  switched.emit('sisventas/gastos', { nuevo: { empleadoId: 'e1', monto: 999 } });
  assert.deepEqual(copy(switched.context.gastosData), old); close();
  const failed = page('own'); failed.context.fbCargarGastos();
  failed.listeners.find(listener => listener.ref.path === 'sisventas/gastos').error(new Error('Fallo ficticio'));
  assert.equal(failed.listeners.filter(listener => listener.ref.path === 'sisventas/gastos' && listener.active).length, 0);
  assert.match(failed.nodes['gastos-tbody'].innerHTML, /No se pudieron cargar los gastos/);
  assert.equal(failed.context.gastosData.length, 0); assert.deepEqual(failed.directWrites, []); assert.deepEqual(failed.commands, []);
});

function financialPage(initial = {}) {
  const backend = createBackend({ empleados: copy(employees), gastos: {}, haberes: copy(salaries),
    ctaemp: { e1: { old: { tipo: 'sueldo', monto: 500, montoPagado: 500, pagos: { p: { monto: 500 } } } }, e2: {} },
    aguinaldos: copy(legacyMarks), ...copy(initial) });
  const transport = backend.page();
  const env = page('admin');
  // These financial regressions isolate the modal adapter; the real controller,
  // REST range reads and modal lifecycle are exercised in payroll-semester-reads.
  // The actual new builder, browser CAS transport, gateway and guard run below.
  vm.runInContext(fs.readFileSync(path.join(repo, 'js/core/payroll-source-snapshot.js'), 'utf8'), env.context);
  env.context._claveOperacionConcurrente = transport.context._claveOperacionConcurrente;
  env.context._pagableGastoBase = transport.context._pagableGastoBase;
  env.context.SVLaborWrites = { atomic: options => {
    env.commands.push({ paths: [...options.paths] });
    return transport.context.SVLaborWrites.atomic(options);
  } };
  env.context.SVPayrollSemester = {
    captureConfirmation() {
      const [year, half] = env.nodes['agu-sem-sel'].value.split('-').map(Number);
      return { employees: Object.values(env.context.empData).filter(e => e.activo !== false && env.selectedKeys().includes(e.fbKey)),
        haberes: copy(salaries), maximum: env.nodes['agu-maximo'].value, period: { year, half } };
    },
    assertConfirmation() { if (!env.context.tienePermiso('empleados.registrarHaberes')) throw Error('Sin permiso'); },
    saving() {}, confirmed: () => true, invalidate() {},
    close() { env.nodes['modal-aguinaldo'].remove(); }
  };
  env.context.fbCargarGastos(); env.emit('sisventas/gastos', backend.get('sisventas/gastos'));
  env.emit('sisventas/aguinaldos', backend.get('sisventas/aguinaldos'));
  return { backend, transport, env };
}
function financialUntouched(backend) {
  return { haberes: backend.get('sisventas/haberes'), ctaemp: backend.get('sisventas/ctaemp'),
    aguinaldos: backend.get('sisventas/aguinaldos'), ventas: backend.get('sisventas/ventas') };
}

test('SAC por acción humana usa haberes del semestre, genera un solo commit y no duplica por doble clic/replay', async () => {
  const { backend, env } = financialPage(), untouched = financialUntouched(backend);
  assert.equal(backend.commands.length, 0, 'Abrir/recibir snapshots no debe escribir finanzas');
  await Promise.all([env.context.confirmarRegistroAguinaldo(), env.context.confirmarRegistroAguinaldo()]);
  assert.equal(env.commands.length, 1); assert.equal(backend.commits.length, 1);
  assert.equal(env.confirmations.length, 0, 'Las marcas SAC de otra colección no son duplicados pagables');
  assert.deepEqual(env.reads, [], 'Confirmar no vuelve a descargar la raíz de Haberes');
  assert.ok(env.commands[0].paths.includes('sisventas/haberes/e1'));
  assert.ok(env.commands[0].paths.includes('sisventas/empleados/e2'));
  assert.equal(backend.get('sisventas/gastos/aguinaldo_e1_2026_S2').mejorSueldo, 1200);
  assert.equal(backend.get('sisventas/gastos/aguinaldo_e2_2026_S2').mejorSueldo, 1800);
  const result = backend.get('sisventas/gastos');
  assert.deepEqual(Object.keys(result).sort(), ['aguinaldo_e1_2026_S2', 'aguinaldo_e2_2026_S2']);
  for (const [key, gasto] of Object.entries(result)) {
    assert.equal(gasto.tipoPagable, 'aguinaldo'); assert.equal(gasto.monto, 600); assert.equal(Number(gasto.montoPagado || 0), 0);
    assert.equal(gasto.fecha, '2026-12-01'); assert.equal(gasto.semestre, '2026_S2');
    assert.equal(gasto.legacyKey, 'sac/' + gasto.empleadoFbKey + '/2026_S2');
    assert.ok(Object.hasOwn(backend.commands[0].value, 'sisventas/gastos/' + key));
  }
  assert.ok(!Object.hasOwn(backend.commands[0].value, 'sisventas/gastos'), 'El commit no reemplaza la colección');
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(backend.commits.length, 1); assert.deepEqual(backend.get('sisventas/gastos'), result);
  assert.deepEqual(financialUntouched(backend), untouched); assert.deepEqual(backend.direct, []); assert.deepEqual(env.directWrites, []);
  assert.equal(env.context._aguinaldoGuardando, false); assert.equal(env.nodes['modal-aguinaldo'].removed, true);
});

test('SAC lee el sueldo fresco, respeta empleados seleccionados y aplica el tope editable', async () => {
  const { backend, env } = financialPage(), fresh = copy(salaries); fresh.e1['2026_10'].sueldo = 2400;
  backend.state.sisventas.haberes = copy(fresh); env.select(['e1']);
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(backend.commits.length, 1);
  assert.deepEqual(Object.keys(backend.get('sisventas/gastos')), ['aguinaldo_e1_2026_S2']);
  const saved = backend.get('sisventas/gastos/aguinaldo_e1_2026_S2');
  assert.equal(saved.monto, 700); assert.equal(saved.mejorSueldo, 2400);
  assert.deepEqual(env.reads, []);
  assert.ok(env.commands[0].paths.includes('sisventas/haberes/e1'));
  assert.ok(!env.commands[0].paths.some(p => p === 'sisventas/haberes/e2' || p.startsWith('sisventas/haberes/e2/')));
});

test('Duplicado pagado exige confirmación; Cancelar o perder permiso antes de guardar no consulta ni escribe', async () => {
  for (const scenario of ['cancel', 'denied']) {
    const { backend, env } = financialPage({ gastos: { legacyReal: copy(expenses.c) } });
    const before = copy(backend.state.sisventas);
    if (scenario === 'cancel') env.context.svConfirm = async message => { env.confirmations.push(message); return false; };
    else env.revoke();
    await env.context.confirmarRegistroAguinaldo();
    assert.equal(env.confirmations.length, scenario === 'cancel' ? 1 : 0);
    assert.equal(env.commands.length, 0); assert.equal(backend.commits.length, 0); assert.deepEqual(env.reads, []);
    assert.deepEqual(backend.state.sisventas, before); assert.equal(env.context._aguinaldoGuardando || false, false);
    assert.equal(env.nodes['modal-aguinaldo'].removed || false, false);
  }
});

test('Duplicado expresamente aprobado retiene ID de operación y conserva el pago histórico byte a byte', async () => {
  const { backend, env } = financialPage({ gastos: { legacyReal: copy(expenses.c) } });
  const old = backend.get('sisventas/gastos/legacyReal'), untouched = financialUntouched(backend);
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(env.confirmations.length, 1); assert.match(env.confirmations[0], /Ya existe aguinaldo registrado en Gastos/);
  assert.ok(Object.keys(backend.get('sisventas/gastos')).some(key => key.includes('fixture-sac')),
    'El duplicado autorizado conserva la identidad de operación del formulario');
  assert.equal(backend.commits.length, 1); assert.equal(Object.keys(backend.get('sisventas/gastos')).length, 3);
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(backend.commits.length, 1); assert.equal(Object.keys(backend.get('sisventas/gastos')).length, 3);
  assert.deepEqual(backend.get('sisventas/gastos/legacyReal'), old); assert.deepEqual(financialUntouched(backend), untouched);
});

test('El CAS real conserva un duplicado legacy agregado por otra operación entre lectura y commit', async () => {
  const { backend, env } = financialPage(); env.select(['e1']);
  const old = { tipoPagable: 'AGUINALDO', empleadoId: 'e1', semestre: '2026_S2', monto: 600,
    montoPagado: 600, estado: 'pagado', pagos: { original: { monto: 600, fecha: '2026-10-01' } } };
  let inserted = false;
  backend.setHook(async command => {
    if (!inserted && command.kind === 'atomic') {
      inserted = true;
      // A historical import appears after the client snapshot. A generic new
      // paid SAC is no longer accepted by the protected UI transport.
      backend.state.sisventas.gastos.legacyConcurrente = copy(old);
    }
  });
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(inserted, true); assert.deepEqual(backend.get('sisventas/gastos/legacyConcurrente'), old);
  assert.equal(backend.get('sisventas/gastos/aguinaldo_e1_2026_S2'), null);
  assert.equal(backend.commits.length, 0, 'El cliente no agrega ningún SAC sobre el importado');
  assert.equal(backend.commands.filter(command => command.kind === 'atomic').length, 1);
});

test('Un rechazo del transporte real no cierra el formulario ni usa una escritura legacy como alternativa', async () => {
  const { backend, env } = financialPage(), before = copy(backend.state.sisventas);
  backend.setRejectPatch(() => { throw Object.assign(new Error('Rechazo ficticio'), { statusCode: 403 }); });
  await env.context.confirmarRegistroAguinaldo();
  assert.equal(env.commands.length, 1); assert.equal(backend.commits.length, 0); assert.deepEqual(backend.state.sisventas, before);
  assert.match(env.messages.at(-1), /Error al registrar aguinaldo/);
  assert.equal(env.context._aguinaldoGuardando, false); assert.equal(env.nodes['modal-aguinaldo'].removed || false, false);
  assert.deepEqual(env.directWrites, []); assert.deepEqual(backend.direct, []);
});
