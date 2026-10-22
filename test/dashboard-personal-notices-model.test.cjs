'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Model = require('../js/core/dashboard-personal-notices.v1');
const Bonus = require('../js/core/bonus-quantity-model');
const Grant = require('../js/modules/bonus-grant');
const {createBackend, copy} = require('./helpers/labor-ui-flow.cjs');

const now = '2026-10-22';
const stamp = (day, hour = 12) => new Date(day + 'T' + String(hour).padStart(2, '0') + ':00:00').getTime();
function record(overrides = {}) {
  return {id:'cta:m1', employeeId:'employee', type:'bonificacion', sourceRefs:{ctaKey:'m1', gastoKey:'g1'}, amount:100.01, paidAmount:0,
    status:'aprobado', approvedTs:stamp(now), createdTs:stamp(now), grantDate:now, periodoComputo:'2026-11',
    description:'Trabajo ficticio', quantity:2, unitAmount:50, visible:true, ...overrides};
}
const build = (records, overrides = {}) => Model.build({employeeId:'employee', records, now, complete:true, ...overrides});

test('CommonJS and browser expose the same pure API without network, timers or storage', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../js/core/dashboard-personal-notices.v1.js'), 'utf8');
  const forbidden = () => { throw Error('No se permite efecto externo'); };
  const context = {window:{fetch:forbidden, localStorage:{setItem:forbidden}, setTimeout:forbidden}, fetch:forbidden, setTimeout:forbidden};
  vm.createContext(context); vm.runInContext(source, context);
  assert.equal(typeof context.window.SVPersonalNotices.build, 'function');
  const input = {employeeId:'employee', records:[record()], now, complete:true};
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SVPersonalNotices.build(input))), Model.build(input));
});

test('real bonus6 batch fixture yields one own notice per exact CTA/Gasto pair without touching salary, payments or commissions', async () => {
  const historical = {monto:800, estado:'pagado', pagos:{p:{monto:800}}};
  const backend = createBackend({empleados:{employee:{nombre:'Persona ficticia', activo:true}, other:{nombre:'Otra persona', activo:true}},
    haberes:{employee:{anterior:{sueldo:800, pagos:{p:800}}}}, gastos:{salary:copy(historical)}, ctaemp:{employee:{salary:copy(historical)}}, comisiones_generacion:{previous:{estado:'completada'}}});
  const page = backend.page(); page.context.SVBonusQuantity = Bonus;
  const attempt = Grant.create(page.context).prepare({context:()=>true, operacionId:'grupo_fixture_personal', empleados:[{empleadoId:'employee', cantidad:5}, {empleadoId:'other', cantidad:2}],
    valorUnitario:79.99, fecha:now, periodoComputo:'2026-11', motivo:'Tarea ficticia', concepto:{id:'concept', nombre:'Concepto ficticio'}});
  await Grant.create(page.context).register(attempt);
  const dto = attempt.records.flatMap(row => ['movement', 'expense'].map(source => {
    const value = backend.get(source === 'movement' ? row.movementPath : row.expensePath);
    return record({id:source + ':' + row.employeeId, employeeId:row.employeeId, type:value.tipoPagable || value.tipo,
      sourceRefs:{ctaKey:row.movementPath.split('/').at(-1), gastoKey:row.expensePath.split('/').at(-1)},
      amount:value.monto, paidAmount:0, status:value.estado, approvedTs:value.aprobadoTs, createdTs:value.ts,
      grantDate:value.fecha, periodoComputo:value.periodoComputo, description:value.descripcion,
      quantity:value.bonificacionCantidad, unitAmount:value.bonificacionValorUnitario, bonificacionGrupoId:value.bonificacionGrupoId});
  }));
  const before = copy(backend.state), reads = backend.reads.length, commands = backend.commands.length;
  const result = build(dto, {now:attempt.records[0].movement.aprobadoTs});
  assert.equal(result.status, 'ready'); assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, 399.95); assert.equal(result.items[0].remaining, 399.95);
  assert.equal(result.items[0].period, '2026-11'); assert.equal(result.items[0].quantity, 5); assert.equal(result.items[0].unitAmount, 79.99);
  assert.deepEqual(backend.state, before); assert.equal(backend.reads.length, reads); assert.equal(backend.commands.length, commands);
});

