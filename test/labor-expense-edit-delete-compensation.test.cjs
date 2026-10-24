'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const expense=()=>({fecha:'2026-10-20',tipo:'Variable',categoria:'Otro',descripcion:'Gasto ficticio',monto:100,montoPagado:20,estado:'pagado_parcial',medio:'Efectivo',proveedor:'',comprobante:'',vencimiento:'',empleadoId:'e',empleadoNombre:'Persona ficticia',pagos:{p1:{monto:20,medio:'Efectivo',ts:1}},nota:'Conservar'});
const movement=g=>({tipo:'gasto_empresa',descripcion:g.descripcion,monto:g.monto,montoPagado:g.montoPagado,estado:g.estado,gastoFbKey:'g',pagos:copy(g.pagos)});
const names=['rolActualNormalizado','esAdmin','_esGastoAdelanto','_gastoTieneHistoriaLiquidada','_gastoEstaRetirado','_movEmpPagosArray','_movEmpTotalPagado','_movEmpEstadoCalculado','_ctaEmpMontoAdelantoACompensar','_ctaEmpAdelantosPendientes','_eliminarBonificacionGastoVinculada','_eliminarAdelantoGastoVinculado','_gastoIdentidad','_crearGastoSinDuplicar','sincronizarMedioPagoCuentaEmpleado','_guardarEdicionGastoAdelanto','_gastoBaseEdicion','_gastoEmpleadosVinculados','_gastoMovimientosDesdeValores','_guardarGastoCompletoAtomico','_eliminarGastoAtomico','_aplicarAdelantosAlHaberAtomico','guardarGastoCompleto','eliminarRegistro','aplicarAdelantosAlHaberActual'];
function fixture(initial={}){
 const g=expense(),backend=createBackend({gastos:{g},ctaemp:{e:{m:movement(g)}},...initial}),page=backend.page(),c=page.context,tasks=[];
 for(const name of names){try{functionSource(name);load(c,[name]);}catch(error){if(!/^Falta función activa/.test(error.message))throw error;}}
 c.getMontoRaw=node=>Number(node.value)||0;c.puedeAdministrarGastos=()=>true;c.gastoActualFbKey='g';c.gastoFotoBase64=null;c._gastosAltasEnCurso=new Set();c.gastosData=Object.entries(backend.state.sisventas.gastos).map(([fbKey,value])=>({...copy(value),fbKey}));c._gastoFormVista={key:'g',valor:copy(backend.state.sisventas.gastos.g)};
 c.svConfirm=async()=>true;c.cerrarFormGasto=()=>{page.closed=true;};c.svCapturarContextoOperacion=()=>{const uid=c.currentUserUid;return ()=>c.currentUserUid===uid;};
 for(const name of ['fbUpdate','fbRemove','fbSet']){const original=c[name];c[name]=(...args)=>{const promise=original(...args);tasks.push(promise);return promise;};}
 const fields={fecha:g.fecha,vencimiento:g.vencimiento,tipo:g.tipo,categoria:g.categoria,descripcion:g.descripcion,monto:g.monto,'monto-pagado':g.montoPagado,medio:g.medio,proveedor:g.proveedor,comprobante:g.comprobante,'tecnico-id':'e'};
 for(const [id,value]of Object.entries(fields))page.node('g-'+id).value=value;page.node('g-pagado-tecnico').checked=true;
 return {...backend,page,c,async settle(task){await task;await Promise.allSettled(tasks);await new Promise(setImmediate);await Promise.allSettled(tasks);}};
}
test('editing a stale form cannot remove a payment added while the form was open',async()=>{
 const f=fixture();apply(f.state,{'sisventas/gastos/g/pagos/p2':{monto:20,ts:2},'sisventas/gastos/g/montoPagado':40});const before=copy(f.state.sisventas);
 await f.settle(f.c.guardarGastoCompleto());assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/cambi|actualiz/i);
});
test('editing description, medium and attachment commits current payments and linked account together',async()=>{
 const f=fixture();apply(f.state,{'sisventas/gastos/g/modificadoTs':99});f.page.node('g-descripcion').value='Descripción nueva';f.page.node('g-medio').value='Transferencia';f.c.gastoFotoBase64='data:image/png;base64,QQ==';
 await f.settle(f.c.guardarGastoCompleto());assert.equal(f.get('sisventas/gastos/g/descripcion'),'Descripción nueva');assert.equal(f.get('sisventas/gastos/g/pagos/p1/ts'),1);assert.equal(f.get('sisventas/gastos/g/montoPagado'),20);assert.equal(f.get('sisventas/gastos/g/modificadoTs'),99);assert.equal(f.get('sisventas/ctaemp/e/m/pagos/p1/medio'),'Transferencia');assert.equal(f.get('sisventas/gastos_adjuntos/g/fotoBase64'),f.c.gastoFotoBase64);assert.equal(f.commits.length,1);
});
test('the paid amount cannot be changed through the expense form instead of payment history',async()=>{
 const f=fixture();f.page.node('g-monto-pagado').value=40;await f.settle(f.c.guardarGastoCompleto());assert.equal(f.get('sisventas/gastos/g/montoPagado'),20);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/Historial de pagos/);
});
test('a payment that arrives during delete confirmation prevents deletion',async()=>{
 const g=expense();g.montoPagado=0;g.pagos={};g.estado='pendiente';const f=fixture({gastos:{g},ctaemp:{e:{}}});let confirm;
 f.c.svConfirm=()=>new Promise(resolve=>{confirm=resolve;});const task=f.c.eliminarRegistro('gastos','g');apply(f.state,{'sisventas/gastos/g/pagos/late':{monto:20},'sisventas/gastos/g/montoPagado':20});confirm(true);await f.settle(task);assert.equal(f.get('sisventas/gastos/g/pagos/late/monto'),20);assert.equal(f.commits.length,0);
});
test('an admin retires a bonus with a paid linked movement without deleting that movement or its payments',async()=>{
 const g={...expense(),montoPagado:0,pagos:{},estado:'pendiente',tipoPagable:'bonificacion',movimientoCtaKey:'m'},f=fixture({gastos:{g},ctaemp:{e:{m:{...movement(g),montoPagado:20,pagos:{paid:{monto:20}}}}}});
 const account=copy(f.get('sisventas/ctaemp'));await f.settle(f.c.eliminarRegistro('gastos','g'));const saved=f.get('sisventas/gastos/g');assert.equal(saved.bajaAdministrativa.uid,'u');delete saved.bajaAdministrativa;assert.deepEqual(saved,g);assert.deepEqual(f.get('sisventas/ctaemp'),account);assert.equal(f.commits.length,1);
});
test('an unpaid bonus and its linked movement are deleted in one atomic commit',async()=>{
 const g={...expense(),montoPagado:0,pagos:{},estado:'pendiente',tipoPagable:'bonificacion',movimientoCtaKey:'m'},f=fixture({gastos:{g},ctaemp:{e:{m:movement(g)}}});
 await f.settle(f.c.eliminarRegistro('gastos','g'));assert.equal(f.get('sisventas/gastos/g'),null);assert.equal(f.get('sisventas/ctaemp/e/m'),null);assert.equal(f.commits.length,1);
});
function compensation(){
 const salary={tipo:'sueldo',monto:100,sueldoBruto:100,sueldoBase:100,estado:'aprobado',mes:'2026-10',gastoFbKey:'salary',ts:2},advance={tipo:'adelanto',monto:30,montoPagado:30,estado:'pagado',fecha:'2026-09-01',pagos:{p:{monto:30}},gastoFbKey:'advance'};
 const f=fixture({gastos:{salary:{monto:100,estado:'pendiente_pago'},advance:{monto:30,montoPagado:30,pagos:{p:{monto:30}},tipoPagable:'adelanto'}},ctaemp:{e:{salary,advance}},haberes:{e:{'2026_10':{sueldoBruto:100,total:100,gastoFbKey:'salary'}}}});
 f.c.ctaEmpActual='e';f.c.movsEmpData=[{...copy(salary),fbKey:'salary'},{...copy(advance),fbKey:'advance'}];f.c._ctaEmpPeriodoMes=()=> '2026-10';f.c._ctaEmpEsSueldoMovimiento=m=>m.tipo==='sueldo';f.c._movEmpEnPeriodo=()=>true;f.c._ctaEmpMovVisibleParaRol=()=>true;f.c._ctaEmpMovHastaPeriodo=()=>true;return f;
}
test('advance compensation rejects a salary payment that arrived after the account view',async()=>{
 const f=compensation();apply(f.state,{'sisventas/gastos/salary/pagos/late':{monto:10},'sisventas/gastos/salary/montoPagado':10});const before=copy(f.state.sisventas);
 await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});
