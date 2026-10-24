'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const expense=()=>({monto:100,montoPagado:0,estado:'pendiente_pago',empleadoId:'e',empleadoFbKey:'e',legacyKey:'ctaemp/e/m',descripcion:'Gasto ficticio',fecha:'2026-10-01'});
const movement=()=>({tipo:'comision',monto:100,estado:'aprobado',gastoFbKey:'g',fecha:'2026-10-01'});

test('Un rechazo concurrente impide pagar desde una pantalla que conservaba el estado aprobado',async()=>{
 const f=createBackend({gastos:{g:expense()},ctaemp:{e:{m:movement()}}}),p=f.page(),other=f.page();p.refresh();
 let changed=false;
 f.setHook(async command=>{if(!changed&&command.kind==='atomic'){
  changed=true;await other.context.fbUpdate(other.context.fbRef(other.context.fbDB,'sisventas/gastos/g'),{estado:'rechazado'});
 }});
 await assert.rejects(p.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null),/estado|aprob|rechaz|disponible/i);
 assert.equal(f.get('sisventas/gastos/g').estado,'rechazado');assert.equal(f.get('sisventas/gastos/g').pagos,undefined);
 assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,undefined);
});

test('La edición de un pago heredado en array conserva la misma clave e historial en Gastos y cuenta',async()=>{
 const pagos=[{monto:30,fecha:'2026-10-01',medio:'Efectivo',ts:1},{monto:20,fecha:'2026-10-02',medio:'Transferencia',ts:2}];
 const f=createBackend({gastos:{g:{...expense(),montoPagado:50,pagos}},ctaemp:{e:{m:{...movement(),montoPagado:50,pagos:copy(pagos)}}}}),p=f.page();p.refresh();
 const g=p.context.gastosData[0],selected=p.context._gastoPagosArray(g)[0],token=p.context._pagoGastoToken(selected,0);
 await p.context._persistirAjustePagoGasto(g,selected,token,{monto:35},'edicion','Corrección ficticia');
 const actual=f.get('sisventas/gastos/g'),mov=f.get('sisventas/ctaemp/e/m');
 assert.equal(actual.montoPagado,55);assert.equal(mov.montoPagado,55);assert.deepEqual(actual.pagos,mov.pagos);
 assert.equal(p.context.totalPagadoGasto(actual),55);assert.equal(Object.values(actual.pagos).length,2);
});

test('La aprobación de una comisión no deja sólo Gastos aprobado cuando falla la cuenta vinculada',async()=>{
 const g={...expense(),tipoPagable:'comision',estado:'pendiente_aprobacion',requiereAprobacion:true},m={...movement(),estado:'pendiente_aprobacion'};
 const f=createBackend({gastos:{g},ctaemp:{e:{m}}}),p=f.page();p.refresh();
 p.load(['_buscarCtaempMovimientoPorLegacyKey','aprobarComisionDesdeGasto']);p.context.svConfirm=async()=>true;
 f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ctaemp/')))throw Object.assign(Error('Cuenta rechazada ficticia'),{statusCode:403});});
 await p.context.aprobarComisionDesdeGasto('g');
 for(let i=0;i<100&&!p.messages.length;i++)await new Promise(setImmediate);
 assert.deepEqual(f.get('sisventas/gastos/g'),g);assert.deepEqual(f.get('sisventas/ctaemp/e/m'),m);assert.equal(f.commits.length,0);
});

test('Todos los estados no pagables se revalidan al confirmar; no hay pago para una comisión sin aprobar',async()=>{
 for(const changes of [{estado:'pendiente_aprobacion'},{estado:'rechazado'},{estado:'anulado'},{tipoPagable:'comision',estado:'pendiente_pago'}]){
  const f=createBackend({gastos:{g:{...expense(),...changes}},ctaemp:{e:{m:movement()}}}),p=f.page();p.refresh();const before=copy(f.state.sisventas);
  await assert.rejects(p.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null),/estado|aprob/);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
 }
});

