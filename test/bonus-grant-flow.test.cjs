'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../js/core/bonus-quantity-model'),Grant=require('../js/modules/bonus-grant');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const salary={tipoPagable:'sueldo',monto:500,montoPagado:500,estado:'pagado',pagos:{old:{monto:500,fecha:'2026-10-01'}}};
function fixture(){
 const backend=createBackend({empleados:{e:{nombre:'Persona ficticia',activo:true},b:{nombre:'Otra persona ficticia',activo:true}},haberes:{e:{octubre:{sueldo:500,total:500}}},gastos:{salary:copy(salary)},ctaemp:{e:{salary:copy(salary)}},comisiones_generacion:{old:{estado:'completada'}}});
 const page=backend.page();page.context.SVBonusQuantity=Model;const grant=Grant.create(page.context);
 const input={context:()=>true,operacionId:'bono_grupo_fixture',empleados:[{empleadoId:'e',cantidad:5},{empleadoId:'b',cantidad:2}],valorUnitario:79.99,fecha:'2026-10-22',periodoComputo:'2026-11',motivo:'Carpintería ficticia',concepto:{id:'concepto_fixture',nombre:'TAREA FICTICIA'}};
 return {backend,page,grant,input};
}
test('preparar unidades para varios empleados no lee ni escribe y congela el intento entero',()=>{
 const {backend,grant,input}=fixture(),attempt=grant.prepare(input);assert.equal(attempt.plan.total,559.93);assert.equal(attempt.records.length,2);assert.deepEqual(backend.reads,[]);assert.deepEqual(backend.commands,[]);
 assert.ok(Object.isFrozen(attempt)&&Object.isFrozen(attempt.records)&&Object.isFrozen(attempt.plan.items[0]));
 input.empleados[0].cantidad=99;input.concepto.nombre='Otro';assert.equal(attempt.plan.items.find(row=>row.empleadoId==='e').cantidad,5);assert.equal(attempt.records[0].movement.bonificacionConceptoNombre,'TAREA FICTICIA');
});
test('un grupo usa un commit con todos los destinos, unidades y precio, preservando sueldo, pagos y comisiones',async()=>{
 const {backend,grant,input}=fixture(),before=copy(backend.state.sisventas),attempt=grant.prepare(input),result=await grant.register(attempt);
 assert.deepEqual(result,{count:2,total:559.93,replayed:false});assert.equal(backend.commands.length,1);assert.equal(backend.commits.length,1);
 assert.equal(backend.commands[0].purpose,'employee-bonus-batch');assert.equal(Object.keys(backend.commands[0].expectedHashes).length,6);assert.equal(Object.keys(backend.commands[0].value).length,4);
 for(const row of attempt.records){const movement=backend.get(row.movementPath),expense=backend.get(row.expensePath),expected=attempt.plan.items.find(item=>item.empleadoId===row.employeeId);
  for(const record of [movement,expense]){assert.equal(record.bonificacionCantidad,expected.cantidad);assert.equal(record.bonificacionValorUnitario,79.99);assert.equal(record.monto,expected.monto);assert.equal(record.bonificacionGrupoTotal,559.93);assert.equal(record.bonificacionGrupoPersonas,2);assert.deepEqual(record.bonificacionDestinatarios,['b','e']);assert.equal(record.periodoComputo,'2026-11');assert.equal(record.bonificacionConceptoNombre,'TAREA FICTICIA');}
 }
 for(const path of ['haberes','config','comisiones_generacion'])assert.deepEqual(backend.state.sisventas[path],before[path]);assert.deepEqual(backend.state.sisventas.gastos.salary,before.gastos.salary);assert.deepEqual(backend.state.sisventas.ctaemp.e.salary,before.ctaemp.e.salary);assert.deepEqual(backend.direct,[]);
});
test('cinco cerraduras multiplican el ítem por cinco y las medias unidades se redondean por destinatario',async()=>{
 for(const [employees,price,total]of [[[{empleadoId:'e',cantidad:5}],100,500],[[{empleadoId:'e',cantidad:'0,5'},{empleadoId:'b',cantidad:'0,5'}],0.01,0.02]]){
  const {backend,grant,input}=fixture(),attempt=grant.prepare({...input,empleados:employees,valorUnitario:price});await grant.register(attempt);assert.equal(attempt.plan.total,total);assert.equal(backend.commits.length,1);
 }
});
test('repetir el mismo grupo después de pagar conserva todo y no crea otra operación',async()=>{
 const {backend,page,grant,input}=fixture(),attempt=grant.prepare(input);await grant.register(attempt);page.refresh();const row=attempt.records.find(row=>row.employeeId==='e');await page.context._registrarPagoGastoUnitario(row.expensePath.split('/').at(-1),25,'Efectivo',null,null);
 const before=copy(backend.state.sisventas),count=backend.commands.length,result=await grant.register(attempt);assert.equal(result.replayed,true);assert.equal(backend.commands.length,count);assert.deepEqual(backend.state.sisventas,before);
});
test('grupo parcial o mismo importe con otra cantidad/valor rechaza todo sin completar ni duplicar',async()=>{
 for(const kind of ['partial','detail','recipients']){
  const {backend,grant,input}=fixture(),attempt=grant.prepare(input);await grant.register(attempt);let next=attempt;
  if(kind==='partial')delete backend.state.sisventas.gastos[attempt.records[0].expensePath.split('/').at(-1)];
  else if(kind==='detail')next=grant.prepare({...input,empleados:input.empleados.map(row=>({...row,cantidad:row.cantidad/2})),valorUnitario:159.98});
  else next=grant.prepare({...input,empleados:[input.empleados[0]]});
  const before=copy(backend.state.sisventas),count=backend.commits.length;await assert.rejects(()=>grant.register(next),/parcial|detalle|datos|grupo/i);assert.equal(backend.commits.length,count);assert.deepEqual(backend.state.sisventas,before);
 }
});
test('un destinatario dado de baja aborta el grupo completo y no sustituye los demás',async()=>{
 const {backend,grant,input}=fixture(),attempt=grant.prepare(input);backend.state.sisventas.empleados.b.activo=false;const before=copy(backend.state.sisventas);await assert.rejects(()=>grant.register(attempt),/no está activo/);assert.equal(backend.commands.length,0);assert.equal(backend.commits.length,0);assert.deepEqual(backend.state.sisventas,before);
});
test('sesión cambiada y selecciones inválidas no inician escrituras',async()=>{
 const {backend,grant,input}=fixture();let current=true;const attempt=grant.prepare({...input,context:()=>current});current=false;await assert.rejects(()=>grant.register(attempt),/sesión|permiso/);
 for(const invalid of [{empleados:[]},{valorUnitario:0},{fecha:'2026-02-30'},{periodoComputo:''},{motivo:''},{empleados:[{empleadoId:'e',cantidad:0}]}])assert.throws(()=>grant.prepare({...input,...invalid}));assert.equal(backend.commands.length,0);assert.equal(backend.commits.length,0);
});