test('advance compensation cannot spend an advance already used by another salary',async()=>{
 const f=compensation();apply(f.state,{'sisventas/ctaemp/e/advance/montoCompensado':20,'sisventas/ctaemp/e/advance/compensaciones/2026_09':20});const before=copy(f.state.sisventas);
 await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});
test('valid compensation updates salary, expense, monthly record and advances once, then rejects stale replay',async()=>{
 const f=compensation();await f.c.aplicarAdelantosAlHaberActual();assert.equal(f.get('sisventas/ctaemp/e/salary/monto'),70);assert.equal(f.get('sisventas/ctaemp/e/advance/montoCompensado'),30);assert.equal(f.get('sisventas/gastos/salary/monto'),70);assert.equal(f.get('sisventas/haberes/e/2026_10/total'),70);assert.equal(f.commits.length,1);
 const after=copy(f.state.sisventas);await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,after);assert.equal(f.commits.length,1);
});
test('changing the discount month after the account view cannot spend an advance through stale compensation',async()=>{const f=compensation();apply(f.state,{'sisventas/ctaemp/e/advance/periodoDescuento':'2026-11'});const before=copy(f.state.sisventas);await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/cambi|actualiz/i);});
function newForm(f){f.c.gastoActualFbKey=null;f.c._gastoFormVista={key:'',valor:null};}
test('new paid expense, attachment and deterministic employee movement share one commit and a repeated click cannot duplicate',async()=>{
 const f=fixture({gastos:{},ctaemp:{e:{}}});newForm(f);f.c.gastoFotoBase64='data:image/png;base64,QQ==';
 const result=await f.c.guardarGastoCompleto();assert.ok(result?.key);const g=f.get('sisventas/gastos/'+result.key),mov=f.get('sisventas/ctaemp/e/gasto_empresa_'+result.key);
 assert.equal(g.montoPagado,20);assert.equal(Object.values(g.pagos)[0].monto,20);assert.equal(mov.gastoFbKey,result.key);assert.deepEqual(mov.pagos,g.pagos);assert.equal(f.get('sisventas/gastos_adjuntos/'+result.key+'/fotoBase64'),f.c.gastoFotoBase64);assert.equal(f.commits.length,1);
 const saved=copy(f.state.sisventas);await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,saved);assert.equal(f.commits.length,1);assert.match(f.page.messages.join(' '),/Ya existe/);
});
test('a new expense still detects a historical random key with the same original identity',async()=>{
 const f=fixture({gastos:{legacy_random:expense()},ctaemp:{e:{}}});newForm(f);await f.c.guardarGastoCompleto();assert.equal(f.commits.length,0);assert.equal(Object.keys(f.state.sisventas.gastos).length,1);assert.match(f.page.messages.join(' '),/Ya existe/);
});
test('a deterministic movement already owned by another entry is not overwritten by the new expense',async()=>{
 const f=fixture({gastos:{},ctaemp:{e:{}}});newForm(f);const key='gasto_'+require('node:crypto').createHash('sha256').update(f.c._gastoIdentidad(expense())).digest('hex'),movPath='sisventas/ctaemp/e/gasto_empresa_'+key;
 apply(f.state,{[movPath]:{monto:777,nota:'Conservar destino ocupado'}});const before=copy(f.state.sisventas);await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});