test('foreign accounts, unsupported types and movements not explicitly visible never become personal notices', () => {
  for (const changed of [{employeeId:'other'}, {type:'sueldo'}, {visible:false}, {visible:undefined}, {visible:1}]) {
    assert.deepEqual(build([record(changed)]), {status:'ready', items:[], issues:[]});
  }
});

test('a group shared by multiple employees is not used as identity; distinct own destinations remain distinct', () => {
  const result = build([record({bonificacionGrupoId:'same-group'}), record({id:'other', employeeId:'other', bonificacionGrupoId:'same-group'}),
    record({id:'second', sourceRefs:{ctaKey:'m2', gastoKey:'g2'}, bonificacionGrupoId:'same-group'})]);
  assert.equal(result.items.length, 2); assert.equal(new Set(result.items.map(item => item.id)).size, 2);
});

test('same amount, text and month with different technical references never collapse', () => {
  assert.equal(build([record(), record({id:'second', sourceRefs:{ctaKey:'m2', gastoKey:'g2'}})]).items.length, 2);
});

test('overlapping exact references reconcile into one stable item in either input order', () => {
  const records = [record({id:'cta', sourceRefs:{ctaKey:'m1'}}), record({id:'pair'}), record({id:'expense', sourceRefs:{gastoKey:'g1'}})];
  const result = build(records); assert.equal(result.status, 'ready'); assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'gasto:employee:g1'); assert.deepEqual(result.items[0].sourceRefs, {ctaKey:'m1', gastoKey:'g1'});
  assert.deepEqual(build(records.toReversed()), result);
});

for (const refs of [{ctaKey:'m1', gastoKey:'g2'}, {ctaKey:'m2', gastoKey:'g1'}]) test('conflicting technical links fail closed: ' + JSON.stringify(refs), () => {
  const result = build([record(), record({id:'second', sourceRefs:refs})]);
  assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0); assert.equal(result.issues[0].code, 'CONFLICTING_LINKS');
});

for (const changed of [{type:'comision'}, {amount:100.02}, {paidAmount:0.01}, {status:'pagado'}, {periodoComputo:'2026-12'}, {quantity:3}, {unitAmount:49},
  {approvedTs:stamp('2026-10-21')}, {visible:false}]) test('a contradictory linked mirror is not guessed: ' + JSON.stringify(changed), () => {
  const result = build([record(), record({id:'mirror', ...changed})]);
  assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0); assert.equal(result.issues.length, 1);
});

test('a bad pair does not suppress unrelated verified notices', () => {
  const result = build([record(), record({id:'conflict', amount:200}), record({id:'valid', sourceRefs:{gastoKey:'valid'}})]);
  assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 1); assert.equal(result.items[0].id, 'gasto:employee:valid');
});

test('a malformed secondary reference cannot erase a terminal or hidden mirror of a valid linked source', () => {
  for (const changed of [{status:'anulado'}, {visible:false, status:'pendiente'}, {id:''}]) {
    const result = build([record(), record({id:'malformed', sourceRefs:{ctaKey:'bad/path', gastoKey:'g1'}, ...changed})]);
    assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0); assert.equal(result.issues[0].code, 'INVALID_IDENTITY');
  }
});

test('approved and canonical payment states are presentation data, not reapproval or another commission calculation', () => {
  for (const [status, paidAmount, remaining] of [['aprobado',0,100.01], ['pagado_parcial',40.01,60], ['pagado',100.01,0], ['pendiente',0,100.01]]) {
    const result = build([record({type:'comision', status, paidAmount})]);
    assert.equal(result.status, 'ready'); assert.equal(result.items[0].status, status); assert.equal(result.items[0].remaining, remaining);
  }
});

test('a pending commission without permission-visible evidence does not become an approved notice', () => {
  assert.equal(build([record({type:'comision', status:'pendiente', visible:false})]).items.length, 0);
  const result = build([record({type:'comision', status:'pendiente', approvedTs:undefined})]);
  assert.equal(result.items[0].status, 'pendiente');
  assert.equal(build([record({status:'pendiente_pago'})]).status, 'incomplete');
});

