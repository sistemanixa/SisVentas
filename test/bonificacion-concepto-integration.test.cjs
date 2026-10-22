'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs'),{createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
function readFixture(){
 const calls=[],c={window:null,fbDB:{},tienePermiso:()=>true,svCapturarContextoOperacion:()=>()=>c.valid,svPuedeLeerDominio:()=>true,valid:true,
 fbRef:(db,path)=>({path}),fbOrderByChild:field=>({orderByChild:field}),fbEqualTo:value=>({equalTo:value}),fbQuery:(ref,...constraints)=>({ref,constraints}),fbGet:async q=>{calls.push(q);return {val:()=>({bonus:{tipoPagable:'bonificacion',descripcion:'Bonificación · Ficticio',monto:25},salary:{tipoPagable:'sueldo',monto:500}})};}};
 c.window=c;load(c,['_cargarUsosConceptosBonificacion']);return {c,calls};
}
test('usos consultan sólo el tipo bonificación al pedirlos, sin descargar Gastos completo ni abrir listeners',async()=>{
 const {c,calls}=readFixture();assert.equal(calls.length,0);const result=await c._cargarUsosConceptosBonificacion();
 assert.equal(calls.length,1);assert.equal(calls[0].ref.path,'sisventas/gastos');assert.deepEqual(JSON.parse(JSON.stringify(calls[0].constraints)),[{orderByChild:'tipoPagable'},{equalTo:'bonificacion'}]);
 assert.equal(result.complete,true);assert.equal(result.items.length,1);assert.equal(result.items[0].fbKey,'bonus');assert.match(result.scope,/Haberes/);
});
test('lectura denegada o fallida no se presenta como cero usos',async()=>{
 for(const kind of ['permission','domain','session','transport']){
  const {c,calls}=readFixture();if(kind==='permission')c.tienePermiso=()=>false;if(kind==='domain')c.svPuedeLeerDominio=()=>false;if(kind==='session')c.valid=false;if(kind==='transport')c.fbGet=async()=>{throw Error('Falla ficticia');};
  await assert.rejects(()=>c._cargarUsosConceptosBonificacion());if(kind!=='transport')assert.equal(calls.length,0);
 }
});
test('respuesta de usos de una sesión anterior se descarta',async()=>{
 const {c}=readFixture();c.fbGet=async()=>{c.valid=false;return {val:()=>({secret:{tipoPagable:'bonificacion'}})};};await assert.rejects(()=>c._cargarUsosConceptosBonificacion(),/sesión cambió/);
});
test('usar un concepto prepara motivo e importe sugerido y deja empleado/mes explícitos del formulario existente',()=>{
 const nodes={'modal-bonificacion-empleado':{style:{display:'none'}},'bonificacion-motivo':{value:''},'bonificacion-monto':{value:0},'bonificacion-empleado':{value:''},'bonificacion-mes':{value:'2026-10'}};
 let options,opened=0;const c={window:null,document:{getElementById:id=>nodes[id]},tienePermiso:()=>true,notify:()=>assert.fail('No avisos esperados'),SVBonusConcepts:{open:input=>{options=input;}},_bonificacionEmpleadoContexto:null,
 abrirModalBonificacionEmpleado:()=>{opened++;nodes['modal-bonificacion-empleado'].style.display='flex';c._bonificacionEmpleadoContexto=()=>true;},_setMontoInput:(node,value)=>{node.value=value;}};
 c.window=c;load(c,['_cargarUsosConceptosBonificacion','abrirBonificacionesEmpleado']);c.abrirBonificacionesEmpleado();assert.equal(opened,0);assert.equal(typeof options.loadUsages,'function');
 options.onUse({id:'concept-demo',nombre:'Buen rendimiento ficticio',montoSugerido:75.25});assert.equal(opened,1);assert.equal(nodes['bonificacion-motivo'].value,'Buen rendimiento ficticio');assert.equal(nodes['bonificacion-monto'].value,75.25);assert.equal(nodes['bonificacion-empleado'].value,'');assert.equal(nodes['bonificacion-mes'].value,'2026-10');
 assert.equal(c._bonificacionEmpleadoConcepto.id,'concept-demo');
});
test('otorgar desde concepto conserva nombre original en CTA y Gasto sin modificar sueldo, pagos ni el catálogo',async()=>{
 const salary={monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500}}};
 const f=createBackend({haberes:{e:{mes:{total:500}}},gastos:{salary},ctaemp:{e:{salary}},config:{bonificaciones:{model:{nombre:'Original',montoSugerido:75.25}}}}),p=f.page(),before=copy(f.state.sisventas);
 const mov={tipo:'bonificacion',monto:75.25,fecha:'2026-10-22',periodoComputo:'2026-11',descripcion:'Bonificación · Original',bonificacionConceptoId:'model',bonificacionConceptoNombre:'Original',ts:123};
 await p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,mov,'concept_fixture');
 const expense=f.get('sisventas/gastos/gasto_bonificacion_e_concept_fixture'),movement=f.get('sisventas/ctaemp/e/bonificacion_e_concept_fixture');
 for(const record of [expense,movement]){assert.equal(record.bonificacionConceptoId,'model');assert.equal(record.bonificacionConceptoNombre,'Original');assert.equal(record.periodoComputo,'2026-11');assert.equal(record.monto,75.25);}
 for(const domain of ['haberes','config'])assert.deepEqual(f.state.sisventas[domain],before[domain]);assert.deepEqual(f.state.sisventas.gastos.salary,before.gastos.salary);assert.deepEqual(f.state.sisventas.ctaemp.e.salary,before.ctaemp.e.salary);assert.deepEqual(f.direct,[]);
 p.refresh();await p.context._registrarPagoGastoUnitario('gasto_bonificacion_e_concept_fixture',25,'Transferencia',null,null);
 for(const path of ['sisventas/gastos/gasto_bonificacion_e_concept_fixture','sisventas/ctaemp/e/bonificacion_e_concept_fixture']){const paid=f.get(path);assert.equal(paid.bonificacionConceptoId,'model');assert.equal(paid.bonificacionConceptoNombre,'Original');assert.equal(paid.periodoComputo,'2026-11');assert.equal(paid.montoPagado,25);}
 assert.deepEqual(f.state.sisventas.gastos.salary,before.gastos.salary);assert.deepEqual(f.state.sisventas.haberes,before.haberes);
 const saved=copy(f.state.sisventas),commits=f.commits.length;await assert.rejects(()=>p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,{...mov,bonificacionConceptoNombre:'Otro nombre'},'concept_fixture'),/datos distintos/);assert.equal(f.commits.length,commits);assert.deepEqual(f.state.sisventas,saved);
});
