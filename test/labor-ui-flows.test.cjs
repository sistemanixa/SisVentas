'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
const expense=()=>({monto:100,montoPagado:0,estado:'pendiente_pago',empleadoId:'e',empleadoFbKey:'e',legacyKey:'ctaemp/e/m',descripcion:'Gasto ficticio',fecha:'2026-10-01'});
const movement=()=>({tipo:'sueldo',monto:100,estado:'aprobado',gastoFbKey:'g',fecha:'2026-10-01'});
function payment(){const backend=createBackend({gastos:{g:expense()},ctaemp:{e:{m:movement()}}}),page=backend.page();page.refresh();return {...backend,...page};}
const commission=()=>({tipo:'comision',monto:50,pct:5,pctOriginal:5,gananciaBase:1000,fecha:'2026-10-20',ventaId:'V-FICTICIA',ventaFbKey:'v',descripcion:'Comisión ficticia',ts:1000});
function installSacSources(backend,page,ids=['e']){
 const fs=require('node:fs'),vm=require('node:vm');
 page.load(['_mesesDelSemestre','_mesesTrabajadosEnSemestre','_calcularFilasAguinaldo']);
 vm.runInContext(fs.readFileSync('js/core/payroll-source-snapshot.js','utf8'),page.context);
 vm.runInContext(fs.readFileSync('js/modules/payroll.js','utf8'),page.context);
 page.context.SVPayrollSemester={
  captureConfirmation:()=>({employees:ids.map(id=>({...backend.get('sisventas/empleados/'+id),fbKey:id})),
   haberes:backend.get('sisventas/haberes'),period:{year:2026,half:2},maximum:''}),
  assertConfirmation(){},saving(){},confirmed:()=>true,close(){}
 };
}

test('Pago parcial y total recorren aplicación activa, adaptador, gateway y guard sin escrituras SDK',async()=>{
 const f=payment(),sentinel=copy(f.state.sisventas.sentinel);
 await f.context._registrarPagoGastoUnitario('g',40,'Transferencia',null,null);
 assert.equal(f.get('sisventas/gastos/g').montoPagado,40);assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,40);
 await f.context._registrarPagoGastoUnitario('g',60,'Efectivo',null,null);
 const g=f.get('sisventas/gastos/g'),m=f.get('sisventas/ctaemp/e/m');
 assert.equal(g.montoPagado,100);assert.equal(g.estado,'pagado');assert.equal(g.reembolsado,true);assert.equal(m.estado,'pagado');assert.deepEqual(g.pagos,m.pagos);
 assert.equal(Object.values(g.pagos).reduce((sum,p)=>sum+p.monto,0),100);assert.equal(Object.keys(g.pagos).length,2);assert.deepEqual(f.state.sisventas.sentinel,sentinel);assert.deepEqual(f.direct,[]);assert.equal(f.holds,0);
});

test('Pagos simultáneos resuelven CAS con el importe vigente sin exceder el saldo ni perder historial',async()=>{
 const f=payment(),other=f.page();other.refresh();
 await Promise.all([f.context._registrarPagoGastoUnitario('g',40,'Transferencia',null,null),other.context._registrarPagoGastoUnitario('g',60,'Efectivo',null,null)]);
 const g=f.get('sisventas/gastos/g'),m=f.get('sisventas/ctaemp/e/m');assert.equal(g.montoPagado,100);assert.equal(m.montoPagado,100);assert.equal(Object.keys(g.pagos).length,2);assert.deepEqual(g.pagos,m.pagos);assert.deepEqual(f.direct,[]);
});

test('El fallo de CTA o adjunto no puede confirmar el pago en Gastos por separado',async()=>{
 const f=payment(),before=copy(f.state.sisventas);
 f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/ctaemp/')))throw Object.assign(Error('Rechazo ficticio de CTA'),{statusCode:403});});
 await assert.rejects(f.context._registrarPagoGastoUnitario('g',40,'Transferencia',{nombre:'Ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,UEZERklDVElDSU8='},null));
 assert.deepEqual(f.state.sisventas,before,'Gasto, cuenta y adjunto deben conservarse juntos si el commit falla');
});

