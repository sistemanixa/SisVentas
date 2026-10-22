'use strict';
const {isDeepStrictEqual}=require('node:util');
const Model=require('./bonus-quantity-model');
const {normalizeRtdb}=require('./payment-membership-index');
const PURPOSE='employee-bonus-batch';
const META_FIELDS=['bonificacionCantidad','bonificacionValorUnitario','bonificacionGrupoId','bonificacionDestinatarios','bonificacionGrupoTotal','bonificacionGrupoPersonas'];
const fail=(message,code='SV_BONUS_BATCH_INVALID',statusCode=400)=>Object.assign(Error(message),{code,statusCode});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const same=(a,b)=>isDeepStrictEqual(normalizeRtdb(a),normalizeRtdb(b));
const hasMetadata=value=>object(value)&&META_FIELDS.some(field=>Object.hasOwn(value,field));
const metadata=value=>Object.fromEntries(META_FIELDS.map(field=>[field,value?.[field]??null]));
const newFields=new Set(['tipo','tipoPagable','estado','monto','fecha','periodoComputo','descripcion','motivo','empleadoId','empleadoFbKey','empleadoNombre','fbKey','gastoFbKey','legacyKey','operacionId','aprobadoPor','aprobadoTs','usuario','origenCarga','ts','bonificacionConceptoId','bonificacionConceptoNombre','categoria','medio','mes','periodoTrabajo','fechaTrabajo','fechaImputacion','semestre','mejorSueldo','hsExtra','origenLegacy','migradoDesdeLegacy','requiereAprobacion','movimientoCtaKey','origen',...META_FIELDS]);
function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day;}
function canonicalLine(value){
 if(!object(value)||META_FIELDS.some(field=>!Object.hasOwn(value,field))||typeof value.bonificacionCantidad!=='number'||typeof value.bonificacionValorUnitario!=='number'||typeof value.monto!=='number')throw fail('El detalle de unidades de la bonificación está incompleto.');
 let line;try{line=Model.line(value.bonificacionCantidad,value.bonificacionValorUnitario);}catch(_){throw fail('Revisá las unidades y el valor por unidad de la bonificación.');}
 if(line.cantidad!==value.bonificacionCantidad||line.valorUnitario!==value.bonificacionValorUnitario||line.monto!==value.monto)throw fail('El importe de la bonificación no coincide con sus unidades.');
 if(typeof value.bonificacionGrupoId!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(value.bonificacionGrupoId)||!Array.isArray(value.bonificacionDestinatarios)||value.bonificacionDestinatarios.length<1||value.bonificacionDestinatarios.length>Model.MAX_EMPLOYEES)throw fail('El grupo de bonificaciones no es válido.');
 let ids;try{ids=value.bonificacionDestinatarios.map(Model.employeeKey);}catch(_){throw fail('Los destinatarios de la bonificación no son válidos.');}
 if(new Set(ids).size!==ids.length||!same(ids,[...ids].sort())||value.bonificacionGrupoPersonas!==ids.length||typeof value.bonificacionGrupoTotal!=='number'||!Number.isFinite(value.bonificacionGrupoTotal)||value.bonificacionGrupoTotal<line.monto||value.bonificacionGrupoTotal>1e12)throw fail('El total o los destinatarios del grupo no coinciden.');
 return line;
}
function describe(body){
 if(body?.purpose!==PURPOSE||body.kind!=='atomic'||body.path!==''||!object(body.value)||!object(body.expectedHashes))throw fail('El grupo requiere un único guardado protegido.');
 const rows=new Map(),expenses=new Map();
 for(const [path,value]of Object.entries(body.value)){
  if(!object(value))throw fail('La bonificación debe conservar los dos registros completos.');
  const p=path.split('/');if(p[0]!=='sisventas')throw fail('El grupo incluye una ruta no permitida.');
  if(p[1]==='ctaemp'&&p.length===4){let employee;try{employee=Model.employeeKey(p[2]);}catch(_){throw fail('La referencia del empleado no es válida.');}if(rows.has(employee))throw fail('El empleado está repetido.');rows.set(employee,{employee,movementKey:p[3],movementPath:path,movement:value});}
  else if(p[1]==='gastos'&&p.length===3)expenses.set(p[2],{expensePath:path,expense:value});
  else throw fail('El grupo incluye una ruta no permitida.');
 }
 if(!rows.size||rows.size>Model.MAX_EMPLOYEES||expenses.size!==rows.size||Object.keys(body.value).length!==2*rows.size)throw fail('El grupo no incluye exactamente una bonificación por empleado.');
 const list=[...rows.values()].sort((a,b)=>a.employee<b.employee?-1:a.employee>b.employee?1:0),first=list[0].movement;
 for(const row of list){canonicalLine(row.movement);const group=first.bonificacionGrupoId,expectedMovement=Model.operationKey('bonificacion',[row.employee,group]),expenseKey=Model.operationKey('gasto_bonificacion',[row.employee,group]);
  if(row.movementKey!==expectedMovement||!expenses.has(expenseKey))throw fail('Las referencias del grupo no coinciden.');
  Object.assign(row,expenses.get(expenseKey),{expenseKey,employeePath:'sisventas/empleados/'+row.employee});canonicalLine(row.expense);
  const movement=row.movement,expense=row.expense,legacy='ctaemp/'+row.employee+'/'+row.movementKey;
  if(movement.tipo!=='bonificacion'||expense.tipoPagable!=='bonificacion'||expense.origen!=='bonificacion'||movement.empleadoId!==row.employee||expense.empleadoId!==row.employee||expense.empleadoFbKey!==row.employee||movement.gastoFbKey!==expenseKey||expense.movimientoCtaKey!==row.movementKey||movement.fbKey!==row.movementKey||movement.legacyKey!==legacy||expense.legacyKey!==legacy||movement.operacionId!==group||expense.operacionId!==group)throw fail('La bonificación y su gasto no están vinculados correctamente.');
  for(const field of ['monto','fecha','periodoComputo','descripcion','motivo','bonificacionConceptoId','bonificacionConceptoNombre',...META_FIELDS])if(!same(movement[field]??null,expense[field]??null))throw fail('El detalle de la cuenta y el gasto no coincide.');
  for(const field of ['fecha','periodoComputo','descripcion','motivo','bonificacionConceptoId','bonificacionConceptoNombre','bonificacionValorUnitario','bonificacionGrupoId','bonificacionDestinatarios','bonificacionGrupoTotal','bonificacionGrupoPersonas'])if(!same(movement[field]??null,first[field]??null))throw fail('El grupo debe compartir fecha, mes, motivo, concepto y valor por unidad.');
  if(!validDay(movement.fecha)||typeof movement.periodoComputo!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(movement.periodoComputo)||Number(movement.periodoComputo.slice(0,4))<1000||typeof movement.motivo!=='string'||!movement.motivo.trim()||movement.motivo.length>500||movement.descripcion!=='Bonificación · '+movement.motivo)throw fail('Revisá la fecha, el mes y el motivo de la bonificación.');
 }
 let plan;try{plan=Model.plan({empleados:list.map(row=>({empleadoId:row.employee,cantidad:row.movement.bonificacionCantidad})),valorUnitario:first.bonificacionValorUnitario});}catch(_){throw fail('Las unidades del grupo no son válidas.');}
 for(const row of list){const item=plan.items.find(item=>item.empleadoId===row.employee),expected=Model.metadata(item,first.bonificacionGrupoId,plan);if(!same(metadata(row.movement),expected))throw fail('El grupo completo no coincide con sus destinatarios o total.');}
 const paths=list.flatMap(row=>[row.movementPath,row.expensePath,row.employeePath]);
 if(!same(Object.keys(body.expectedHashes).sort(),[...paths].sort())||paths.some(path=>!/^[a-f0-9]{64}$/.test(body.expectedHashes[path]||'')))throw fail('Verificá cada empleado, su cuenta y su gasto antes de registrar el grupo.');
 return {rows:list,paths,plan};
}
function newRecord(value){
 if(Object.keys(value).some(field=>!newFields.has(field))||value.estado!=='aprobado'||value.requiereAprobacion===true||value.mejorSueldo!=null||value.hsExtra!=null||value.migradoDesdeLegacy===true||value.origenLegacy)throw fail('Una bonificación nueva no puede incluir pagos, compensaciones u otro historial anterior.');
}
async function validateBonusBatch({actor,raw,get,changes=[],patch={},digest}){
 const purpose=actor?.input?.purpose===PURPOSE;let approved=null;
 if(purpose){
  if(actor.mode!=='user'||actor.claims?.uid!==actor.uid||actor.financialAction!=='empleados.bonificar')throw fail('La bonificación requiere el permiso actual del usuario.','SV_BONUS_ACCESS',403);
  approved=describe(actor.input);if(!same(Object.keys(patch).sort(),Object.keys(actor.input.value).sort())||Object.keys(patch).some(path=>!same(patch[path],actor.input.value[path])))throw fail('El grupo contiene cambios adicionales.');let existing=0;
  for(const path of approved.paths)if(digest(await raw(path))!==actor.input.expectedHashes[path])throw fail('Un registro del grupo cambió. Volvé a revisar la selección.','SV_CAS_CONFLICT',409);
  for(const row of approved.rows){const employee=await raw(row.employeePath),movement=await raw(row.movementPath),expense=await raw(row.expensePath);
   if(!object(employee)||employee.activo===false||String(employee.estado||'').toLowerCase()==='inactivo')throw fail('Uno de los empleados ya no está activo. No se registró el grupo.','SV_BONUS_EMPLOYEE_UNAVAILABLE',409);
   if(movement!==null||expense!==null){if(!same(movement,row.movement)||!same(expense,row.expense))throw fail('El grupo ya existe parcialmente o tiene otro detalle. Se conservaron sus importes y pagos.','SV_BONUS_BATCH_CONFLICT',409);existing++;}
   else{newRecord(row.movement);newRecord(row.expense);if(row.movement.empleadoNombre!==(employee.nombre||'')||row.expense.empleadoNombre!==(employee.nombre||''))throw fail('El nombre del empleado cambió. Volvé a revisar el grupo.','SV_CAS_CONFLICT',409);}
  }
  if(existing&&existing!==approved.rows.length)throw fail('El grupo ya existe parcialmente. No se agregaron bonificaciones.','SV_BONUS_BATCH_CONFLICT',409);
 }
 // Metadata is a snapshot. Regular payment/history operations may preserve it,
 // but cannot introduce, erase or alter it to bypass the dedicated purpose.
 const pairs=changes.filter(change=>change.domain==='gastos').map(change=>({before:change.before,after:change.after})),moves=new Set();
 for(const path of Object.keys(patch)){
  if(!path.startsWith('sisventas/ctaemp/'))continue;const p=path.split('/');
  if(p.length>=4)moves.add(p.slice(0,4).join('/'));
  else{const [before,after]=await Promise.all([raw(path),get(path)]);for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))if(!same(before?.[key],after?.[key]))moves.add(path+'/'+key);}
 }
 for(const path of moves)pairs.push({before:await raw(path),after:await get(path)});
 for(const {before,after}of pairs){
  if(after==null)continue;const had=hasMetadata(before),has=hasMetadata(after);if(!had&&!has)continue;
  if(has)canonicalLine(after);
  if(!purpose&&(!had||!has||!same(metadata(before),metadata(after))))throw fail('Las unidades de una bonificación requieren su guardado protegido.','SV_BONUS_PURPOSE_REQUIRED',403);
 }
 return approved;
}
module.exports={PURPOSE,META_FIELDS,describe,validateBonusBatch,hasMetadata,canonicalLine};
