'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createBackend,apply,copy}=require('./helpers/labor-ui-flow.cjs'),Index=require('../cotizador/labor-index');
const source=fs.readFileSync('js/modules/maintenance.js','utf8');
const fixed=extra=>({tipo:'Fijo',categoria:'Servicios',descripcion:'Internet',fecha:'2026-10-01',monto:100,estado:'pendiente',ts:1,...extra});
function fixture(initial={}){
 const b=createBackend(initial),p=b.page(),logs=[];vm.runInContext(source,p.context);p.context.svConfirm=async()=>true;p.context.svPrompt=async question=>question.includes('DUPLICADOS')?'DUPLICADOS':'LIMPIAR';p.context.escapeHTML=String;
 p.context.mntLog=message=>logs.push(message);p.context.mntSetEstado=()=>{};p.context.mntSetDupBadge=()=>{};p.context.mntRenderDuplicadosGastosFijos=()=>{};p.context.mntPintarEstadoFechasGastos=()=>{};p.context.mntAnalizarBase=async()=>{};p.context.MNT_STATE.integridadOK=true;
 function setGasto(key,value){const before=b.get('sisventas/gastos/'+key);apply(b.state,{['sisventas/gastos/'+key]:value});apply(b.state,Index.planIndexDelta([{domain:'gastos',key,before,after:value}]));}
 function preview(){p.context._mntDuplicadosGastosFijos=[{keep:{fbKey:'old'},dups:[{fbKey:'new'}]}];}
 return {b,p,logs,setGasto,preview};
}
const noSuccess=f=>assert.equal(f.p.messages.some(message=>message.startsWith('✓')),false,JSON.stringify(f.p.messages));
test('dos importes del mismo peso con centavos distintos no son duplicados ni se reescriben',async()=>{
 const gastos={old:fixed({monto:100.10}),new:fixed({monto:100.40,ts:2})},f=fixture({gastos});await f.p.context.mntAnalizarDuplicadosGastosFijos();assert.equal(f.p.context._mntDuplicadosGastosFijos.length,0);
 f.preview();await f.p.context.mntEliminarDuplicadosGastosFijos();assert.deepEqual(f.b.state.sisventas.gastos,gastos);assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('duplicados conservan el grupo si antiguo o nuevo tiene pagos, base legacy o historial aun anulado',async()=>{
 for(const key of ['old','new'])for(const history of [{montoPagado:10},{saldoPagadoLegacy:10},{estado:'pagado'},{pagos:{p:{monto:10,anulado:true}}},{audit:[{accion:'edición'}]},{historial:{x:{accion:'reversa'}}}]){
  const gastos={old:fixed(),new:fixed({ts:2})};gastos[key]={...gastos[key],...history};const f=fixture({gastos});await f.p.context.mntAnalizarDuplicadosGastosFijos();assert.equal(f.p.context._mntDuplicadosGastosFijos.length,0);
  f.preview();await f.p.context.mntEliminarDuplicadosGastosFijos();assert.deepEqual(f.b.state.sisventas.gastos,gastos);assert.equal(f.b.commits.length,0);noSuccess(f);
 }
});
test('auditoría de pagos externa también protege el duplicado aunque su total sea cero',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2})},auditoria_pagos:{a:{gastoFbKey:'new',accion:'anular_pago'}}});f.preview();await f.p.context.mntEliminarDuplicadosGastosFijos();assert.ok(f.b.get('sisventas/gastos/new'));assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('auditoría concurrente y fbKey embebido viejo no permiten eliminar otro registro',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2,fbKey:'old'})}});await f.p.context.mntAnalizarDuplicadosGastosFijos();assert.equal(f.p.context._mntDuplicadosGastosFijos[0].dups[0].fbKey,'new');
 let changed=false;f.b.setHook(()=>{if(!changed){changed=true;apply(f.b.state,{'sisventas/auditoria_pagos/a':{gastoFbKey:'new',accion:'reversa'}});}});await f.p.context.mntEliminarDuplicadosGastosFijos();assert.ok(f.b.get('sisventas/gastos/new'));assert.ok(f.b.get('sisventas/gastos/old'));assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('duplicado sin historia y su auditoría se confirman en el mismo PATCH con fuentes comparadas',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2})}});f.preview();await f.p.context.mntEliminarDuplicadosGastosFijos();assert.equal(f.b.get('sisventas/gastos/new'),null);assert.ok(f.b.get('sisventas/gastos/old'));assert.equal(f.b.commits.length,1);
 const patch=f.b.commits[0];assert.equal(patch['sisventas/gastos/new'],null);const entry=Object.entries(patch).find(([path])=>path.startsWith('sisventas/mantenimiento/duplicados_fijos/'));assert.deepEqual(entry[1].keys,['new']);assert.equal(f.b.commands[0].kind,'atomic');assert.ok(f.b.commands[0].expectedHashes['sisventas/gastos']);assert.ok(f.b.commands[0].expectedHashes['sisventas/auditoria_pagos']);assert.deepEqual(f.b.direct,[]);
});
test('pago concurrente tras releer duplicados invalida CAS sin borrar ni auditar éxito',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2})}});f.preview();let changed=false;f.b.setHook(()=>{if(!changed){changed=true;f.setGasto('new',fixed({ts:2,montoPagado:50,pagos:{p:{monto:50}}}));}});await f.p.context.mntEliminarDuplicadosGastosFijos();assert.equal(f.b.get('sisventas/gastos/new').montoPagado,50);assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('rechazo de permisos no deja borrado ni auditoría ni falso éxito',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2})}});f.preview();f.b.state.sv_chat_roles.u.activo=false;await f.p.context.mntEliminarDuplicadosGastosFijos();assert.ok(f.b.get('sisventas/gastos/new'));assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('fallar el refresco después del commit no anuncia que la eliminación confirmada fracasó',async()=>{
 const f=fixture({gastos:{old:fixed(),new:fixed({ts:2})}});f.preview();f.p.context.mntAnalizarDuplicadosGastosFijos=async()=>{throw Error('Refresco ficticio fallido');};await f.p.context.mntEliminarDuplicadosGastosFijos();assert.equal(f.b.get('sisventas/gastos/new'),null);assert.equal(f.b.commits.length,1);assert.equal(f.p.messages.filter(message=>message.startsWith('✓')).length,1);assert.ok(!f.p.messages.some(message=>message.startsWith('No se pudo confirmar')));
});
test('fechas comparan el snapshot auditado y registran fecha original, marca y auditoría juntas',async()=>{
 const gasto=fixed({pagos:{p:{monto:20,fecha:'2026-10-10'}}}),f=fixture({gastos:{g:gasto}});await f.p.context.mntAuditarFechasGastos();await f.p.context.mntMigrarFechasGastos();const current=f.b.get('sisventas/gastos/g');assert.equal(current.fecha,'2026-10-10');assert.equal(current.fechaOriginal,'2026-10-01');assert.deepEqual(current.pagos,gasto.pagos);assert.equal(f.b.commits.length,1);
 assert.ok(Object.keys(f.b.commits[0]).some(path=>path.startsWith('sisventas/mantenimiento/fechas_gastos/')));assert.ok(f.b.commits[0]['sisventas/config/migraciones/gastos_fecha_pago_v1']);
});
test('pago agregado después de auditar o antes del commit no recibe la fecha de un snapshot viejo',async()=>{
 for(const beforeAtomic of [true,false]){
  const original=fixed({pagos:{p:{monto:20,fecha:'2026-10-10'}}}),f=fixture({gastos:{g:original}});await f.p.context.mntAuditarFechasGastos();const newer={...original,pagos:{...original.pagos,n:{monto:20,fecha:'2026-10-20'}}};let changed=false;
  if(beforeAtomic)f.setGasto('g',newer);else f.b.setHook(()=>{if(!changed){changed=true;f.setGasto('g',newer);}});
  await f.p.context.mntMigrarFechasGastos();assert.deepEqual(f.b.get('sisventas/gastos/g'),newer);assert.equal(f.b.commits.length,0);noSuccess(f);
 }
});
function legacy(){return {gastos:{a:{tipoPagable:'aguinaldo',empleadoId:'e',monto:100,legacyKey:'aguinaldos/e/2026_S1'},h:{tipoPagable:'hextra',empleadoId:'e',monto:100,legacyKey:'hsextra_solicitudes/old'}},aguinaldos:{e:{'2026_S1':{monto:100,gastoFbKey:'a'}}},hsextra_solicitudes:{old:{estado:'aprobado',empFbKey:'e',monto:100,gastoFbKey:'h'},receipt:{estado:'aprobado',empFbKey:'e',gastoFbKey:'h',aportes:{ap_original:false}},pending:{estado:'pendiente',empFbKey:'e'}},ctaemp:{e:{m:{tipo:'hextra',monto:100,gastoFbKey:'h'}}}};}
test('limpieza elimina sólo hijos migrados y conserva comprobantes de aporte e índices de idempotencia',async()=>{
 const initial=legacy(),f=fixture(initial);await f.p.context.mntLimpiarLegacy();assert.equal(f.b.get('sisventas/aguinaldos/e/2026_S1'),null);assert.equal(f.b.get('sisventas/hsextra_solicitudes/old'),null);assert.equal(f.b.get('sisventas/ctaemp/e/m'),null);assert.deepEqual(f.b.get('sisventas/hsextra_solicitudes/receipt'),initial.hsextra_solicitudes.receipt);assert.deepEqual(f.b.state.sisventas.gastos,initial.gastos);
 assert.equal(f.b.get(Index.bucketPath('hsextra_solicitudes','aporteId','ap_original')+'/receipt'),true);assert.equal(f.b.commits.length,1);const patch=f.b.commits[0],audit=Object.entries(patch).find(([path])=>path.startsWith('sisventas/mantenimiento/limpiezas/'));assert.equal(audit[1].solicitudesConAportesConservadas,1);assert.equal(audit[1].borrados,3);assert.ok(f.logs.some(message=>message.includes('comprobante de aporte: 1')));assert.equal(Object.hasOwn(patch,'sisventas/aguinaldos'),false);assert.deepEqual(f.b.direct,[]);
});
test('aporte concurrente invalida toda limpieza sin eliminar otras fuentes ni su comprobante',async()=>{
 const initial=legacy(),f=fixture(initial);let changed=false;f.b.setHook(()=>{if(changed)return;changed=true;const before=f.b.get('sisventas/hsextra_solicitudes/old'),after={...before,aportes:{ap_new:{detalleDias:[]}}};apply(f.b.state,{'sisventas/hsextra_solicitudes/old':after});apply(f.b.state,Index.planIndexDelta([{domain:'hsextra_solicitudes',key:'old',before,after}]));});
 await f.p.context.mntLimpiarLegacy();assert.ok(f.b.get('sisventas/hsextra_solicitudes/old').aportes.ap_new);assert.ok(f.b.get('sisventas/aguinaldos/e/2026_S1'));assert.ok(f.b.get('sisventas/ctaemp/e/m'));assert.equal(f.b.commits.length,0);noSuccess(f);
});
test('marcas antiguas sin gasto real nunca autorizan borrar solicitudes o cuentas',async()=>{
 const f=fixture({hsextra_solicitudes:{s:{estado:'aprobado',empFbKey:'e',migradoAGastos:true,gastoFbKey:'missing'}},ctaemp:{e:{m:{tipo:'hextra',monto:100,migradoAGastos:true,gastoFbKey:'missing'}}}});await f.p.context.mntLimpiarLegacy();assert.ok(f.b.get('sisventas/hsextra_solicitudes/s'));assert.ok(f.b.get('sisventas/ctaemp/e/m'));assert.equal(f.b.commits.length,0);
});
test('error al leer una fuente o ausencia de adaptador no ejecuta una limpieza parcial ni fallback',async()=>{
 for(const missingAdapter of [false,true]){
  const f=fixture(legacy()),get=f.p.context.fbGet;if(missingAdapter)f.p.context.SVLaborWrites=null;else f.p.context.fbGet=async ref=>{if(new URL(ref.toString()).pathname==='/sisventas/hsextra_solicitudes')throw Error('Lectura ficticia fallida');return get(ref);};
  await f.p.context.mntLimpiarLegacy();assert.ok(f.b.get('sisventas/aguinaldos/e/2026_S1'));assert.ok(f.b.get('sisventas/ctaemp/e/m'));assert.equal(f.b.commits.length,0);assert.deepEqual(f.b.direct,[]);noSuccess(f);
 }
});
