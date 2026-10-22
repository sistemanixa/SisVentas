'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Bonus = require('../js/core/bonus-quantity-model.js');
const invalid = fn => assert.throws(fn, { code: 'SV_BONUS_QUANTITY_INVALID' });
const groupId = 'bonus_group_fixture_001';
const makePlan = (empleados = [{ empleadoId: 'e_ana', cantidad: '1' }], valorUnitario = '75.25') => Bonus.plan({ empleados, valorUnitario });

test('cantidad individual por valor unitario conserva decimales y redondea por persona', () => {
  const cases = [
    ['1', '75.25', 1, 75.25, 75.25], ['2.5', '75.25', 2.5, 75.25, 188.13],
    ['1.111', '75.25', 1.111, 75.25, 83.6], ['1.005', '1', 1.005, 1, 1.01],
    ['0.5', '0.01', 0.5, 0.01, 0.01], ['2.345', '75.25', 2.345, 75.25, 176.46],
    ['0.125', '350000', 0.125, 350000, 43750], ['0.001', '1000', 0.001, 1000, 1],
    ['1.234', '1', 1.234, 1, 1.23], ['0.145', '0.10', 0.145, 0.1, 0.01]
  ];
  for (const [quantity, price, cantidad, valorUnitario, monto] of cases) {
    assert.deepEqual(Bonus.line(quantity, price), { cantidad, valorUnitario, monto }, quantity + ' × ' + price);
  }
  assert.equal(Math.round(1.005 * 100) / 100, 1, 'La fixture debe detectar el bug binario del redondeo ingenuo');
});

test('cantidad acepta hasta tres decimales y precio hasta dos, en punto/coma o números finitos', () => {
  for (const [quantity, price] of [[' 001,005 ', ' 01,00 '], ['1.005', '1.00'], [1.005, 1]]) {
    assert.deepEqual(Bonus.line(quantity, price), { cantidad: 1.005, valorUnitario: 1, monto: 1.01 });
  }
  assert.deepEqual(Bonus.line('1000', '0.01'), { cantidad: 1000, valorUnitario: 0.01, monto: 10 });
  assert.deepEqual(Bonus.line('1,234', '1'), { cantidad: 1.234, valorUnitario: 1, monto: 1.23 }, 'Cantidad no debe tratarse como input monetario con miles');
});

test('el parser rechaza objetos/arrays/booleanos y no acepta parseos parciales', () => {
  const bad = [null, undefined, true, false, {}, [], [1], { valueOf: () => 1 }, { toString: () => '1' },
    NaN, Infinity, -Infinity, '', ' ', '1e3', '1abc', '$1', '+1', '-1', '1,2,3', '1.2.3', '1 000'];
  for (const value of bad) {
    invalid(() => Bonus.line(value, '1'));
    invalid(() => Bonus.line('1', value));
  }
  for (const quantity of ['1.0001', '0.0001', '1,2345', '0']) invalid(() => Bonus.line(quantity, '1'));
  for (const price of ['1.001', '0.001', '1,234', '0']) invalid(() => Bonus.line('1', price));
});

test('la fracción positiva que redondea a cero bloquea la persona y el lote entero', () => {
  invalid(() => Bonus.line('0.001', '0.01'));
  invalid(() => makePlan([{ empleadoId: 'e_ana', cantidad: '1' }, { empleadoId: 'e_bea', cantidad: '0.001' }], '0.01'));
});

test('el total suma subtotales ya redondeados por persona y no el producto agregado', () => {
  const plan = makePlan([{ empleadoId: 'e_ana', cantidad: '0.5' }, { empleadoId: 'e_bea', cantidad: '0.5' }], '0.01');
  assert.deepEqual(plan.items.map(row => row.monto), [0.01, 0.01]);
  assert.equal(plan.unidades, 1); assert.equal(plan.total, 0.02);
  assert.notEqual(plan.total, Bonus.line(plan.unidades, plan.valorUnitario).monto);
});