test('Una comisión manual nueva queda pendiente y su repetición no duplica ni recalcula',async()=>{
 const f=createBackend(),p=f.page(),emp=p.context.empData.e;
 await p.context._generarComisionVentaAtomica(emp,commission());
 const before=copy(f.state.sisventas),key='gasto_comision_v_e',mov='comision_v_e';
 assert.equal(f.get('sisventas/gastos/'+key).monto,50);assert.equal(f.get('sisventas/gastos/'+key).estado,'pendiente_aprobacion');assert.equal(f.get('sisventas/ctaemp/e/'+mov).gastoFbKey,key);assert.equal(f.get('sisventas/ventas/v').comisionesGeneradas,true);
 await assert.rejects(p.context._generarComisionVentaAtomica(emp,{...commission(),monto:75}));assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.direct,[]);
});

test('Faltar el control de generación no permite reemplazar una comisión de destino ya pagada',async()=>{
 const old={...commission(),montoPagado:50,estado:'pagado',aprobadoPor:'Autor anterior',pagos:{p:{monto:50,fecha:'2026-10-01'}}};
 const f=createBackend({gastos:{gasto_comision_v_e:{...old,legacyKey:'ctaemp/e/comision_v_e'}},ctaemp:{e:{comision_v_e:{...old,gastoFbKey:'gasto_comision_v_e'}}}}),p=f.page(),before=copy(f.state.sisventas);
 await assert.rejects(p.context._generarComisionVentaAtomica(p.context.empData.e,commission()));
 assert.deepEqual(f.state.sisventas,before,'Ningún control ausente autoriza a recalcular o borrar pagos existentes');
});

test('Gasto, cuenta, adjunto y lote se confirman juntos con el importe de cada aplicación',async()=>{
 const f=createBackend({gastos:{g:expense(),h:{...expense(),monto:80,legacyKey:'ctaemp/e/n'}},ctaemp:{e:{m:movement(),n:{...movement(),monto:80,gastoFbKey:'h'},ajeno:{monto:999,nota:'Conservar'}}}}),p=f.page();p.refresh();
 const doc={nombre:'Prueba.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,UEZERklDVElDSU8='};
 await p.context._registrarPagosGastosAtomico([{fbKey:'g',monto:100},{fbKey:'h',monto:20}],'Transferencia',doc,'lote_fixture');
 assert.equal(f.commits.length,1);assert.equal(f.commands[0].kind,'atomic');
 const lote=f.get('sisventas/pagos_realizados/lote_fixture');assert.equal(lote.monto,120);assert.deepEqual(lote.gastos.map(g=>g.saldoPagado),[100,20]);
 for(const key of ['g','h']){const g=f.get('sisventas/gastos/'+key),payKey=Object.keys(g.pagos)[0];assert.equal(g.pagos[payKey].lotePagoKey,'lote_fixture');assert.equal(f.get('sisventas/gastos_adjuntos/'+key+'/pagos/'+payKey+'/comprobanteData'),doc.data);}
 assert.equal(f.get('sisventas/ctaemp/e/n').montoPagado,20);assert.deepEqual(f.get('sisventas/ctaemp/e/ajeno'),{monto:999,nota:'Conservar'});
 assert.ok(!f.reads.some(([,path])=>['sisventas','sisventas/gastos','sisventas/ctaemp'].includes(path)));
});

test('Un lote con un saldo cambiado no registra los otros gastos ni comprobantes',async()=>{
 const f=createBackend({gastos:{g:expense(),h:{...expense(),monto:10,legacyKey:'ctaemp/e/n'}},ctaemp:{e:{m:movement(),n:{...movement(),monto:10,gastoFbKey:'h'}}}}),p=f.page();p.refresh();const before=copy(f.state.sisventas);
 await assert.rejects(p.context._registrarPagosGastosAtomico([{fbKey:'g',monto:40},{fbKey:'h',monto:20}],'Transferencia',null,'lote_fixture'));
 assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);
});

