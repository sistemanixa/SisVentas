'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const {load}=require('./helpers/app-functions.cjs');

const bonus=(overrides={})=>({
  tipo:'bonificacion',estado:'aprobado',monto:75.25,fecha:'2026-10-19',
  periodoComputo:'2026-09',descripcion:'Bonificación · Trabajo ficticio',
  motivo:'Trabajo ficticio',empleadoId:'e',aprobadoPor:'Titular ficticio',
  aprobadoTs:1000,usuario:'Titular ficticio',ts:1000,...overrides
});
const paths=id=>({movement:'sisventas/ctaemp/e/bonificacion_e_'+id,expense:'sisventas/gastos/gasto_bonificacion_e_'+id});
const save=(page,movement,id)=>Promise.resolve().then(()=>page.context._guardarBonificacionEmpleadoAtomica(page.context.empData.e,movement,id));

function settledSalary(){
  const payment={fecha:'2026-10-05',monto:500,medio:'Transferencia',usuario:'Titular ficticio',ts:500};
  return {
    haberes:{e:{'2026_09':{sueldo:500,sueldoBase:500,bonificacion:0,gastoFbKey:'salary',fecha:'2026-09-30'}}},
    gastos:{salary:{tipoPagable:'sueldo',empleadoFbKey:'e',empleadoId:'e',monto:500,montoPagado:500,estado:'pagado',fecha:'2026-09-30',mes:'2026-09',descripcion:'Haber ficticio septiembre',pagos:{previous:payment},legacyKey:'ctaemp/e/salary'}},
    ctaemp:{e:{salary:{tipo:'sueldo',empleadoId:'e',monto:500,montoPagado:500,estado:'pagado',fecha:'2026-09-30',mes:'2026-09',gastoFbKey:'salary',pagos:{previous:payment}}}},
    pagos_realizados:{previous:{fecha:'2026-10-05',monto:500,gastos:[{gastoFbKey:'salary'}]}},
    auditoria_pagos:{previous:{accion:'Pago ficticio anterior',fecha:'2026-10-05',monto:500}}
  };
}

test('el período de bonificación admite sólo meses calendario y no se aplica a otros conceptos',()=>{
  const c={};load(c,['_bonificacionMesValido','_bonificacionPeriodoComputo']);
  for(const month of ['2026-01','2026-09','2026-12'])assert.equal(c._bonificacionMesValido(month),true,month);
  for(const value of ['',null,undefined,1,true,{},[],'2026-00','2026-13','2026-1','2026-09-01','26-09','septiembre'])assert.equal(c._bonificacionMesValido(value),false,String(value));
  assert.equal(c._bonificacionPeriodoComputo(bonus()),'2026-09');
  assert.equal(c._bonificacionPeriodoComputo({tipo:'Variable',tipoPagable:'bonificacion',periodoComputo:'2026-11'}),'2026-11');
  assert.equal(c._bonificacionPeriodoComputo({tipo:'sueldo',periodoComputo:'2026-09'}),'');
  assert.equal(c._bonificacionPeriodoComputo({tipo:'bonificacion',fecha:'2026-09-01'}),'');
});

test('el bono posterior conserva liquidación y pagos y separa mes de cómputo de fecha de registro',async()=>{
  const f=createBackend(settledSalary()),p=f.page(),id='bonus_period_fixture',before=copy(f.state.sisventas),target=paths(id);
  await save(p,bonus(),id);
  const movement=f.get(target.movement),expense=f.get(target.expense);
  assert.equal(movement.periodoComputo,'2026-09');assert.equal(expense.periodoComputo,'2026-09');
  assert.equal(movement.fecha,'2026-10-19');assert.equal(expense.fecha,'2026-10-19');assert.equal(expense.fechaImputacion,'2026-10-19');
  assert.equal(movement.gastoFbKey,'gasto_bonificacion_e_'+id);assert.equal(expense.legacyKey,'ctaemp/e/bonificacion_e_'+id);
  assert.equal(expense.monto,75.25);assert.equal(expense.estado,'aprobado');
  assert.deepEqual(f.get('sisventas/haberes'),before.haberes);
  assert.deepEqual(f.get('sisventas/gastos/salary'),before.gastos.salary);
  assert.deepEqual(f.get('sisventas/ctaemp/e/salary'),before.ctaemp.e.salary);
  assert.deepEqual(f.get('sisventas/pagos_realizados'),before.pagos_realizados);
  assert.deepEqual(f.get('sisventas/auditoria_pagos'),before.auditoria_pagos);
  assert.equal(f.commits.length,1);assert.equal(f.commands[0].kind,'atomic');assert.deepEqual(f.direct,[]);
});