test('el lote de cantidades distintas expone detalle, total346,98 y orden estable por identidad', () => {
  const selected = [{ empleadoId: 'e_ciro', cantidad: '1.111' }, { empleadoId: 'e_ana', cantidad: '1' }, { empleadoId: 'e_bea', cantidad: '2.5' }];
  const before = structuredClone(selected), plan = makePlan(selected), reverse = makePlan(selected.slice().reverse());
  assert.deepEqual(plan.ids, ['e_ana', 'e_bea', 'e_ciro']);
  assert.deepEqual(plan.items.map(row => [row.empleadoId, row.cantidad, row.monto]), [['e_ana', 1, 75.25], ['e_bea', 2.5, 188.13], ['e_ciro', 1.111, 83.6]]);
  assert.equal(plan.total, 346.98); assert.equal(plan.unidades, 4.611); assert.equal(plan.valorUnitario, 75.25);
  assert.deepEqual(plan, reverse, 'Cambiar el orden de selección no cambia la intención canónica');
  assert.deepEqual(selected, before, 'No modifica la selección de la interfaz');
});

test('sin selección no hay plan y42 personas caben sin fragmentar el límite del guardado', () => {
  for (const rows of [undefined, null, [], {}, 'e_ana']) invalid(() => Bonus.plan({ empleados: rows, valorUnitario: '1' }));
  const employees = Array.from({ length: 42 }, (_, i) => ({ empleadoId: 'employee_' + i, cantidad: '1' }));
  const plan = makePlan(employees, '1'); assert.equal(plan.items.length, 42); assert.equal(plan.total, 42);
  assert.equal(plan.items.length * 3, 126, 'CTA + Gasto + empleado por persona deben caber en128paths');
  invalid(() => makePlan([...employees, { empleadoId: 'employee_42', cantidad: '1' }], '1'));
});

test('no fusiona personas distintas ni admite identidades duplicadas o destinos que colisionan', () => {
  const two = makePlan([{ empleadoId: 'e_juan_1', cantidad: '1' }, { empleadoId: 'e_juan_2', cantidad: '1' }]);
  assert.equal(two.items.length, 2, 'El nombre visible no identifica a una persona');
  invalid(() => makePlan([{ empleadoId: 'e_ana', cantidad: '1' }, { empleadoId: 'e_ana', cantidad: '2' }]));
  assert.equal(Bonus.operationKey('bonificacion', ['a b', 'operation']), Bonus.operationKey('bonificacion', ['a_b', 'operation']), 'La fixture reproduce colisión del saneado legacy');
  invalid(() => makePlan([{ empleadoId: 'a b', cantidad: '1' }, { empleadoId: 'a_b', cantidad: '1' }]));
});

test('las claves de empleado conservan identidad y rechazan rutas o prototipos peligrosos', () => {
  for (const value of ['e-1', 'e_1', '01', 'empleado_ñ']) assert.equal(Bonus.employeeKey(value), value);
  for (const value of ['', 1, null, {}, [], 'a'.repeat(129), '__proto__', 'constructor', 'prototype', 'hasOwnProperty',
    'a.b', 'a#b', 'a$b', 'a[b', 'a]b', 'a/b', 'a\u0000b', 'a\u001fb', 'a\u007fb']) invalid(() => Bonus.employeeKey(value));
});

test('límites de cantidad, importe individual y suma del lote se validan con enteros seguros', () => {
  assert.equal(Bonus.line('1000000', '0.01').monto, 10000);
  invalid(() => Bonus.line('1000000.001', '0.01'));
  assert.equal(Bonus.line('1', '1000000000000').monto, 1000000000000);
  invalid(() => Bonus.line('1', '1000000000000.01'));
  invalid(() => Bonus.line('2', '1000000000000'));
  invalid(() => Bonus.line('1', '9'.repeat(300)));
  const two = [{ empleadoId: 'e_ana', cantidad: '1' }, { empleadoId: 'e_bea', cantidad: '1' }];
  assert.equal(makePlan(two, '500000000000').total, 1000000000000);
  invalid(() => makePlan([...two, { empleadoId: 'e_ciro', cantidad: '1' }], '500000000000'));
});