test('El hash de la cuenta detecta una vinculación agregada después de leer y la incluye al reintentar',async()=>{
 const f=payment(),other=f.page();let inserted=false;
 f.setHook(async command=>{if(!inserted&&command.kind==='atomic'){inserted=true;await other.context.fbSet(other.context.fbRef(other.context.fbDB,'sisventas/ctaemp/e/nuevo'),{...movement(),tipo:'reembolso'});}});
 await f.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null);
 assert.equal(f.get('sisventas/ctaemp/e/nuevo').montoPagado,40);assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,40);assert.equal(f.commands.filter(c=>c.kind==='atomic').length,2);
 const payments=Object.keys(f.get('sisventas/gastos/g').pagos),attempts=f.commands.filter(c=>c.kind==='atomic');assert.equal(payments.length,1);assert.equal(Object.keys(attempts[0].value['sisventas/gastos/g'].pagos)[0],Object.keys(attempts[1].value['sisventas/gastos/g'].pagos)[0]);
});

test('Historia de pagos en arrays conserva importes activos y anulados al agregar un pago',async()=>{
 const pagos=[{monto:30,fecha:'2026-10-01'},{monto:40,anulado:true,fecha:'2026-10-02'}],g={...expense(),montoPagado:30,pagos},m={...movement(),montoPagado:30,pagos};
 const f=createBackend({gastos:{g},ctaemp:{e:{m}}}),p=f.page();p.refresh();
 await p.context._registrarPagoGastoUnitario('g',70,'Efectivo',null,null);
 const result=f.get('sisventas/gastos/g'),mov=f.get('sisventas/ctaemp/e/m');assert.equal(result.montoPagado,100);assert.equal(Object.keys(result.pagos).length,3);assert.deepEqual(result.pagos.legacy_1,pagos[1]);assert.deepEqual(result.pagos,mov.pagos);
});

test('Permiso UI o revocación del servidor impiden confirmar pagos sin fallback',async()=>{
 const f=payment();f.load(['puedeAdministrarGastos','restoGasto','_pagoGastoBotonGuardar','confirmarPagoGasto']);
 f.context.tienePermiso=()=>false;f.context.confirmarPagoGasto();assert.match(f.messages.at(-1),/Solo administración/);assert.equal(f.commands.length,0);
 f.setHook(()=>{f.state.sv_chat_roles.u.activo=false;});const before=copy(f.state.sisventas);
 await assert.rejects(f.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null),{statusCode:403});assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.deepEqual(f.direct,[]);
});

test('Replay del mismo envelope confirmado recupera recibo sin otro pago ni otra escritura',async()=>{
 const f=payment();await f.context._registrarPagoGastoUnitario('g',40,'Transferencia',null,null);
 const command=copy(f.commands[0]),before=copy(f.state.sisventas),commits=f.commits.length,actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});
 assert.equal((await f.gateway.write(actor,command)).committed,true);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,commits);assert.equal(Object.keys(f.get('sisventas/gastos/g').pagos).length,1);
});

test('Comisión manual rechaza base o tope cambiados y no deja reserva intermedia',async()=>{
 for(const initial of [{config:{maxComisionPct:4}},{ventas:{v:{id:'V-FICTICIA',comisionHabilitada:true,subtotal:2000,costoTotal:1500}}}]){
  const f=createBackend(initial),p=f.page(),before=copy(f.state.sisventas);
  await assert.rejects(p.context._generarComisionVentaAtomica(p.context.empData.e,commission()));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);
 }
});

test('Rechazo del PATCH de comisión no deja control, gasto, movimiento ni marca de venta',async()=>{
 const f=createBackend(),p=f.page(),before=copy(f.state.sisventas);f.setRejectPatch(()=>{throw Object.assign(Error('Fallo ficticio de validación'),{statusCode:403});});
 await assert.rejects(p.context._generarComisionVentaAtomica(p.context.empData.e,commission()));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);
});