test('rejection of the new expense commit cannot leave its attachment or employee credit behind',async()=>{
 const f=fixture({gastos:{},ctaemp:{e:{}}});newForm(f);f.c.gastoFotoBase64='data:image/png;base64,QQ==';const before=copy(f.state.sisventas);f.setRejectPatch(()=>{throw Object.assign(Error('Synthetic rejection'),{statusCode:503});});
 await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.equal(f.page.closed,undefined);assert.match(f.page.messages.join(' '),/Synthetic rejection/);
});
test('a payment arriving after atomic reads causes CAS rejection and is not overwritten by a retry',async()=>{
 const f=fixture();let changed=false;f.setHook(()=>{if(!changed){changed=true;apply(f.state,{'sisventas/gastos/g/pagos/concurrent':{monto:20},'sisventas/gastos/g/montoPagado':40});}});
 await f.c.guardarGastoCompleto();assert.equal(f.get('sisventas/gastos/g/pagos/concurrent/monto'),20);assert.equal(f.get('sisventas/gastos/g/montoPagado'),40);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/cambi|actualiz/i);
});
test('logout and another login during delete confirmation do not delete with the later session',async()=>{
 const g={...expense(),montoPagado:0,pagos:{},estado:'pendiente'},f=fixture({gastos:{g},ctaemp:{e:{}}});let confirm;f.c.svConfirm=()=>new Promise(resolve=>{confirm=resolve;});const task=f.c.eliminarRegistro('gastos','g');
 f.c.currentUserUid='another';f.c.fbAuth.currentUser={uid:'another'};confirm(true);await task;assert.ok(f.get('sisventas/gastos/g'));assert.equal(f.commands.length,0);
});
test('deleting an unpaid advance keeps its previous expense and movement in the same atomic audit',async()=>{
 const g={...expense(),tipoPagable:'adelanto',montoPagado:0,pagos:{},estado:'pendiente',legacyKey:'ctaemp/e/m'},mov={...movement(g),tipo:'adelanto',estado:'pendiente'},f=fixture({gastos:{g},ctaemp:{e:{m:mov}}});
 await f.c.eliminarRegistro('gastos','g');assert.equal(f.get('sisventas/gastos/g'),null);assert.equal(f.get('sisventas/ctaemp/e/m'),null);const audit=Object.values(f.get('sisventas/auditoria_pagos'))[0];assert.equal(audit.accion,'eliminar_adelanto_vinculado');assert.equal(audit.gastoAnterior.monto,100);assert.equal(audit.movimientosAnteriores[0].mov.monto,100);assert.equal(f.commits.length,1);
});
test('compensation never replaces an occupied historical advance expense',async()=>{
 const f=compensation(),legacy={tipo:'adelanto',monto:30,estado:'aprobado',fecha:'2026-09-01'};apply(f.state,{'sisventas/ctaemp/e/advance':legacy,'sisventas/gastos/adelanto_e_advance':{monto:999,montoPagado:999,nota:'Histórico existente'}});f.c.movsEmpData[1]={...legacy,fbKey:'advance'};const before=copy(f.state.sisventas);
 await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/histórico|revisión/);
});
test('changing the expense amount below its existing payments is rejected without changing payment history',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);f.page.node('g-monto').value=10;await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.match(f.page.messages.join(' '),/menor.*pagado|Historial/i);
});
test('a description edit remains possible for an unchanged historical amount already exceeded by payments',async()=>{
 const g={...expense(),montoPagado:120,pagos:{p1:{monto:120,medio:'Efectivo'}}},f=fixture({gastos:{g},ctaemp:{e:{m:movement(g)}}});f.page.node('g-monto-pagado').value=120;f.page.node('g-descripcion').value='Nota histórica corregida';
 await f.c.guardarGastoCompleto();assert.equal(f.get('sisventas/gastos/g/descripcion'),'Nota histórica corregida');assert.equal(f.get('sisventas/gastos/g/monto'),100);assert.equal(f.get('sisventas/gastos/g/pagos/p1/monto'),120);assert.equal(f.commits.length,1);
});
test('reassigning an expense moves its linked account record and preserved payments with a before-after audit',async()=>{
 const f=fixture();apply(f.state,{'sisventas/empleados/other':{activo:true,nombre:'Otra persona'},'sisventas/ctaemp/other':{}});f.c.empData.other={fbKey:'other',nombre:'Otra persona'};f.page.node('g-tecnico-id').value='other';
 await f.c.guardarGastoCompleto();assert.equal(f.get('sisventas/ctaemp/e/m'),null);assert.equal(f.get('sisventas/ctaemp/other/m/pagos/p1/monto'),20);assert.equal(f.get('sisventas/gastos/g/empleadoId'),'other');assert.equal(f.get('sisventas/gastos/g/empleadoFbKey'),'other');assert.equal(f.get('sisventas/gastos/g/legacyKey'),'ctaemp/other/m');const audit=Object.values(f.get('sisventas/auditoria_pagos'))[0];assert.equal(audit.anterior.empleadoId,'e');assert.equal(audit.posterior.empleadoId,'other');assert.equal(audit.movimientosAnteriores[0].ruta,'sisventas/ctaemp/e/m');assert.equal(audit.movimientosPosteriores[0].ruta,'sisventas/ctaemp/other/m');assert.equal(f.commits.length,1);
});
test('reassignment cannot overwrite an occupied account destination or leave an unlinked expense behind',async()=>{
 const f=fixture();apply(f.state,{'sisventas/empleados/other':{activo:true,nombre:'Otra persona'},'sisventas/ctaemp/other/m':{monto:999,nota:'Destino existente'}});f.c.empData.other={fbKey:'other',nombre:'Otra persona'};f.page.node('g-tecnico-id').value='other';const before=copy(f.state.sisventas);
 await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);f.page.node('g-pagado-tecnico').checked=false;await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});