test('Aprobar solicitud y aprobar/rechazar comisión actualizan Gastos y cuenta en un único commit',async()=>{
 for(const action of ['aprobarGastoSolicitado','aprobarComisionDesdeGasto','rechazarComisionDesdeGasto']){
  const g={...expense(),tipoPagable:action==='aprobarGastoSolicitado'?'gasto_empresa':'comision',estado:'pendiente_aprobacion',requiereAprobacion:true,movimientoCtaKey:'m'},m={...movement(),estado:'pendiente_aprobacion'};
  const f=createBackend({gastos:{g},ctaemp:{e:{m}}}),p=f.page();p.refresh();p.load([action]);p.context.svConfirm=async()=>true;p.context.svPrompt=async()=> 'Motivo ficticio';
  await p.context[action]('g');assert.equal(f.commits.length,1);assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'atomic');
  const gasto=f.get('sisventas/gastos/g'),mov=f.get('sisventas/ctaemp/e/m');assert.equal(gasto.requiereAprobacion,false);assert.equal(mov.gastoFbKey,'g');assert.equal(gasto.estado,action==='rechazarComisionDesdeGasto'?'rechazado':action==='aprobarComisionDesdeGasto'?'pendiente_pago':'aprobado');
  assert.ok(!f.reads.some(([,path])=>path==='sisventas/gastos'));
 }
});

test('Rechazar comisión con un pago concurrente conserva el pago y la aprobación vigente',async()=>{
 const g={...expense(),tipoPagable:'comision',aprobadoPor:'Autorizado'},f=createBackend({gastos:{g},ctaemp:{e:{m:movement()}}}),p=f.page(),other=f.page();p.refresh();other.refresh();
 p.load(['rechazarComisionDesdeGasto']);p.context.svPrompt=async()=> 'Revisión ficticia';let paid=false;
 f.setHook(async c=>{if(!paid&&c.kind==='atomic'){paid=true;await other.context._registrarPagoGastoUnitario('g',40,'Transferencia',null,null);}});
 await p.context.rechazarComisionDesdeGasto('g');assert.equal(f.get('sisventas/gastos/g').montoPagado,40);assert.equal(f.get('sisventas/gastos/g').estado,'pagado_parcial');assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,40);assert.equal(f.commits.length,1);assert.match(p.messages.at(-1),/pagos/);
});

test('Preparar un gasto de adelanto o empresa existente no reemplaza pagos ni auditoría',async()=>{
 for(const tipo of ['adelanto','transporte']){
  const pagos={p:{fecha:'2026-10-01',monto:80,medio:'Transferencia'}},g={...expense(),legacyKey:'ctaemp/e/m',montoPagado:80,pagos,auditoria:{original:'Conservar'}},m={...movement(),tipo,gastoFbKey:'g',estado:'pagado',montoPagado:100,medioPago:'Efectivo',pagos:{distinto:{monto:100}}};
  const f=createBackend({gastos:{g},ctaemp:{e:{m}}}),p=f.page(),before=copy(g);
  await p.context[tipo==='adelanto'?'_crearGastoAdelantoDesdeMovimiento':'_crearGastoEmpresaDesdeMovimiento']('e','m',{...m,pagos:{viejo:{monto:1}}});
  assert.deepEqual(f.get('sisventas/gastos/g'),before);assert.equal(f.get('sisventas/ctaemp/e/m').gastoFbKey,'g');assert.ok(!f.reads.some(([,path])=>path==='sisventas/gastos'));
 }
});

test('Alta de movimiento entregado y gasto se confirman juntos, incluso si un destino es rechazado',async()=>{
 for(const reject of [false,true]){
  const f=createBackend(),p=f.page();p.load(['_guardarMovimientoEmpleado']);p.context.ctaEmpActual='e';p.context.cerrarModalMovEmp=()=>{};
  const mov={tipo:'adelanto',monto:100,montoPagado:100,estado:'pagado',fecha:'2026-10-20',medioPago:'Efectivo',pagos:{p:{monto:100,medio:'Efectivo',fecha:'2026-10-20'}},ts:1000};
  if(reject)f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/gastos/')))throw Object.assign(Error('Rechazo ficticio'),{statusCode:403});});
  if(reject){const before=copy(f.state.sisventas);await assert.rejects(p.context._guardarMovimientoEmpleado(mov));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);}
  else{await p.context._guardarMovimientoEmpleado(mov);assert.equal(f.commits.length,1);const guardado=Object.values(f.get('sisventas/ctaemp/e'))[0],g=f.get('sisventas/gastos/'+guardado.gastoFbKey);assert.equal(g.montoPagado,100);assert.deepEqual(guardado.pagos,g.pagos);}
 }
});