test('repetir el mismo bono ya pagado conserva sus pagos sin crear otro gasto ni alterar el sueldo',async()=>{
  const f=createBackend(settledSalary()),p=f.page(),id='bonus_replay_fixture',movement=bonus(),target=paths(id);
  await save(p,movement,id);p.refresh();
  await p.context._registrarPagoGastoUnitario('gasto_bonificacion_e_'+id,75.25,'Efectivo',null,null);
  const before=copy(f.state.sisventas);
  await save(p,movement,id);
  assert.deepEqual(f.state.sisventas,before);assert.equal(f.get(target.expense).estado,'pagado');
  assert.equal(Object.keys(f.get(target.expense).pagos).length,1);
  assert.deepEqual(f.get('sisventas/haberes/e'),before.haberes.e);assert.deepEqual(f.direct,[]);
});

test('un replay con otro mes de cómputo se rechaza y conserva íntegro el bono confirmado',async()=>{
  const f=createBackend(settledSalary()),p=f.page(),id='bonus_conflict_fixture';
  await save(p,bonus(),id);const before=copy(f.state.sisventas),commits=f.commits.length;
  await assert.rejects(()=>save(p,bonus({periodoComputo:'2026-10'}),id),/bonificación|datos distintos|período|mes/i);
  assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,commits);assert.deepEqual(f.direct,[]);
});

test('dos bonificaciones de meses diferentes permanecen como adicionales separados',async()=>{
  const f=createBackend(settledSalary()),p=f.page(),before=f.get('sisventas/haberes');
  await save(p,bonus({periodoComputo:'2026-09'}),'bonus_sep_fixture');
  await save(p,bonus({periodoComputo:'2026-10'}),'bonus_oct_fixture');
  assert.equal(f.get(paths('bonus_sep_fixture').movement).periodoComputo,'2026-09');
  assert.equal(f.get(paths('bonus_oct_fixture').movement).periodoComputo,'2026-10');
  assert.equal(Object.keys(f.get('sisventas/gastos')).length,3);assert.equal(Object.keys(f.get('sisventas/ctaemp/e')).length,3);
  assert.deepEqual(f.get('sisventas/haberes'),before);assert.equal(f.commits.length,2);
});

test('pagar un bono usa la fecha efectiva del pago sin mover su período ni pagos anteriores',async()=>{
  const f=createBackend(settledSalary()),p=f.page(),id='bonus_pay_fixture',target=paths(id),salary=f.get('sisventas/gastos/salary');
  await save(p,bonus(),id);p.refresh();
  await p.context._registrarPagoGastoUnitario('gasto_bonificacion_e_'+id,25,'Transferencia',null,null);
  const expense=f.get(target.expense),movement=f.get(target.movement),payment=Object.values(expense.pagos)[0];
  assert.equal(payment.fecha,'2026-10-20');assert.equal(payment.monto,25);
  assert.equal(expense.periodoComputo,'2026-09');assert.equal(movement.periodoComputo,'2026-09');
  assert.equal(expense.fecha,'2026-10-19');assert.equal(movement.fecha,'2026-10-19');assert.equal(movement.fechaPago,'2026-10-20');
  assert.equal(expense.estado,'pagado_parcial');assert.equal(expense.montoPagado,25);
  assert.deepEqual(f.get('sisventas/gastos/salary'),salary);assert.deepEqual(f.direct,[]);
});