test('metadatos vinculan cada persona con el mismo grupo completo y guardan el detalle calculado', () => {
  const plan = makePlan([{ empleadoId: 'e_ana', cantidad: '1' }, { empleadoId: 'e_bea', cantidad: '2.5' }]);
  const before = structuredClone(plan);
  const first = Bonus.metadata(plan.items[0], groupId, plan), second = Bonus.metadata(plan.items[1], groupId, plan);
  assert.deepEqual(first, { bonificacionCantidad: 1, bonificacionValorUnitario: 75.25, bonificacionGrupoId: groupId,
    bonificacionDestinatarios: ['e_ana', 'e_bea'], bonificacionGrupoTotal: 263.38, bonificacionGrupoPersonas: 2 });
  assert.equal(second.bonificacionCantidad, 2.5); assert.equal(second.bonificacionValorUnitario, 75.25);
  for (const field of ['bonificacionGrupoId', 'bonificacionGrupoTotal', 'bonificacionGrupoPersonas']) assert.equal(first[field], second[field]);
  assert.deepEqual(first.bonificacionDestinatarios, second.bonificacionDestinatarios);
  assert.deepEqual(plan, before);
  first.bonificacionDestinatarios.push('otro');
  assert.deepEqual(second.bonificacionDestinatarios, ['e_ana', 'e_bea']); assert.deepEqual(plan.ids, ['e_ana', 'e_bea']);
  assert.equal(Object.hasOwn(first, 'sueldo'), false); assert.equal(Object.hasOwn(first, 'pagos'), false);
});

test('metadatos rechazan cambio de detalle aunque el monto coincida, y destinatarios/totales alterados', () => {
  const plan = makePlan([{ empleadoId: 'e_ana', cantidad: '1' }], '100'), item = plan.items[0];
  invalid(() => Bonus.metadata({ ...item, cantidad: 2, valorUnitario: 50 }, groupId, plan));
  invalid(() => Bonus.metadata({ ...item, monto: 99.99 }, groupId, plan));
  invalid(() => Bonus.metadata({ ...item, empleadoId: 'e_bea' }, groupId, plan));
  invalid(() => Bonus.metadata(item, groupId, { ...plan, total: 99.99 }));
  invalid(() => Bonus.metadata(item, groupId, { ...plan, ids: ['e_ana', 'e_bea'] }));
  invalid(() => Bonus.metadata(item, groupId, { ...plan, items: [{ ...item, cantidad: 2 }] }));
  invalid(() => Bonus.metadata(item, groupId, null));
  for (const id of ['', 'short', 'bad/group', '<img>', 'x'.repeat(161), null, 123]) invalid(() => Bonus.metadata(item, id, plan));
});

test('500 combinaciones decimales contrastan con un oráculo entero independiente de la implementación', () => {
  let seed = 20261022;
  function next(max) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; }
  function decimal(integer, places) { const text = String(integer).padStart(places + 1, '0'); return text.slice(0, -places) + '.' + text.slice(-places); }
  for (let i = 0; i < 500; i++) {
    const mills = next(1000000) + 1, cents = next(1000000) + 1;
    const expected = (BigInt(mills) * BigInt(cents) + 500n) / 1000n;
    if (!expected) invalid(() => Bonus.line(decimal(mills, 3), decimal(cents, 2)));
    else assert.equal(Bonus.line(decimal(mills, 3), decimal(cents, 2)).monto, Number(expected) / 100);
  }
});

test('la API del navegador calcula el mismo lote sin acceso a red, DOM ni finanzas', () => {
  let calls = 0;
  const context = { fetch() { calls++; assert.fail('Sin red'); }, document: { getElementById() { calls++; assert.fail('Sin DOM'); } } };
  context.window = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core/bonus-quantity-model.js'), 'utf8'), context);
  const plan = context.SVBonusQuantity.plan({ empleados: [{ empleadoId: 'e_ana', cantidad: '0.5' }, { empleadoId: 'e_bea', cantidad: '0.5' }], valorUnitario: '0.01' });
  assert.equal(plan.total, 0.02); assert.equal(plan.items.length, 2); assert.equal(calls, 0);
});