test('a medium correction records old and new payment media in the same commit as expense and account',async()=>{
 const f=fixture();f.page.node('g-medio').value='Transferencia';await f.c.guardarGastoCompleto();const audit=Object.values(f.get('sisventas/auditoria_pagos'))[0];assert.equal(audit.anterior.medio,'Efectivo');assert.equal(audit.posterior.medio,'Transferencia');assert.equal(audit.anterior.pagosMedios.p1,'Efectivo');assert.equal(audit.posterior.pagosMedios.p1,'Transferencia');assert.equal(audit.movimientosAnteriores[0].pagosMedios.p1,'Efectivo');assert.equal(audit.movimientosPosteriores[0].pagosMedios.p1,'Transferencia');assert.equal(f.commits.length,1);
});
test('a description-only edit does not silently rewrite historic account or payment media',async()=>{
 const f=fixture();apply(f.state,{'sisventas/ctaemp/e/m/medioPago':'Medio histórico','sisventas/ctaemp/e/m/pagos/p1/medio':'Tarjeta anterior'});f.page.node('g-descripcion').value='Descripción corregida';await f.c.guardarGastoCompleto();assert.equal(f.get('sisventas/ctaemp/e/m/medioPago'),'Medio histórico');assert.equal(f.get('sisventas/ctaemp/e/m/pagos/p1/medio'),'Tarjeta anterior');assert.equal(f.get('sisventas/auditoria_pagos'),null);assert.equal(f.commits.length,1);
});
test('a new session during expense hashing cannot start the previous form operation under the later login',async()=>{
 const f=fixture({gastos:{},ctaemp:{e:{}}});newForm(f);const subtle=f.c.crypto.subtle;f.c.crypto.subtle={async digest(...args){f.c.currentUserUid='another';f.c.fbAuth.currentUser={uid:'another'};return subtle.digest(...args);}};
 await f.c.guardarGastoCompleto();assert.equal(f.commits.length,0);assert.equal(f.commands.length,0);assert.deepEqual(f.state.sisventas.gastos,{});
});
test('an admin retires a historical paid expense while preserving its undetailed original paid marker',async()=>{
 const g={...expense(),estado:'Pagado',montoPagado:0,pagos:{}},f=fixture({gastos:{g},ctaemp:{e:{}}});await f.c.eliminarRegistro('gastos','g');const saved=f.get('sisventas/gastos/g');assert.equal(saved.bajaAdministrativa.uid,'u');delete saved.bajaAdministrativa;assert.deepEqual(saved,g);assert.equal(f.commits.length,1);
});
test('an admin retires a bonus whose account only has a historical paid marker without clearing that account',async()=>{
 const g={...expense(),tipoPagable:'bonificacion',movimientoCtaKey:'m',estado:'pendiente',montoPagado:0,pagos:{}},f=fixture({gastos:{g},ctaemp:{e:{m:{...movement(g),estado:'pagado'}}}}),account=copy(f.get('sisventas/ctaemp'));await f.c.eliminarRegistro('gastos','g');const saved=f.get('sisventas/gastos/g');assert.equal(saved.bajaAdministrativa.uid,'u');delete saved.bajaAdministrativa;assert.deepEqual(saved,g);assert.deepEqual(f.get('sisventas/ctaemp'),account);assert.equal(f.commits.length,1);
});
test('a historical salary marked paid without detailed payments cannot be recalculated by compensation',async()=>{
 const f=compensation();apply(f.state,{'sisventas/ctaemp/e/salary/estado':'pagado'});f.c.movsEmpData[0].estado='pagado';const before=copy(f.state.sisventas);await f.c.aplicarAdelantosAlHaberActual();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});