test('rejected and annulled awards are omitted, including an inconsistent linked terminal mirror', () => {
  for (const status of ['rechazado', 'anulado']) {
    assert.deepEqual(build([record({status})]), {status:'ready', items:[], issues:[]});
    assert.equal(build([record(), record({id:'terminal', status})]).items.length, 0);
  }
});

test('manual paid legacy with no details is marked unknown instead of inventing a paid amount or balance', () => {
  const result = build([record({status:'pagado', paidAmount:0, paidAmountUnknown:true})]);
  assert.equal(result.items[0].paidAmountUnknown, true); assert.equal(result.items[0].paidAmount, null); assert.equal(result.items[0].remaining, null);
  assert.equal(build([record({paidAmountUnknown:true})]).status, 'incomplete');
});

test('a contradictory payment state fails closed without granting approval or rewriting canonical values', () => {
  for (const changed of [{status:'pagado',paidAmount:0}, {status:'pagado',paidAmount:20}, {status:'pagado_parcial',paidAmount:0},
    {status:'pagado_parcial',paidAmount:100.01}, {status:'aprobado',paidAmount:1}, {status:'pendiente',paidAmount:1}]) {
    const result = build([record(changed)]); assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0);
    assert.equal(result.issues[0].code, 'CONFLICTING_PAYMENT_STATE');
  }
});

test('the canonical one-cent paid threshold and an overpayment remain unchanged', () => {
  const paid = build([record({amount:100,paidAmount:99.99,status:'pagado'})]);
  assert.equal(paid.status, 'ready'); assert.equal(paid.items[0].paidAmount, 99.99); assert.equal(paid.items[0].remaining, 0.01);
  assert.equal(build([record({amount:100,paidAmount:99.98,status:'pagado_parcial'})]).status, 'ready');
  const over = build([record({amount:100,paidAmount:101,status:'pagado'})]);
  assert.equal(over.status, 'ready'); assert.equal(over.items[0].paidAmount, 101); assert.equal(over.items[0].remaining, 0);
});

test('annulled-only payment history already resolved as zero is kept zero; no MAX or scalar fallback is performed', () => {
  const result = build([record({paidAmount:0, pagos:{voided:{monto:100.01, anulado:true}}, montoPagado:100.01})]);
  assert.equal(result.items[0].paidAmount, 0); assert.equal(result.items[0].remaining, 100.01);
});

test('canonical sums of decimal-cent payments tolerate only IEEE noise, not fractional cents', () => {
  const result = build([record({status:'pagado_parcial', amount:1, paidAmount:0.1 + 0.2})]);
  assert.equal(result.status, 'ready'); assert.equal(result.items[0].paidAmount, 0.3); assert.equal(result.items[0].remaining, 0.7);
  assert.equal(build([record({paidAmount:0.301})]).status, 'incomplete');
});

test('the novelty date prioritizes approval, then creation, then a real ISO grant date', () => {
  let result = build([record({approvedTs:stamp('2026-10-21'), createdTs:stamp('2026-10-20'), grantDate:'2026-10-19'})]);
  assert.equal(result.items[0].date, '2026-10-21');
  result = build([record({approvedTs:NaN, createdTs:stamp('2026-10-20')})]); assert.equal(result.items[0].date, '2026-10-20');
  result = build([record({approvedTs:undefined, createdTs:undefined, grantDate:'2026-10-19'})]); assert.equal(result.items[0].date, '2026-10-19');
});

test('linked legacy dates below the selected approval/creation evidence do not create a false conflict', () => {
  const approved = build([record(), record({id:'migrated', createdTs:stamp('2026-09-01'), grantDate:'2026-09-01'})]);
  assert.equal(approved.status, 'ready'); assert.equal(approved.items[0].date, now);
  const created = build([record({approvedTs:undefined}), record({id:'other', approvedTs:undefined, grantDate:'2026-09-01'})]);
  assert.equal(created.status, 'ready'); assert.equal(created.items[0].date, now);
  assert.equal(build([record({approvedTs:undefined}), record({id:'other',approvedTs:undefined,createdTs:stamp('2026-10-21')})]).status, 'incomplete');
  assert.equal(build([record({approvedTs:undefined,createdTs:undefined}), record({id:'other',approvedTs:undefined,createdTs:undefined,grantDate:'2026-10-21'})]).status, 'incomplete');
});