test('Entregar adelanto pendiente es una sola operación y dos usuarios no lo vuelven a entregar',async()=>{
 const m={tipo:'adelanto',estado:'pendiente',monto:100,fecha:'2026-10-01'},f=createBackend({ctaemp:{e:{m}}}),a=f.page(),b=f.page();
 for(const p of [a,b]){p.load(['confirmarAprobacionAdelanto']);p.node('adelanto-medio').value='Transferencia';p.node('adelanto-periodo-descuento').value='2026-11';p.context._adelantoAprobarCtx={empKey:'e',movKey:'m',mov:{...m,fbKey:'m'}};p.context.cerrarAprobacionAdelanto=()=>{};p.context.formatoMedioPago=x=>x;}
 await Promise.all([a.context.confirmarAprobacionAdelanto(),b.context.confirmarAprobacionAdelanto()]);
 assert.equal(f.commits.length,1);const mov=f.get('sisventas/ctaemp/e/m'),g=f.get('sisventas/gastos/'+mov.gastoFbKey);assert.equal(g.montoPagado,100);assert.deepEqual(g.pagos,mov.pagos);assert.equal(Object.keys(mov.pagos).length,1);assert.ok([a,b].some(p=>p.messages.some(m=>/cambió|entregado/.test(m))));
});
test('the generic account-to-expense entry keeps a new advance mirror typed and preserves its discount month and payments',async()=>{const mov={tipo:'adelanto',monto:81.23,montoPagado:81.23,estado:'pagado',fecha:'2026-10-20',fechaPago:'2026-10-20',periodoDescuento:'2026-12',medioPago:'Efectivo',pagos:{p:{monto:81.23,medio:'Efectivo',fecha:'2026-10-20'}}},f=createBackend({ctaemp:{e:{m:mov}}}),p=f.page(),before=copy(mov),key=await p.context._crearGastoEmpresaDesdeMovimiento('e','m',mov),g=f.get('sisventas/gastos/'+key);assert.equal(g.tipoPagable,'adelanto');assert.equal(g.periodoDescuento,'2026-12');assert.deepEqual(g.pagos,before.pagos);assert.equal(f.get('sisventas/ctaemp/e/m').periodoDescuento,'2026-12');assert.equal(f.commits.length,1);});
test('a concurrent change of a request discount month prevents delivery from an older approval form',async()=>{const mov={tipo:'adelanto',monto:81.23,estado:'pendiente',fecha:'2026-10-20',periodoDescuento:'2026-11'},f=createBackend({ctaemp:{e:{m:{...mov,periodoDescuento:'2026-12'}}}}),p=f.page();p.load(['confirmarAprobacionAdelanto']);p.node('adelanto-medio').value='Efectivo';p.node('adelanto-periodo-descuento').value='2026-11';p.context._adelantoAprobarCtx={empKey:'e',movKey:'m',mov};const before=copy(f.state.sisventas);await p.context.confirmarAprobacionAdelanto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.match(p.messages.join(' '),/mes de descuento.*cambió/);});

test('Incorporar comisión legacy conserva duplicados y base pagada sin inventar un pago anterior',async()=>{
 const m={tipo:'comision',monto:50,montoPagado:20,estado:'pagado_parcial',fecha:'2026-09-01',pct:5,gananciaBase:1000,descripcion:'Comisión anterior'},f=createBackend({ctaemp:{e:{m}}}),p=f.page();
 const key=await p.context._crearGastoComisionDesdeMovimiento('e','m',m),g=f.get('sisventas/gastos/'+key);assert.equal(g.montoPagado,20);assert.equal(g.saldoPagadoLegacy,20);assert.equal(g.pagos,undefined);assert.equal(f.commits.length,1);
 const before=copy(f.state.sisventas);await p.context._crearGastoComisionDesdeMovimiento('e','m',{...f.get('sisventas/ctaemp/e/m'),monto:999});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);
 assert.ok(f.reads.some(([,path])=>path==='sisventas/gastos'));
});

test('Aprobación de comisión legacy y movimiento empresa no deja etapas parciales',async()=>{
 for(const tipo of ['comision','transporte'])for(const reject of [false,true]){
  const m={tipo,monto:50,estado:'pendiente',fecha:'2026-10-01',descripcion:'Solicitud ficticia',pct:5,gananciaBase:1000},f=createBackend({ctaemp:{e:{m}}}),p=f.page(),before=copy(f.state.sisventas);
  p.load(['aprobarComision','aprobarMovEmp']);p.context.movsEmpData=[{...m,fbKey:'m'}];p.context.svConfirm=async()=>true;
  if(reject)f.setRejectPatch(()=>{throw Object.assign(Error('Rechazo ficticio'),{statusCode:403});});
  await p.context[tipo==='comision'?'aprobarComision':'aprobarMovEmp']('m','e');
  if(reject){assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);}
  else{assert.equal(f.commits.length,1);const mov=f.get('sisventas/ctaemp/e/m'),g=f.get('sisventas/gastos/'+mov.gastoFbKey);assert.equal(mov.estado,'aprobado');assert.equal(g.requiereAprobacion,false);assert.equal(g.monto,50);}
 }
});

