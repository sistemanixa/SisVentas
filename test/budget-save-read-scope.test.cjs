'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBudgetSaveFixture,settle}=require('./helpers/budget-save-fixture.cjs');

test('guardar con colección completa conserva el registro confirmado y no relee el historial',async()=>{
 const f=await createBudgetSaveFixture(),before=f.clone(f.records.otro);
 await f.save();await settle();
 assert.equal(f.calls.reads.length,1);assert.equal(f.calls.prepare.length,1);assert.equal(f.calls.commits.length,1);
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
 assert.equal(f.renderedState(),'aprobado_int');assert.deepEqual(f.records.otro,before);
 assert.equal(f.calls.notices.some(n=>/Error/.test(n.message)),false);
});

test('la siguiente sincronización explícita incorpora los cambios de otro equipo sin perder el acuse propio',async()=>{
 const f=await createBudgetSaveFixture();await f.save();
 f.records.otro.observaciones='Cambio de otra sesión ficticia';
 await f.c.SVCommercialOwnership.refresh('presupuestos');
 assert.equal(f.calls.reads.length,2);
 assert.equal(f.list().find(r=>r.fbKey==='otro').observaciones,'Cambio de otra sesión ficticia');
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
 assert.equal(f.calls.reads[1].headers['If-None-Match'],undefined,'El siguiente refresco vuelve a validar la colección modificada');
});

test('un guardado mientras la carga inicial está incompleta termina cargando también los otros registros',async()=>{
 const f=await createBudgetSaveFixture(),api=f.c.SVCommercialOwnership;
 api.stop();f.mode('hold');
 api.onValue('presupuestos',snapshot=>{f.c.pptoData=Object.entries(snapshot.val()||{}).map(([fbKey,value])=>({...f.clone(value),fbKey}));f.c.renderPptoTabla();});
 await settle();assert.equal(api.cachedRecords('presupuestos'),null);assert.equal(f.pending.length,1);
 await f.save();assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
 f.mode('normal');f.pending[0].resolve();await settle();await settle();
 assert.equal(f.calls.reads.length,3,'Inicial previa, carga incompleta y continuación posterior al acuse');
 assert.equal(f.list().length,2);assert.equal(f.list().find(r=>r.fbKey==='otro').cliente,f.records.otro.cliente);
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
});

test('el acuse actualiza las vistas dependientes locales y no reconstruye un listado oculto',async()=>{
 const f=await createBudgetSaveFixture();let history=0,dirty=0,dashboard=0;
 f.c._chequearCambioHistCliente=()=>history++;f.c.marcarDashboardDatosSucios=()=>dirty++;f.c.solicitarRenderDashboard=()=>dashboard++;
 f.nodes['page-presupuesto']={classList:{contains:()=>true}};
 f.nodes['ppto-list-view'].style.display='none';f.nodes['ppto-detalle-view'].style.display='none';
 const initialRenders=f.calls.rendered.length;
 f.c._pptoDatosActualizados(true);
 assert.equal(f.calls.rendered.length,initialRenders);assert.equal(history,1);assert.equal(dirty,1);assert.equal(dashboard,1);
 f.nodes['ppto-list-view'].style.display='block';f.c._pptoDatosActualizados(true);
 assert.equal(f.calls.rendered.length,initialRenders+1);
});

test('una actualización de datos no abre el detalle de un módulo oculto ni pisa un formulario visible',async()=>{
 const f=await createBudgetSaveFixture();let detail=0;
 f.c.pptoActualId='budget-ficticio';f.c.verPpto=()=>detail++;
 f.nodes['page-presupuesto']={classList:{contains:()=>false}};f.nodes['ppto-detalle-view'].style.display='block';
 f.c._pptoDatosActualizados(true);assert.equal(detail,0);
 f.nodes['page-presupuesto'].classList.contains=()=>true;f.nodes['ppto-detalle-view'].style.display='none';
 f.nodes['ppto-form-view'].style.display='block';f.nodes['pp-descuento'].value='7.5';
 f.c._pptoDatosActualizados(true);assert.equal(detail,0);assert.equal(f.nodes['pp-descuento'].value,'7.5');
 f.nodes['ppto-detalle-view'].style.display='block';f.c._pptoDatosActualizados(true);assert.equal(detail,1);
});

test('una vista dependiente que falla después del acuse no convierte el guardado en un error',async()=>{
 const f=await createBudgetSaveFixture();
 f.c._chequearCambioHistCliente=()=>{throw new Error('Vista ficticia fuera de servicio');};
 await f.save();await settle();
 assert.equal(f.calls.commits.length,1);assert.equal(f.calls.complete,1);
 assert.equal(f.calls.notices.some(n=>/Error al guardar/.test(n.message)),false);
 assert.equal(f.list().find(r=>r.fbKey==='budget-ficticio').estado,'aprobado_int');
 assert.equal(f.c._pptoEditandoFbKey,null);assert.equal(f.c._pptoGuardadoEnCurso,false);
 assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,false);
});

for(const alta of [false,true])test('un render fallido tras '+(alta?'crear':'editar')+' informa el guardado confirmado y libera el botón',async()=>{
 const f=await createBudgetSaveFixture();
 if(alta){f.c._pptoEditandoFbKey=null;f.c._pptoEditandoId=null;f.c._pptoEditorBase=null;}
 f.c.renderPptoTabla=()=>{throw new Error('Render ficticio fallido');};
 await f.save();await settle();
 assert.equal(f.calls.complete,1);assert.equal(f.calls.notices.some(n=>/Error al guardar/.test(n.message)),false);
 assert.match(f.calls.notices.at(-1).message,/se guardó.*Actualizá la vista/);
 assert.equal(f.c._pptoEditandoFbKey,null);assert.equal(f.c._pptoGuardadoEnCurso,false);
 assert.equal(f.nodes['btn-guardar-principal-ppto'].disabled,false);
 assert.equal(f.calls.progressFinished,1);
 if(alta){assert.equal(Object.keys(f.records).filter(k=>k.startsWith('nuevo-')).length,1);}
 else{assert.equal(f.calls.commits.length,1);assert.equal(f.records['budget-ficticio'].estado,'aprobado_int');}
});