test('the 30-calendar-day window includes today and 29 previous dates independent of clock hour', () => {
  const records = ['2026-09-22', '2026-09-23', '2026-10-22', '2026-10-23'].map((date,index) => record({id:String(index), sourceRefs:{gastoKey:'g'+index}, approvedTs:stamp(date,23), createdTs:undefined, grantDate:date}));
  assert.deepEqual(build(records, {now:stamp(now,1)}).items.map(item => item.date), ['2026-10-22', '2026-09-23']);
});

test('a valid future approval is not replaced with an older creation or grant date', () => {
  assert.deepEqual(build([record({approvedTs:stamp('2026-10-23')})]), {status:'ready', items:[], issues:[]});
});

test('computation month is explicit and may be future; it never decides whether the award is recent', () => {
  const result = build([record({periodoComputo:'2027-02'})]);
  assert.equal(result.items.length, 1); assert.equal(result.items[0].period, '2027-02');
  assert.equal(build([record({approvedTs:stamp('2026-08-01'), createdTs:stamp('2026-08-01'), periodoComputo:'2026-10'})]).items.length, 0);
});

test('a later payment or administrative removal does not renew an old award', () => {
  const base = record({approvedTs:stamp('2026-08-01'), createdTs:stamp('2026-08-01'), grantDate:'2026-08-01'});
  assert.equal(build([{...base, status:'pagado', paidAmount:100.01, pagadoTs:stamp(now), modificadoTs:stamp(now), fechaPago:now, bajaAdministrativa:{ts:stamp(now)}}]).items.length, 0);
});

test('undated or impossible calendar legacy is not assumed recent', () => {
  for (const grantDate of ['', '2026-02-30', '22/10/2026']) {
    const result = build([record({approvedTs:undefined, createdTs:undefined, grantDate})]);
    assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0); assert.equal(result.issues[0].code, 'MISSING_DATE');
  }
});

for (const changed of [{amount:NaN}, {amount:Infinity}, {amount:-1}, {amount:1.001}, {amount:'100'}, {paidAmount:NaN}, {paidAmount:-1}, {paidAmount:1.001},
  {quantity:1.0001}, {quantity:-1}, {unitAmount:NaN}, {unitAmount:1.001}, {periodoComputo:'2026-13'}, {sourceRefs:{}}, {sourceRefs:{gastoKey:'bad/path'}}]) test('malformed financial or technical detail is incomplete: ' + JSON.stringify(changed), () => {
  const result = build([record(changed)]); assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 0);
});

test('missing optional historical quantity and period remain unknown without changing the stored amount', () => {
  const result = build([record({quantity:undefined, unitAmount:undefined, periodoComputo:''})]);
  assert.equal(result.status, 'ready'); assert.equal(result.items[0].quantity, null); assert.equal(result.items[0].unitAmount, null); assert.equal(result.items[0].period, null); assert.equal(result.items[0].amount, 100.01);
});

test('incomplete source is not a ready zero and can retain individually verified notices', () => {
  assert.equal(build([], {complete:false}).status, 'incomplete');
  const result = build([record()], {complete:false}); assert.equal(result.status, 'incomplete'); assert.equal(result.items.length, 1);
  for (const override of [{employeeId:''}, {now:'2026-02-30'}, {records:null}]) assert.equal(Model.build({employeeId:'employee', records:[record()], now, complete:true, ...override}).status, 'incomplete');
});

test('input stays untouched and each build returns isolated data with deterministic order', () => {
  const input = [record({sourceRefs:{ctaKey:'b'}, approvedTs:undefined, createdTs:undefined}), record({id:'a', sourceRefs:{ctaKey:'a'}, approvedTs:undefined, createdTs:undefined})];
  const before = copy(input), first = build(input); first.items[0].sourceRefs.ctaKey = 'changed';
  assert.deepEqual(input, before); assert.deepEqual(build(input).items.map(item => item.id), ['cta:employee:a', 'cta:employee:b']);
});