test('a historical paid marker is preserved on description edits and cannot be silently reinterpreted by changing amount',async()=>{
 const g={...expense(),estado:'Pagado',montoPagado:0,pagos:{}},f=fixture({gastos:{g},ctaemp:{e:{}}});f.page.node('g-monto-pagado').value=0;f.page.node('g-descripcion').value='Nota histórica';await f.c.guardarGastoCompleto();assert.equal(f.get('sisventas/gastos/g/estado'),'Pagado');assert.equal(f.get('sisventas/gastos/g/monto'),100);assert.deepEqual(f.get('sisventas/gastos/g/pagos'),{});
 f.c._gastoFormVista={key:'g',valor:copy(f.get('sisventas/gastos/g'))};f.page.node('g-monto').value=150;const before=copy(f.state.sisventas);await f.c.guardarGastoCompleto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);assert.match(f.page.messages.join(' '),/Historial de pagos/);
});
test('detailed cancelled payments with zero balance are not confused with an undetailed historical paid marker',async()=>{
 const g={...expense(),estado:'pagado',montoPagado:0,pagos:{void:{monto:100,anulado:true}},tipoPagable:'bonificacion',movimientoCtaKey:'m'},f=fixture({gastos:{g},ctaemp:{e:{m:{...movement(g),estado:'pagado'}}}});
 await f.c.eliminarRegistro('gastos','g');assert.equal(f.get('sisventas/gastos/g'),null);assert.equal(f.get('sisventas/ctaemp/e/m'),null);assert.equal(f.commits.length,1);
});