test('La regla periódica no queda huérfana si falla el movimiento y se confirma en el mismo commit si funciona',async()=>{
 for(const reject of [true,false]){
  const f=createBackend(),p=f.page();p.load(['_guardarMovimientoEmpleado']);p.context.ctaEmpActual='e';p.context.cerrarModalMovEmp=()=>{};
  const regla={key:'regla_fixture',data:{tipo:'transporte',monto:50,dia:5,activo:true}},mov={tipo:'transporte',monto:50,estado:'aprobado',fecha:'2026-10-20'};
  if(reject)f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/gastos/')))throw Object.assign(Error('Rechazo ficticio'),{statusCode:403});});
  const before=copy(f.state.sisventas);
  if(reject){await assert.rejects(p.context._guardarMovimientoEmpleado(mov,'Ficticio',regla));assert.deepEqual(f.state.sisventas,before);}
  else{await p.context._guardarMovimientoEmpleado(mov,'Ficticio',regla);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/gastos_periodicos_emp/e/regla_fixture'),regla.data);assert.equal(Object.keys(f.get('sisventas/gastos')).length,1);}
 }
});

test('El gasto de destino ocupado sin pertenencia no se vincula ni reemplaza y se respeta una baja histórica',async()=>{
 const m={tipo:'comision',monto:50,estado:'aprobado',fecha:'2026-09-01',descripcion:'Comisión anterior'},f=createBackend({empleados:{e:{nombre:'Baja ficticia',activo:false}},ctaemp:{e:{m}},gastos:{gasto_comision_legacy_e_m:{monto:999,descripcion:'Ajeno',tipoPagable:'otro'}}}),p=f.page(),before=copy(f.state.sisventas);
 await assert.rejects(p.context._crearGastoComisionDesdeMovimiento('e','m',m),/ocupado/);assert.deepEqual(f.state.sisventas,before);
 delete f.state.sisventas.gastos.gasto_comision_legacy_e_m;
 const key=await p.context._crearGastoComisionDesdeMovimiento('e','m',m);assert.equal(f.get('sisventas/gastos/'+key).monto,50);assert.equal(f.get('sisventas/empleados/e').activo,false);
});

test('La entrega de adelanto falla cerrada sin adaptador seguro y no usa escrituras separadas',async()=>{
 const m={tipo:'adelanto',monto:50,estado:'pendiente'},f=createBackend({ctaemp:{e:{m}}}),p=f.page();p.load(['confirmarAprobacionAdelanto']);p.context._adelantoAprobarCtx={empKey:'e',movKey:'m',mov:m};p.node('adelanto-medio').value='Efectivo';p.node('adelanto-periodo-descuento').value='2026-11';p.context.SVLaborWrites=null;
 const before=copy(f.state.sisventas);await p.context.confirmarAprobacionAdelanto();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.deepEqual(f.direct,[]);assert.match(p.messages.at(-1),/guardado seguro/);
});

test('Incorporación explícita de comisión conserva centavos, porcentaje y base históricos sin recalcularlos',async()=>{
 const m={tipo:'comision',monto:123.45,montoPagado:43.21,estado:'pagado_parcial',fecha:'2025-01-01',pct:3.5,gananciaBase:3527.142857,descripcion:'Histórica ficticia'},f=createBackend({ctaemp:{e:{m}}}),p=f.page();
 const key=await p.context._crearGastoComisionDesdeMovimiento('e','m',m),g=f.get('sisventas/gastos/'+key);
 assert.equal(g.monto,123.45);assert.equal(g.montoPagado,43.21);assert.equal(g.saldoPagadoLegacy,43.21);assert.equal(g.pct,3.5);assert.equal(g.gananciaBase,3527.142857);assert.equal(g.pagos,undefined);assert.equal(f.get('sisventas/ctaemp/e/m').monto,123.45);
});