test('El formulario manual real confirma una sola operación y respeta su permiso',async()=>{
 const f=createBackend(),p=f.page();p.refresh();p.load(['_comisionManualResolverVenta','_comisionManualEmpleadoSeleccionado','_ventaTieneComisionGenerada','cerrarModalComisionVenta','guardarComisionManualVenta']);
 p.node('comision-manual-empleado').value='e';p.node('comision-manual-venta').value='ficticia';p.context._comisionManualVentasMap.ficticia=p.context.ventasList[0];p.node('comision-manual-pct').value='5';p.node('comision-manual-fecha').value='2026-10-20';
 p.context.tienePermiso=()=>false;await p.context.guardarComisionManualVenta();assert.equal(f.commands.length,0);
 p.context.tienePermiso=()=>true;await p.context.guardarComisionManualVenta();assert.equal(f.commands.length,1);assert.equal(f.commits.length,1);assert.match(p.messages.at(-1),/pendiente de aprobación/);assert.equal(p.node('comision-manual-guardar').disabled,false);assert.equal(p.node('modal-comision-venta').style.display,'none');
});

test('El resumen pagado legacy sobrevive dos pagos, edición y anulación sin inventar pagos históricos',async()=>{
 const f=createBackend({gastos:{g:{...expense(),montoPagado:30}},ctaemp:{e:{m:{...movement(),montoPagado:30}}}}),p=f.page();p.refresh();
 await p.context._registrarPagoGastoUnitario('g',20,'Efectivo',null,null);await p.context._registrarPagoGastoUnitario('g',50,'Transferencia',null,null);
 let g=f.get('sisventas/gastos/g'),pagos=Object.keys(g.pagos);assert.equal(g.saldoPagadoLegacy,30);assert.equal(g.montoPagado,100);assert.equal(pagos.length,2);assert.equal(Object.values(g.pagos).reduce((s,p)=>s+p.monto,0),70);assert.equal(p.context.totalPagadoGasto(g),100);
 g.fbKey='g';await p.context._persistirAjustePagoGasto(g,{...g.pagos[pagos[0]],_key:pagos[0]},pagos[0],{monto:10},'edicion','Prueba ficticia');
 assert.equal(f.get('sisventas/gastos/g').montoPagado,90);assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,90);
 g=f.get('sisventas/gastos/g');g.fbKey='g';await p.context._persistirAjustePagoGasto(g,{...g.pagos[pagos[1]],_key:pagos[1]},pagos[1],{anulado:true,estado:'anulado'},'anulacion','Prueba ficticia');
 g=f.get('sisventas/gastos/g');assert.equal(g.montoPagado,40);assert.equal(g.saldoPagadoLegacy,30);assert.equal(p.context.totalPagadoGasto(g),40);assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,40);assert.equal(Object.keys(g.pagos).length,2);
});

test('Editar un pago mientras otra PC agrega uno recalcula desde los dos pagos vigentes',async()=>{
 const f=payment(),other=f.page();await f.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null);f.refresh();other.refresh();
 const g=f.get('sisventas/gastos/g');g.fbKey='g';const token=Object.keys(g.pagos)[0];let inserted=false;
 f.setHook(async command=>{if(!inserted&&command.kind==='atomic'){inserted=true;await other.context._registrarPagoGastoUnitario('g',30,'Transferencia',null,null);}});
 await f.context._persistirAjustePagoGasto(g,{...g.pagos[token],_key:token},token,{monto:50},'edicion','Prueba ficticia');
 const actual=f.get('sisventas/gastos/g');assert.equal(actual.montoPagado,80);assert.equal(Object.keys(actual.pagos).length,2);assert.equal(f.get('sisventas/ctaemp/e/m').montoPagado,80);assert.equal(Object.keys(f.get('sisventas/auditoria_pagos')).length,1);
});

