'use strict';
// View-versioned writes never authorize with a public hash of financial data.
// The financial records remain internal and are merged only after a live,
// user-authorized envelope revision and its projection have been verified.
const {isDeepStrictEqual}=require('node:util');
const {parts,child,put,digest}=require('./labor-guard');
const {flatten}=require('./labor-db');
const Calc=require('./commission-calculations');
const ROOT='sv_employee_account_views',PREFIX=ROOT+'/v1',GLOBAL=PREFIX+'/globalExpenses',ROW_PREFIX=GLOBAL+'/rows/';
const COMPANIONS=Object.freeze([{kind:'batch',raw:'sisventas/pagos_realizados',view:PREFIX+'/globalPaymentBatches'},{kind:'audit',raw:'sisventas/auditoria_pagos',view:PREFIX+'/globalPaymentAudit'}]);
const VIEW_KINDS=new Set(['view-compare','view-atomic']);
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const fail=(statusCode,message,code='SV_ACCOUNT_VIEW_WRITE_INVALID')=>Object.assign(Error(message),{statusCode,code});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const copy=v=>v==null?null:structuredClone(v),same=(a,b)=>isDeepStrictEqual(a??null,b??null),own=(v,k)=>Object.hasOwn(v||{},k);
const nonce=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(v);
const reserved=path=>path===ROOT||path.startsWith(ROOT+'/');
const isolated=path=>/^sisventas\/(?:ctaemp|gastos|comisiones_generacion|pagos_realizados|auditoria_pagos)(?:\/|$)/.test(path)||/^sisventas\/config\/(?:comisiones|comisionesEmpleados|maxComisionPct)(?:\/|$)/.test(path);
const editable=path=>/^sisventas\/(?:ctaemp|gastos)(?:\/|$)/.test(path);
const enabled=config=>config?.employeeAccountViews?.schema===1&&config.employeeAccountViews.enabled===true;
const APPROVAL=new Set(['estado','requiereAprobacion','aprobadoPor','aprobadoTs','fechaAprobacion','rechazadoPor','rechazadoTs','fechaRechazo','motivoRechazo','migradoAGastos']);
const PAYMENT=new Set(['pagos','montoPagado','saldoPagadoLegacy','estado','fechaPago','medioPago','medio','usuarioPago','reembolsado','comprobante']);
const PAYMENT_FIELDS=new Set(['monto','fecha','medio','usuario','ts','estado','anulado','anuladoPor','anuladoTs','fechaAnulacion','motivoAnulacion','editadoTs','editadoPor','motivoEdicion','comprobante','lotePagoKey','comprobanteAdjunto','origen']);
const METHODS={
 'gastos.administrar':['gastos',['admin','administrativo']],
 'gastos.aprobar':['gastos',['admin']],
 'gastos.corregirPago':['gastos',['admin']],
 'comisiones.aprobar':['comisiones',['admin']],
 'empleados.aprobarMovimiento':['ctaemp',['admin']],
 'empleados.pagarMovimiento':['ctaemp',['admin']]
};
function actionAllowed(profile,cfg,name){
 const def=METHODS[name],role=profile?.rol;if(!def||profile?.activo!==true||!roles.includes(role))return false;
 const [module,defaults]=def;
 if(cfg!=null&&(!object(cfg)||cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true||Object.values(cfg.bloqueados||{}).includes(module)))return false;
 const [group,action]=name.split('.'),override=cfg?.acciones?.[group]?.[action];
 return typeof override==='boolean'?override:override==null&&defaults.includes(role);
}
function companionPath(path){return COMPANIONS.find(item=>path.startsWith(item.raw+'/')&&parts(path).length>=3)||null;}
function viewPath(path){
 parts(path);if(parts(path).some(key=>['__proto__','prototype','constructor'].includes(key)))throw fail(400,'Referencia de vista inválida');if(path===GLOBAL)return {path,kind:'global'};
 for(const directory of ['globalEmployeeDirectory','globalCargoDirectory'])if(path===PREFIX+'/'+directory||path.startsWith(PREFIX+'/'+directory+'/rows/')&&parts(path).length===5)return {path,kind:'readonly-source',key:parts(path)[4]};
 for(const item of COMPANIONS){if(path===item.view)return {path,kind:'companion-global',companion:item.kind};if(path.startsWith(item.view+'/rows/')&&parts(path).length===5)return {path,kind:'companion-row',companion:item.kind,key:parts(path)[4]};}
 if(path.startsWith(ROW_PREFIX)&&parts(path).length===5)return {path,kind:'expense-row',key:parts(path)[4]};
 const match=path.match(/^sv_employee_account_views\/v1\/employees\/([^/]+)$/);
 if(!match||['__proto__','prototype','constructor'].includes(match[1]))throw fail(400,'Referencia de cuenta inválida');
 return {path,kind:'employee',employeeId:match[1]};
}
function json(value,depth=0){
 if(depth>30||value===undefined||typeof value==='number'&&!Number.isFinite(value)||!['object','string','number','boolean'].includes(typeof value))throw fail(400,'Datos de guardado inválidos');
 if(value&&typeof value==='object'){
  if(!Array.isArray(value)&&!object(value))throw fail(400,'Datos de guardado inválidos');
  for(const [key,child]of Object.entries(value)){parts(key);if(['__proto__','prototype','constructor'].includes(key))throw fail(400,'Clave de guardado inválida');json(child,depth+1);}
 }
}
function describe(body){
 if(!object(body)||Object.keys(body).some(k=>!['id','kind','path','value','expectedViews','expectedHashes'].includes(k))||!VIEW_KINDS.has(body.kind)||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||typeof body.path!=='string')throw fail(400,'Solicitud de guardado de cuenta inválida');
 if(Buffer.byteLength(JSON.stringify(body))>16*1024*1024)throw fail(413,'El guardado supera el tamaño permitido');
 const patch=body.kind==='view-atomic'?(body.path===''?flatten('',body.value):null):{[body.path]:body.value};
 if(!patch||!Object.keys(patch).length||Object.keys(patch).length>10000)throw fail(400,'Cambios de cuenta inválidos');
 for(const [path,value]of Object.entries(patch)){
  parts(path);json(value);if(reserved(path)||path==='sisventas'||path==='sisventas/config'||/^sv_(?:labor|commission)_/.test(path))throw fail(400,'Ruta de guardado no permitida');
  if(isolated(path)&&!editable(path)&&!companionPath(path))throw fail(403,'Esta operación de comisión requiere el circuito financiero del administrador','SV_ACCOUNT_FINANCIAL_COMMAND_REQUIRED');
 }
 const expected=body.expectedViews;if(!object(expected)||!Object.keys(expected).length||Object.keys(expected).length>128)throw fail(400,'Falta la versión de la cuenta');
 const views=Object.entries(expected).map(([path,revision])=>{const view=viewPath(path);if(revision===null?view.kind!=='companion-row':!nonce(revision))throw fail(400,'Versión de cuenta inválida');return {...view,revision};});
 const hashes=body.expectedHashes??{};if(!object(hashes)||Object.keys(hashes).length>128)throw fail(400,'Comparación de fuentes inválida');
 for(const [path,hash]of Object.entries(hashes)){
  parts(path);if(isolated(path)||reserved(path)||COMPANIONS.some(item=>path===item.raw||path.startsWith(item.raw+'/'))||/^sisventas\/(?:empleados|haberes|aguinaldos)(?:\/|$)/.test(path)||/^sisventas\/config\/cargos(?:\/|$)/.test(path)||!/^[a-f0-9]{64}$/.test(hash))throw fail(400,'Esta fuente requiere un comando específico, no un hash de la vista','SV_ACCOUNT_SOURCE_COMMAND_REQUIRED');
 }
 for(const path of Object.keys(patch))if(!editable(path)&&!companionPath(path)){
  if(!/^sisventas\/(?:gastos_adjuntos|pagos_realizados|auditoria_pagos)\/[^/]+(?:\/|$)/.test(path))throw fail(403,'Esta operación acompañante requiere un comando específico','SV_ACCOUNT_SOURCE_COMMAND_REQUIRED');
  if(!Object.keys(hashes).some(base=>path===base||path.startsWith(base+'/')))throw fail(400,'Falta verificar una fuente acompañante');
 }
 if(!Object.keys(patch).some(editable))throw fail(400,'El guardado no contiene movimientos de cuenta');
 return {patch,views,hashes};
}
function revisionOf(envelope){
 if(!object(envelope)||envelope.meta?.schema!==1||envelope.meta.ready!==true||!nonce(envelope.meta.revision))throw fail(503,'La cuenta requiere completar su preparación antes de guardar','SV_ACCOUNT_VIEW_UNREADY');
 return envelope.meta.revision;
}
function requireEnvelope(envelopes,path){const value=envelopes.get(path);if(!value)throw fail(400,'Falta verificar toda la cuenta del empleado','SV_ACCOUNT_MEMBERSHIP_REQUIRED');return value;}
function owners(record){
 const ids=[record?.empleadoId,record?.empleadoFbKey].filter(v=>v!==undefined&&v!==null&&v!=='').map(String),legacy=String(record?.legacyKey||'').match(/^ctaemp\/([^/]+)\/[^/]+$/);
 if(legacy)ids.push(legacy[1]);if(new Set(ids).size>1)throw fail(409,'El vínculo de la cuenta requiere revisión','SV_ACCOUNT_VIEW_REVIEW');return [...new Set(ids)];
}
function sourceRecord(path,envelopes){
 const p=parts(path),companion=companionPath(path);
 if(companion){
  const rowPath=companion.view+'/rows/'+p[2],global=envelopes.get(companion.view);let value;
  if(envelopes.has(rowPath)){const row=envelopes.get(rowPath);value=row===null?null:row.value??null;}
  else if(global){const row=global.rows?.[p[2]];if(row){revisionOf(row);value=row.value??null;}else value=null;}
  else throw fail(403,'Falta verificar el registro de pago acompañante','SV_ACCOUNT_VIEW_ACCESS');
  return {kind:companion.kind,key:p[2],base:p.slice(0,3).join('/'),relative:p.slice(3),view:companion.view,value:copy(value)};
 }
 if(p[0]!=='sisventas'||!['ctaemp','gastos'].includes(p[1]))return null;
 if(p[1]==='ctaemp'){
  if(p.length<3)throw fail(400,'La cuenta debe verificarse por empleado');const envelope=requireEnvelope(envelopes,PREFIX+'/employees/'+p[2]);
  if(envelope.ctaemp!=null&&!object(envelope.ctaemp))throw fail(503,'La cuenta no está preparada','SV_ACCOUNT_VIEW_UNREADY');
  return {base:p.slice(0,4).join('/'),employeeId:p[2],key:p[3],value:p.length===3?copy(envelope.ctaemp||{}):copy(envelope.ctaemp?.[p[3]]??null),kind:p.length===3?'account':'movement',relative:p.slice(4)};
 }
 if(p.length===2){const envelope=requireEnvelope(envelopes,GLOBAL);if(envelope.rows!=null&&!object(envelope.rows))throw fail(503,'El listado de gastos no está preparado','SV_ACCOUNT_VIEW_UNREADY');const rows=Object.fromEntries(Object.entries(envelope.rows||{}).map(([key,row])=>{revisionOf(row);return [key,row.value??null];}));return {base:path,value:copy(rows),kind:'expenses',relative:[]};}
 const key=p[2],candidates=[];let observed=envelopes.has(ROW_PREFIX+key)||envelopes.has(GLOBAL);
 for(const [scope,envelope]of envelopes){
  if(scope===ROW_PREFIX+key){candidates.push(envelope.value??null);continue;}
  const rows=scope===GLOBAL?envelope.rows:scope.startsWith(PREFIX+'/employees/')?envelope.gastos:null;
  if(object(rows)&&own(rows,key)){observed=true;const row=rows[key];if(scope===GLOBAL){revisionOf(row);candidates.push(row.value??null);}else candidates.push(row);}
 }
 if(!observed)throw fail(403,'El gasto no pertenece a las vistas autorizadas','SV_ACCOUNT_VIEW_ACCESS');
 if(candidates.length>1&&candidates.some(value=>!same(value,candidates[0])))throw fail(409,'Las vistas del gasto requieren revisión','SV_ACCOUNT_VIEW_REVIEW');
 return {base:p.slice(0,3).join('/'),key,value:copy(candidates[0]??null),kind:'expense',relative:p.slice(3)};
}
function projection(model,info,raw){
 const result=info.kind==='movement'?model.projectMovement(raw,{employeeId:info.employeeId,key:info.key}):model.projectExpense(raw,{key:info.key});
 if(!result||result.complete!==true)throw fail(409,'El registro requiere revisión antes de guardar','SV_ACCOUNT_VIEW_REVIEW');return copy(result.value);
}
async function companionProjection(model,info,raw,scope){
 const expenses=new Map();for(const key of model.companionExpenseKeys(info.kind,raw)){parts(key);expenses.set(key,await scope.get('sisventas/gastos/'+key));}
 const project=info.kind==='batch'?model.projectPaymentBatch:model.projectPaymentAudit,result=project(raw,{key:info.key,expenseForKey:key=>expenses.get(key)??null});
 if(result?.complete!==true)throw fail(409,'El registro acompañante requiere revisión','SV_ACCOUNT_VIEW_REVIEW');return copy(result.value);
}
function scalar(value){return value===null||['string','number','boolean'].includes(typeof value)&&!(typeof value==='number'&&!Number.isFinite(value));}
function changedKeys(before,after){return [...new Set([...Object.keys(before||{}),...Object.keys(after||{})])].filter(key=>!same(before?.[key],after?.[key]));}
function paymentValue(field,value){
 if(field!=='comprobante'||scalar(value??null))return scalar(value??null);
 const receipt=new Set(['id','comprobanteId','externo','comprobanteExterno','tipo','type','nombre','name','ts','data','base64','url','src','ruta','path','size','tamano','mime','filename']);
 return object(value)&&Object.entries(value).every(([key,next])=>receipt.has(key)&&scalar(next));
}
function mergePayments(raw,before,after){
 if(!after||typeof after!=='object')throw fail(400,'No se puede retirar el historial de pagos');
 const map=value=>Object.fromEntries(Object.entries(value||{}).filter(([,v])=>v!==null)),old=map(before),next=map(after),source=map(raw),out=Object.create(null);
 const oldKey=key=>Array.isArray(before)&&/^legacy_\d+$/.test(key)?key.slice(7):key;
 const renamed=Array.isArray(before)&&!Array.isArray(after);
 for(const key of Object.keys(old)){const target=renamed?'legacy_'+key:key;if(!own(next,target))throw fail(400,'No se puede eliminar un pago existente');}
 for(const [key,value]of Object.entries(next)){
  const previous=old[oldKey(key)]??null,original=source[oldKey(key)]??null;
  if(!object(value))throw fail(400,'Pago inválido');
  if(previous===null&&(!(Number(value.monto)>0)||!Number.isFinite(Number(value.monto))||value.anulado===true||String(value.estado||'').toLowerCase()==='anulado'))throw fail(400,'Un pago nuevo debe tener un importe positivo y vigente');
  const merged=copy(original)||{};
  for(const field of changedKeys(previous,value)){
   if(!PAYMENT_FIELDS.has(field)||!paymentValue(field,value[field])||!own(previous,field)&&own(original,field))throw fail(400,'El cambio de pago excede los campos permitidos');
   if(field==='monto'&&(!(Number(value[field])>0)||!Number.isFinite(Number(value[field]))))throw fail(400,'La corrección requiere un importe positivo');
   if(!own(value,field))delete merged[field];else Object.defineProperty(merged,field,{value:copy(value[field]),enumerable:true,writable:true,configurable:true});
  }
  out[key]=merged;
 }
 return Array.isArray(after)?Object.assign([],out):out;
}
function mergeProjectedRecord(raw,before,after,context={}){
 if(!object(raw)||!object(before)||!object(after))throw fail(409,'Las altas o bajas requieren un comando específico','SV_ACCOUNT_RECORD_COMMAND_REQUIRED');
 const fields=changedKeys(before,after),payment=fields.some(key=>PAYMENT.has(key)&&!APPROVAL.has(key));
 const allowed=payment?PAYMENT:APPROVAL;if(!fields.length)return {value:copy(raw),fields,kind:'unchanged'};
 const merged=copy(raw);
 for(const field of fields){
  if(!allowed.has(field)||!own(before,field)&&own(raw,field))throw fail(403,'El cambio excede la aprobación o pago permitido','SV_ACCOUNT_FIELD_FORBIDDEN');
  if(field==='pagos'){merged.pagos=mergePayments(raw.pagos,before.pagos,after.pagos);continue;}
  if(!scalar(after[field]??null))throw fail(400,'Campo de cuenta inválido');
  if(!own(after,field))delete merged[field];else Object.defineProperty(merged,field,{value:copy(after[field]),enumerable:true,writable:true,configurable:true});
 }
 if(payment){
  const state=String(raw.estado||'').toLowerCase(),calculated=Calc.normalizarEstadoGasto(raw);if(['pendiente_aprobacion','rechazado','anulado'].includes(calculated)||state==='pendiente'&&(context.kind==='movement'||Calc.esComision(raw)))throw fail(409,'El movimiento requiere aprobación antes de registrar pagos','SV_ACCOUNT_PAYMENT_REVIEW');
  const oldPaid=Calc.totalPagadoGasto(raw),paid=Calc.totalPagadoGasto(merged),amount=Number(raw.monto);
  const legacy=Math.max(0,Number(raw.saldoPagadoLegacy)||0),expectedLegacy=!Object.keys(raw.pagos||{}).length&&!legacy?Math.max(0,Number(raw.montoPagado)||0):legacy;
  if(own(merged,'saldoPagadoLegacy')&&Number(merged.saldoPagadoLegacy)!==expectedLegacy)throw fail(400,'No se puede fabricar un saldo pagado anterior');
  const appended=Object.keys(after.pagos||{}).some(key=>!own(before.pagos,key)&&!(Array.isArray(before.pagos)&&/^legacy_\d+$/.test(key)&&own(before.pagos,key.slice(7))));
  const modifiedExisting=Object.keys(before.pagos||{}).some(key=>!same(before.pagos[key],after.pagos?.[key]??after.pagos?.['legacy_'+key]));
  if(paid>oldPaid+0.00001&&!appended&&!modifiedExisting)throw fail(400,'El pago nuevo requiere su entrada identificada en el historial');
  if(!Number.isFinite(paid)||paid<0||!Number.isFinite(amount)||paid>amount+0.01)throw fail(409,'Los pagos no coinciden con el saldo vigente','SV_ACCOUNT_PAYMENT_REVIEW');
  if(Math.abs((Number(merged.montoPagado)||0)-paid)>0.0100001)throw fail(400,'El resumen no coincide con el historial de pagos');
  const nextState=String(merged.estado||'').toLowerCase(),expectedState=paid>=amount-0.01?'pagado':paid>0?'pagado_parcial':null;
  if(expectedState?nextState!==expectedState:!['aprobado','pendiente_pago'].includes(nextState))throw fail(400,'El estado no coincide con los pagos confirmados');
 }else{
  if(!['aprobado','pendiente_pago','rechazado'].includes(String(merged.estado||'').toLowerCase()))throw fail(400,'La aprobación no puede registrar pagos ni anular el movimiento');
  if(Calc.totalPagadoGasto(raw)>0||['anulado','pagado','pagado_parcial'].includes(String(raw.estado||'').toLowerCase()))throw fail(409,'Un movimiento con pagos o anulado no puede cambiar su aprobación');
 }
 return {value:merged,fields,kind:payment?'payment':'approval'};
}
function alternatives(info,raw,kind,before,after){
 if(kind==='approval')return info.kind==='movement'?['empleados.aprobarMovimiento']:Calc.esComision(raw)?['comisiones.aprobar']:['gastos.aprobar'];
 const old=before?.pagos||{},next=after?.pagos||{},fields=new Set();
 for(const key of Object.keys(old)){const value=next[key]??next['legacy_'+key];if(!same(old[key],value))for(const field of changedKeys(old[key],value))fields.add(field);}
 const appended=Object.keys(next).some(key=>!own(old,key)&&!(Array.isArray(old)&&/^legacy_\d+$/.test(key)&&own(old,key.slice(7))));
 const header=changedKeys(before,after),critical=[...fields].some(field=>field!=='medio')||!appended&&Calc.totalPagadoGasto(raw)>0&&header.some(field=>['fechaPago','comprobante','usuarioPago'].includes(field));
 if(critical&&appended)throw fail(400,'La corrección y el nuevo pago requieren operaciones separadas','SV_ACCOUNT_PAYMENT_COMMAND_REQUIRED');
 if(critical)return ['gastos.corregirPago'];
 const correctingMedium=fields.has('medio')||!appended&&Calc.totalPagadoGasto(raw)>0&&header.some(field=>['medio','medioPago'].includes(field));
 return info.kind==='movement'?['empleados.pagarMovimiento']:correctingMedium?['gastos.corregirPago']:['gastos.administrar'];
}
function paymentDelta(before,after){
 const normalize=value=>Object.fromEntries(Object.entries(value||{}).filter(([,v])=>v!==null).map(([key,value])=>[key,value]));
 const old=normalize(before),next=normalize(after),renamed=Array.isArray(before)&&!Array.isArray(after),result={};
 for(const [key,value]of Object.entries(next)){const oldKey=renamed&&/^legacy_\d+$/.test(key)?key.slice(7):key;if(!same(old[oldKey],value))Object.defineProperty(result,key,{value,writable:true,enumerable:true,configurable:true});}
 return result;
}
function verifyMirrors(changes,envelopes){
 const changed=new Map(changes.map(change=>[change.info.base,change])),pairs=new Map();
 function pair(expensePath,movementPath){
  const expense=changed.get(expensePath),movement=changed.get(movementPath);
  if(!expense||!movement)throw fail(409,'La operación debe conservar los dos registros vinculados','SV_ACCOUNT_MIRROR_REQUIRED');
  if(expense.kind!==movement.kind||Calc.normalizarEstadoGasto(expense.value)!==Calc.normalizarEstadoGasto(movement.value)||Math.abs(Calc.totalPagadoGasto(expense.value)-Calc.totalPagadoGasto(movement.value))>0.0100001)throw fail(409,'El gasto y su movimiento no coinciden','SV_ACCOUNT_MIRROR_REVIEW');
  if(expense.kind==='payment'&&!same(paymentDelta(expense.before.pagos,expense.after.pagos),paymentDelta(movement.before.pagos,movement.after.pagos)))throw fail(409,'Los pagos vinculados no tienen la misma referencia','SV_ACCOUNT_MIRROR_REVIEW');
  pairs.set(JSON.stringify([expensePath,movementPath]),[expense,movement]);
 }
 for(const change of changes){
  const {info,raw}=change;
  if(info.kind==='expense'){
   for(const id of owners(raw)){
    const account=requireEnvelope(envelopes,PREFIX+'/employees/'+id),moves=account.ctaemp||{};let found=0;
    for(const [key,move]of Object.entries(moves))if(move&&(move.gastoFbKey===info.key||move.gastoKey===info.key||raw.legacyKey==='ctaemp/'+id+'/'+key||raw.movimientoCtaKey===key)){found++;pair(info.base,'sisventas/ctaemp/'+id+'/'+key);}
    if(!found&&(raw.legacyKey||raw.movimientoCtaKey))throw fail(409,'El vínculo de la cuenta requiere revisión','SV_ACCOUNT_MIRROR_REVIEW');
   }
  }else{
   const account=requireEnvelope(envelopes,PREFIX+'/employees/'+info.employeeId),ids=new Set([raw.gastoFbKey,raw.gastoKey].filter(Boolean));
   for(const [key,expense]of Object.entries(account.gastos||{}))if(expense&&(expense.legacyKey==='ctaemp/'+info.employeeId+'/'+info.key||expense.movimientoCtaKey===info.key))ids.add(key);
   for(const id of ids)pair('sisventas/gastos/'+id,info.base);
  }
 }
 return [...pairs.values()];
}
const BATCH_FIELDS=new Set(['fecha','ts','medio','monto','usuario','rol','comprobante','gastos']);
const AUDIT_FIELDS=new Set(['accion','gastoFbKey','pagoKey','descripcion','anterior','nuevo','motivo','usuario','rol','ts']);
const ADJUSTMENT_FIELDS=new Set(['accion','gastoFbKey','pagoKey','motivo','usuario','ts']);
function exactFields(value,fields){return object(value)&&Object.keys(value).every(key=>fields.has(key));}
function financialSummary(payment){return {monto:parseFloat(payment?.monto)||0,fecha:payment?.fecha||'',medio:payment?.medio||'',estado:payment?.estado||''};}
function changedPayment(change,key){
 const before=change.raw?.pagos?.[key],after=change.value?.pagos?.[key];
 if(!before||!after||same(before,after))throw fail(400,'La auditoría no corresponde a un pago modificado','SV_ACCOUNT_COMPANION_INVALID');
 return {before,after};
}
function validateCompanions(companions,changes,staged,requirements,absences){
 const expenses=new Map(changes.filter(item=>item.info.kind==='expense').map(item=>[item.info.key,item])),audits=new Map(companions.filter(item=>item.info.kind==='audit').map(item=>[item.info.key,item]));
 for(const entry of companions){
  const {info,raw,after}=entry;if(own(after,'comprobante')&&!paymentValue('comprobante',after.comprobante))throw fail(400,'Comprobante acompañante inválido');if(!object(after))throw fail(400,'El registro acompañante debe conservarse','SV_ACCOUNT_COMPANION_INVALID');
  if(info.kind==='audit'){
   if(raw!==null)throw fail(409,'La auditoría existente se conserva sin cambios','SV_ACCOUNT_COMPANION_IMMUTABLE');
   if(!exactFields(after,AUDIT_FIELDS)||!['edicion','anulacion'].includes(after.accion))throw fail(400,'Detalle de auditoría no permitido','SV_ACCOUNT_COMPANION_INVALID');
   const expense=expenses.get(after.gastoFbKey);if(!expense||expense.kind!=='payment')throw fail(400,'La auditoría necesita su cambio de pago','SV_ACCOUNT_COMPANION_INVALID');
   const payment=changedPayment(expense,after.pagoKey);
   if(!same(after.anterior,financialSummary(payment.before))||!same(after.nuevo,financialSummary(payment.after)))throw fail(409,'La auditoría no coincide con los pagos actuales','SV_ACCOUNT_COMPANION_INVALID');
   if(typeof after.motivo!=='string'||!after.motivo.trim()||after.motivo.length>1000||!Number.isSafeInteger(after.ts)||after.ts<0)throw fail(400,'La auditoría requiere motivo y fecha válidos');
   staged[info.base]=copy(after);absences.add(info.base);requirements.push(['gastos.corregirPago']);continue;
  }
  if(raw===null){
   if(!exactFields(after,BATCH_FIELDS)||!after.gastos||typeof after.gastos!=='object'||!Number.isFinite(Number(after.monto)))throw fail(400,'Detalle de lote no permitido','SV_ACCOUNT_COMPANION_INVALID');
   const used=new Set();let total=0;
   for(const row of Object.values(after.gastos)){
    if(!exactFields(row,new Set(['gastoFbKey','descripcion','monto','saldoPagado']))||used.has(row.gastoFbKey))throw fail(400,'El lote contiene un gasto inválido','SV_ACCOUNT_COMPANION_INVALID');used.add(row.gastoFbKey);
    const expense=expenses.get(row.gastoFbKey);if(!expense||expense.kind!=='payment'||Number(row.monto)!==Number(expense.raw.monto))throw fail(409,'El lote no corresponde a los gastos vigentes','SV_ACCOUNT_COMPANION_INVALID');
    const before=expense.raw.pagos||{},newPayments=Object.entries(expense.value.pagos||{}).filter(([key,p])=>!own(before,key)&&!(Array.isArray(before)&&/^legacy_\d+$/.test(key)&&own(before,key.slice(7)))&&p.lotePagoKey===info.key);
    const amount=newPayments.reduce((sum,[,p])=>sum+Number(p.monto),0);
    if(!newPayments.length||!(amount>0)||Math.abs(Number(row.saldoPagado)-amount)>0.000001)throw fail(409,'El lote no coincide con los pagos nuevos','SV_ACCOUNT_COMPANION_INVALID');total+=amount;
   }
   if(!used.size||Math.abs(Number(after.monto)-total)>0.000001)throw fail(400,'El total del lote no coincide con sus pagos','SV_ACCOUNT_COMPANION_INVALID');
   for(const expense of expenses.values())if(Object.values(expense.value.pagos||{}).some(p=>p?.lotePagoKey===info.key)&&!used.has(expense.info.key))throw fail(400,'Falta un pago del lote','SV_ACCOUNT_COMPANION_INVALID');
   staged[info.base]=copy(after);absences.add(info.base);continue;
  }
  if(changedKeys(entry.before,after).some(key=>key!=='ajustes')||!object(after.ajustes))throw fail(403,'El lote existente sólo admite nuevos ajustes','SV_ACCOUNT_COMPANION_IMMUTABLE');
  const old=entry.before.ajustes||{};
  for(const [key,value]of Object.entries(old))if(!same(value,after.ajustes[key]))throw fail(403,'Los ajustes previos se conservan sin cambios','SV_ACCOUNT_COMPANION_IMMUTABLE');
  let count=0;
  for(const [key,value]of Object.entries(after.ajustes))if(!own(old,key)){
   const audit=audits.get(key);if(!exactFields(value,ADJUSTMENT_FIELDS)||!audit||audit.raw!==null||[...ADJUSTMENT_FIELDS].some(field=>!same(value[field],audit.after[field])))throw fail(400,'El ajuste necesita su auditoría de pago','SV_ACCOUNT_COMPANION_INVALID');
   if(!Object.values(raw.gastos||{}).some(line=>line?.gastoFbKey===value.gastoFbKey))throw fail(409,'El ajuste no pertenece al lote','SV_ACCOUNT_COMPANION_INVALID');
   staged[info.base+'/ajustes/'+key]=copy(value);count++;
  }
  if(!count)throw fail(400,'El lote no contiene ajustes nuevos');requirements.push(['gastos.corregirPago']);
 }
}
async function checkLegacy(scope,actor,patch){
 if(!Object.keys(patch).some(isolated))return;
 const config=await scope.get('sv_labor_config');if(!enabled(config))return;
 const profile=await scope.get('sv_chat_roles/'+actor.uid);
 if(profile?.activo!==true)throw fail(403,'Usuario sin acceso');
 if(profile.rol!=='admin')throw fail(409,'Actualizá la aplicación para guardar con la vista protegida de tu cuenta','SV_ACCOUNT_WRITER_VERSION');
}
async function write({actor,body,guard,model}){
 const plan=describe(body);if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
 model||=require('./employee-account-view-model');
 return guard.run({uid:actor.uid,claims:actor.claims,mode:'user',opId:body.id,transportDigest:digest(body),operation:body.kind,input:body},async scope=>{
  if(!enabled(await scope.get('sv_labor_config')))throw fail(503,'La vista protegida de la cuenta no está habilitada','SV_ACCOUNT_VIEW_UNREADY');
  if(typeof scope.beforeCommit!=='function'||typeof scope.getAsUser!=='function')throw fail(503,'El guardado de cuenta necesita completar su actualización','SV_ACCOUNT_VIEW_WRITER_UNREADY');
  const profile=await scope.get('sv_chat_roles/'+actor.uid);if(profile?.activo!==true||!roles.includes(profile.rol))throw fail(403,'Usuario sin acceso');
  const cfg=await scope.get('sv_permisos/'+profile.rol),authFingerprint=digest({profile,cfg}),envelopes=new Map();
  for(const view of plan.views){const envelope=await scope.getAsUser(view.path);if(view.revision===null?envelope!==null:revisionOf(envelope)!==view.revision)throw fail(409,'La cuenta cambió. Volvé a revisar la operación','SV_CAS_CONFLICT');envelopes.set(view.path,envelope);}
  for(const [path,hash]of Object.entries(plan.hashes)){const value=await scope.getAsUser(path);if(digest(value)!==hash)throw fail(409,'Una fuente cambió. Volvé a revisar la operación','SV_CAS_CONFLICT');}
  const staged=Object.create(null),requirements=[],proposals=new Map(),changes=[],companions=[],absences=new Set();
  function propose(info,value){
   const previous=proposals.get(info.base);if(previous&&!info.relative.length)throw fail(400,'Cambios de cuenta superpuestos');
   proposals.set(info.base,{info:{...info,relative:[]},value});
  }
  for(const [path,value]of Object.entries(plan.patch)){
   if(!editable(path)&&!companionPath(path)){staged[path]=copy(value);continue;}
   const info=sourceRecord(path,envelopes);
   if(info.kind==='account'||info.kind==='expenses'){
    if(!object(value))throw fail(400,'No se permite sustituir un conjunto de cuentas');
    for(const key of new Set([...Object.keys(info.value||{}),...Object.keys(value)]))if(!same(info.value?.[key],value[key])){
     const rowPath=info.kind==='account'?path+'/'+key:'sisventas/gastos/'+key;propose(sourceRecord(rowPath,envelopes),copy(value[key]??null));
    }
   }else propose(info,info.relative.length?put(proposals.get(info.base)?.value??info.value,info.relative,value):copy(value));
  }
  for(const [path,{info,value}]of proposals){
   const raw=await scope.get(path),companion=info.kind==='batch'||info.kind==='audit',visible=companion?await companionProjection(model,info,raw,scope):projection(model,info,raw);
   if(!same(visible,info.value))throw fail(409,'El registro y su vista requieren revisión','SV_ACCOUNT_VIEW_REVIEW');
   if(same(visible,value))continue;
   if(companion){await companionProjection(model,info,value,scope);companions.push({info,raw,before:visible,after:value});continue;}
   const merged=mergeProjectedRecord(raw,visible,value,{kind:info.kind});
   if(info.kind==='expense')for(const id of owners(raw))requireEnvelope(envelopes,PREFIX+'/employees/'+id);
   staged[path]=merged.value;changes.push({info,raw,before:visible,after:value,value:merged.value,kind:merged.kind,allowed:alternatives(info,raw,merged.kind,visible,value)});
  }
  validateCompanions(companions,changes,staged,requirements,absences);
  const pairs=verifyMirrors(changes,envelopes);
  for(const [expense,movement]of pairs){const allowed=[...new Set([...expense.allowed,...movement.allowed])];expense.allowed=allowed;movement.allowed=allowed;}
  for(const change of changes){if(!change.allowed.some(action=>actionAllowed(profile,cfg,action)))throw fail(403,'No tenés permiso para esta aprobación o pago','SV_ACCOUNT_ACTION_DENIED');requirements.push(change.allowed);}
  if(!changes.length&&Object.keys(staged).length)throw fail(403,'Los registros acompañantes requieren una operación financiera válida','SV_ACCOUNT_SOURCE_COMMAND_REQUIRED');
  scope.beforeCommit(async({readFresh,readFreshAsUser}={})=>{
   if(typeof readFresh!=='function'||typeof readFreshAsUser!=='function')throw fail(503,'Falta la verificación final de la cuenta','SV_ACCOUNT_VIEW_WRITER_UNREADY');
   const freshProfile=await readFresh('sv_chat_roles/'+actor.uid),freshCfg=freshProfile?.rol?await readFresh('sv_permisos/'+freshProfile.rol):null;
   if(digest({profile:freshProfile,cfg:freshCfg})!==authFingerprint||requirements.some(list=>!list.some(action=>actionAllowed(freshProfile,freshCfg,action))))throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación','SV_LABOR_AUTH_CHANGED');
   for(const view of plan.views){const envelope=await readFreshAsUser(view.path);if(view.revision===null?envelope!==null:revisionOf(envelope)!==view.revision)throw fail(409,'La cuenta cambió durante el guardado','SV_CAS_CONFLICT');}
   for(const path of absences)if(await readFresh(path)!==null)throw fail(409,'El destino del pago ya está ocupado','SV_CAS_CONFLICT');
  });
  if(Object.keys(staged).length)await scope.update(staged);return {ok:true,committed:true};
 });
}
module.exports={ROOT,PREFIX,GLOBAL,ROW_PREFIX,COMPANIONS,VIEW_KINDS,reserved,isolated,enabled,describe,revisionOf,sourceRecord,mergeProjectedRecord,mergePayments,actionAllowed,checkLegacy,write};