test('las llamadas legacy sin período explícito conservan la compatibilidad con su fecha',async()=>{
  const f=createBackend(),p=f.page(),movement=bonus();delete movement.periodoComputo;
  await save(p,movement,'bonus_legacy_fixture');
  assert.equal(f.get(paths('bonus_legacy_fixture').movement).periodoComputo,'2026-10');
  assert.equal(f.get(paths('bonus_legacy_fixture').expense).periodoComputo,'2026-10');
  assert.equal(f.get(paths('bonus_legacy_fixture').expense).fecha,'2026-10-19');
});

test('mes, importe o fecha inválidos se rechazan antes de enviar un comando financiero',async()=>{
  const invalid=[
    {periodoComputo:''},{periodoComputo:'2026-00'},{periodoComputo:'2026-13'},{periodoComputo:'2026-09-01'},
    {periodoComputo:null},{periodoComputo:true},{monto:0},{monto:-1},{monto:NaN},{monto:Infinity},
    {fecha:''},{fecha:'2026-02-31'},{tipo:'sueldo'}
  ];
  for(const overrides of invalid){
    const f=createBackend(settledSalary()),p=f.page(),before=copy(f.state.sisventas);
    await assert.rejects(()=>save(p,bonus(overrides),'bonus_invalid_fixture'));
    assert.equal(f.commands.length,0,JSON.stringify(overrides));assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);
  }
});

test('un empleado desactivado durante la comprobación no recibe un bono ni modifica registros existentes',async()=>{
  const f=createBackend({...settledSalary(),empleados:{e:{nombre:'Persona ficticia',activo:false,cargoId:'c'}}}),p=f.page(),before=copy(f.state.sisventas);
  await assert.rejects(()=>save(p,bonus(),'bonus_inactive_fixture'),/empleado|disponible|activo/i);
  assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.direct,[]);
});

test('los filtros y el saldo usan el período elegido pero la fecha visible y otros conceptos no cambian',async()=>{
  const f=createBackend(),p=f.page(),id='bonus_account_fixture';await save(p,bonus(),id);p.refresh();
  p.load(['_fechaCalendarioLocal','_fechaEsDelMes','_fechaMes','_fechaEnMes','_ctaEmpFechaLocalDesdeTs','_buscarGastoRelacionadoMovEmp','_ctaEmpFechaMovimiento','_ctaEmpMesDeMov','_movEmpEnPeriodo','_ctaEmpMovHastaPeriodo','_movEmpFechaVisual']);
  const movement=f.get(paths(id).movement),expense=f.get(paths(id).expense);
  assert.equal(p.context._ctaEmpMesDeMov(movement),'2026-09');assert.equal(p.context._movEmpFechaVisual(movement),'2026-10-19');
  assert.equal(p.context._movEmpEnPeriodo(movement,'2026-09'),true);assert.equal(p.context._movEmpEnPeriodo(movement,'2026-10'),false);
  assert.equal(p.context._ctaEmpMovHastaPeriodo(movement,'2026-08'),false);assert.equal(p.context._ctaEmpMovHastaPeriodo(movement,'2026-09'),true);assert.equal(p.context._ctaEmpMovHastaPeriodo(movement,'2026-10'),true);
  assert.equal(p.context._ctaEmpMesDeMov({tipo:'bonificacion',fecha:expense.fecha,periodoComputo:expense.periodoComputo,gastoFbKey:'gasto_bonificacion_e_'+id}),'2026-09');
  const salary={tipo:'sueldo',empleadoId:'e',monto:100,fecha:'2026-10-19',periodoComputo:'2026-09'};
  assert.equal(p.context._ctaEmpMesDeMov(salary),'2026-10');assert.equal(p.context._movEmpEnPeriodo(salary,'2026-10'),true);
  const legacy={tipo:'bonificacion',empleadoId:'e',monto:100,fecha:'2026-08-19'};
  assert.equal(p.context._ctaEmpMesDeMov(legacy),'2026-08');assert.equal(p.context._movEmpFechaVisual(legacy),'2026-08-19');
  const future={tipo:'bonificacion',empleadoId:'e',monto:125,descripcion:'Otro bono ficticio',fecha:'2026-10-19',periodoComputo:'2026-11'};
  assert.equal(p.context._ctaEmpMovHastaPeriodo(future,'2026-10'),false);
});