test('Una corrección rechazada no deja adjunto, auditoría ni cambio parcial del pago',async()=>{
 const f=payment();await f.context._registrarPagoGastoUnitario('g',40,'Efectivo',null,null);const before=copy(f.state.sisventas),g=f.get('sisventas/gastos/g');g.fbKey='g';const token=Object.keys(g.pagos)[0];
 f.setRejectPatch(patch=>{if(Object.keys(patch).some(path=>path.startsWith('sisventas/auditoria_pagos/')))throw Object.assign(Error('Rechazo ficticio'),{statusCode:403});});
 await assert.rejects(f.context._persistirAjustePagoGasto(g,{...g.pagos[token],_key:token},token,{monto:30,comprobante:{nombre:'Ficticio.pdf',data:'data:application/pdf;base64,RklDVElDSU8='}},'edicion','Prueba ficticia'));
 assert.deepEqual(f.state.sisventas,before);
});

const salaryRows=p=>[{e:p.context.empData.e,sueldo:100,bonificacion:25,valorHora:10,diasMes:1,cargoInfo:{nombre:'Cargo ficticio'}}];
test('Sueldo y bonificación se vinculan una vez; replay conserva gasto, movimiento y mes',async()=>{
 const f=createBackend(),p=f.page(),rows=salaryRows(p);
 const first=await p.context._registrarHaberesAtomico(rows,'2026-10','2026-10-31','octubre de 2026');assert.equal(first.contador,1);assert.equal(f.commits.length,1);
 assert.equal(f.get('sisventas/gastos/haber_e_2026_10').monto,125);assert.equal(f.get('sisventas/haberes/e/2026_10').bonificacion,25);assert.equal(f.get('sisventas/ctaemp/e/haber_2026_10').gastoFbKey,'haber_e_2026_10');
 const before=copy(f.state.sisventas),second=await p.context._registrarHaberesAtomico([{...rows[0],bonificacion:900}],'2026-10','2026-10-31','octubre de 2026');assert.equal(second.contador,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,1);
 assert.ok(!f.reads.some(([,path])=>['sisventas','sisventas/ctaemp','sisventas/haberes','sisventas/gastos'].includes(path)));
});

test('Un sueldo pagado sin control mensual no se reemplaza y dos PC no registran el mes dos veces',async()=>{
 const old={monto:125,montoPagado:125,estado:'pagado',pagos:{old:{monto:125}}},f=createBackend({gastos:{haber_e_2026_10:old}}),p=f.page(),before=copy(f.state.sisventas);
 await assert.rejects(p.context._registrarHaberesAtomico(salaryRows(p),'2026-10','2026-10-31','octubre de 2026'));assert.deepEqual(f.state.sisventas,before);
 const concurrent=createBackend(),a=concurrent.page(),b=concurrent.page();const results=await Promise.all([a.context._registrarHaberesAtomico(salaryRows(a),'2026-10','2026-10-31','octubre de 2026'),b.context._registrarHaberesAtomico(salaryRows(b),'2026-10','2026-10-31','octubre de 2026')]);
 assert.equal(results.reduce((sum,r)=>sum+r.contador,0),1);assert.equal(concurrent.commits.length,1);assert.equal(Object.keys(concurrent.get('sisventas/gastos')).length,1);
});

test('Un movimiento sueldo pagado sin gasto ni control mensual tampoco se reemplaza',async()=>{
 const m={tipo:'sueldo',monto:125,montoPagado:125,estado:'pagado',pagos:{p:{monto:125}},fecha:'2026-10-31'},f=createBackend({ctaemp:{e:{haber_2026_10:m}}}),p=f.page(),before=copy(f.state.sisventas);
 await assert.rejects(p.context._registrarHaberesAtomico(salaryRows(p),'2026-10','2026-10-31','octubre de 2026'));assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);
});

test('La aplicación de adelanto legacy conserva el neto y confirma sus vínculos con el haber',async()=>{
 const f=createBackend({ctaemp:{e:{a:{tipo:'adelanto',estado:'aprobado',monto:40,fecha:'2026-10-01'}}}}),p=f.page();
 await p.context._registrarHaberesAtomico(salaryRows(p),'2026-10','2026-10-31','octubre de 2026');
 assert.equal(f.get('sisventas/gastos/haber_e_2026_10').monto,85);assert.equal(f.get('sisventas/haberes/e/2026_10').adelantoCompensado,40);assert.equal(f.get('sisventas/ctaemp/e/a').montoCompensado,40);assert.equal(f.get('sisventas/gastos/adelanto_e_a').monto,40);assert.equal(f.commits.length,1);
});

test('Bonificación nueva y replay conservan sueldo e importes pagados; un cambio de payload se rechaza',async()=>{
 const f=createBackend({haberes:{e:{mesPrevio:{sueldo:500}}}}),p=f.page(),mov={tipo:'bonificacion',monto:50,fecha:'2026-10-20',descripcion:'Bono ficticio',ts:1000};
 await p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,mov,'fixture-bonus');p.refresh();await p.context._registrarPagoGastoUnitario('gasto_bonificacion_e_fixture-bonus',50,'Efectivo',null,null);
 const before=copy(f.state.sisventas);await p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,mov,'fixture-bonus');assert.deepEqual(f.state.sisventas,before);
 await assert.rejects(p.context._guardarBonificacionEmpleadoAtomica(p.context.empData.e,{...mov,monto:75},'fixture-bonus'));assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.get('sisventas/haberes/e'),{mesPrevio:{sueldo:500}});
});

test('SAC conserva duplicados legacy por tipo, empleado y semestre, incluso pagados/anulados',async()=>{
 for(const estado of ['pagado','anulado','pendiente']){
  const old={tipoPagable:'AGUINALDO',empleadoFbKey:1,semestre:'2026_S2',monto:50,estado},f=createBackend({empleados:{'1':{nombre:'Ficticio'}},haberes:{'1':{'2026_07':{sueldo:150}}},gastos:{randomLegacy:old}}),p=f.page(),before=copy(f.state.sisventas);
  installSacSources(f,p,['1']);
  const result=await p.context._guardarAguinaldosAtomico([{e:{fbKey:'1',nombre:'Ficticio'},aguinaldo:75,mejorSueldo:150}],'2026_S2','2026-12-01','2do semestre 2026');assert.equal(result.committed,true);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);
 }
});

test('SAC con duplicado explícito usa operación estable y escribe sólo el gasto nuevo',async()=>{
 const f=createBackend({haberes:{e:{'2026_07':{sueldo:150}}},gastos:{old:{tipoPagable:'aguinaldo',empleadoId:'e',semestre:'2026_S2',monto:50,estado:'pagado'}}}),p=f.page(),rows=[{e:p.context.empData.e,aguinaldo:75,mejorSueldo:150}];
 installSacSources(f,p);
 await p.context._guardarAguinaldosAtomico(rows,'2026_S2','2026-12-01','2do semestre 2026','fixture-sac',true);const before=copy(f.state.sisventas);await p.context._guardarAguinaldosAtomico(rows,'2026_S2','2026-12-01','2do semestre 2026','fixture-sac',true);
 assert.deepEqual(f.state.sisventas,before);assert.equal(Object.keys(f.get('sisventas/gastos')).length,2);assert.equal(f.commits.length,1);assert.ok(!Object.hasOwn(f.commands[0].value,'sisventas/gastos'));
});

test('SAC detecta un duplicado legacy agregado después de leer y conserva el pago existente',async()=>{
 const f=createBackend({haberes:{e:{'2026_07':{sueldo:200}}}}),p=f.page(),legacy={tipoPagable:'aguinaldo',empleadoId:'e',semestre:'2026_S2',monto:100,montoPagado:100,estado:'pagado',pagos:{p:{monto:100}}};let inserted=false;
 installSacSources(f,p);
 // Simulate a historical import completed after the client snapshot. Generic
 // creation of a paid SAC is now forbidden; it is not a legitimate UI writer.
 f.setHook(async command=>{if(!inserted&&command.kind==='atomic'){inserted=true;f.state.sisventas.gastos.aleatorio=copy(legacy);}});
 await p.context._guardarAguinaldosAtomico([{e:p.context.empData.e,aguinaldo:100,mejorSueldo:200}],'2026_S2','2026-12-01','2do semestre 2026');
 assert.deepEqual(f.get('sisventas/gastos/aleatorio'),legacy);assert.equal(f.get('sisventas/gastos/aguinaldo_e_2026_S2'),null);assert.equal(f.commits.length,0);assert.equal(f.commands.filter(c=>c.kind==='atomic').length,1);
});

test('El formulario de pago real confirma un lote completo y rechaza un importe superior al saldo',async()=>{
 const f=createBackend({gastos:{g:expense(),h:{...expense(),monto:80,legacyKey:'ctaemp/e/n'}},ctaemp:{e:{m:movement(),n:{...movement(),monto:80,gastoFbKey:'h'}}}}),p=f.page();p.refresh();
 p.load(['puedeAdministrarGastos','restoGasto','_pagoGastoBotonGuardar','confirmarPagoGasto']);
 p.context.getMontoRaw=node=>Number(node.value);p.context.cancelarPagoMultipleGastos=()=>{};
 p.context._gastoPagoMultipleKeys=['g','h'];p.context._gastoFbKeyPago=null;p.context._pagoGastoComprobante=null;
 p.node('mpg-medio').value='Transferencia';p.node('mpg-monto').value='181';p.context.confirmarPagoGasto();assert.match(p.messages.at(-1),/supera el saldo/);assert.equal(f.commands.length,0);
 p.node('mpg-monto').value='120';p.context.confirmarPagoGasto();
 for(let i=0;i<100&&p.context._pagoGastoGuardadoEnCurso;i++)await new Promise(setImmediate);
 assert.equal(p.context._pagoGastoGuardadoEnCurso,false);assert.match(p.messages.at(-1),/Pago múltiple registrado/);assert.equal(f.commits.length,1);assert.equal(p.node('modal-pago-gasto').style.display,'none');
 const lote=Object.values(f.get('sisventas/pagos_realizados'))[0];assert.equal(lote.monto,120);assert.deepEqual(lote.gastos.map(g=>g.saldoPagado),[100,20]);
});

test('El formulario de haberes real conserva permisos, estado ocupado y cierre tras la confirmación',async()=>{
 const f=createBackend(),p=f.page();p.load(['confirmarRegistroHaberes']);p.node('hab-mes-sel').value='2026-10';p.context._habFilasActuales=salaryRows(p);
 p.context.tienePermiso=()=>false;await p.context.confirmarRegistroHaberes();assert.equal(f.commands.length,0);assert.match(p.messages.at(-1),/Solo el administrador/);
 p.context.tienePermiso=()=>true;await p.context.confirmarRegistroHaberes();assert.equal(p.context._habRegistroEnCurso,false);assert.equal(p.node('hab-confirmar-btn').disabled,false);assert.equal(p.node('modal-haberes-mes').isConnected,false);assert.match(p.messages.at(-1),/Haberes.*registrados/);assert.equal(f.commits.length,1);
});

test('Alta Admin rechaza campos cortos de501 caracteres antes de consultar, hashear o truncar',async()=>{
 const f=createBackend(),p=f.page();p.load(['_crearGastoSinDuplicar']);
 for(const field of ['categoria','proveedor','medio','comprobante','vencimiento']){
  const data={fecha:'2026-10-20',descripcion:'Gasto ficticio',monto:1,[field]:'x'.repeat(501)};
  await assert.rejects(p.context._crearGastoSinDuplicar(data),/admite hasta 500 caracteres/);assert.equal(data[field].length,501);
 }
 assert.equal(f.reads.length,0);assert.equal(f.commands.length,0);assert.equal(f.commits.length,0);assert.deepEqual(f.direct,[]);
});
