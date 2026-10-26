'use strict';
// Narrow account commands. Financial amounts and commission bases are read only
// from the protected originals; the caller supplies references, never a plan.
const {isDeepStrictEqual}=require('node:util');
const {digest}=require('./labor-guard');
const Views=require('./labor-view-writes');
const Index=require('./labor-index');
const Calc=require('./commission-calculations');
const Advance=require('./labor-advance-discount');
const Public=require('./commission-public-response');
const {_claveOperacionConcurrente}=require('./labor-calculations');
const commandProofs=new WeakMap();
// Only a successful command service run can register this process-local proof.
function trustedCommand(actor){return commandProofs.get(actor)||null;}
const ACTIONS=new Set(['approve','reject','materialize-commission','correct-medium','deliver-advance']);
const fail=(statusCode,message,code='SV_ACCOUNT_COMMAND_INVALID')=>Object.assign(Error(message),{statusCode,code});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>v==null?null:structuredClone(v),same=(a,b)=>isDeepStrictEqual(a??null,b??null);
const key=v=>typeof v==='string'&&!!v&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const numeric=v=>typeof v==='number'||typeof v==='string'&&v.trim()!==''?Number(v):NaN;
const paid=v=>Calc.totalPagadoGasto(v);
const state=v=>String(v?.estado||'').toLowerCase();
function describe(body){
 if(!object(body)||Object.keys(body).some(k=>!['id','action','employeeId','movementKey','expectedRevision','pagoKey','medio','motivo','periodoDescuento'].includes(k))||typeof body.id!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!ACTIONS.has(body.action)||!key(body.employeeId)||!key(body.movementKey)||typeof body.expectedRevision!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(body.expectedRevision))throw fail(400,'Comando de cuenta inválido');
 if(body.pagoKey!==undefined&&(!key(body.pagoKey)||body.action!=='correct-medium'))throw fail(400,'Referencia de pago inválida');
 if(body.medio!==undefined&&(typeof body.medio!=='string'||!body.medio.trim()||body.medio.length>160||/[\x00-\x1f\x7f]/.test(body.medio)||!['correct-medium','deliver-advance'].includes(body.action)))throw fail(400,'Medio de pago inválido');
 if(['correct-medium','deliver-advance'].includes(body.action)&&!body.medio)throw fail(400,'Elegí el medio de pago');
 if(body.motivo!==undefined&&(body.action!=='reject'||typeof body.motivo!=='string'||!body.motivo.trim()||body.motivo.length>1000))throw fail(400,'Motivo inválido');
 if(body.periodoDescuento!==undefined&&(body.action!=='deliver-advance'||!Advance.validMonth(body.periodoDescuento)))throw fail(400,'Mes de descuento inválido');
 if(body.action==='deliver-advance'&&!Advance.validMonth(body.periodoDescuento))throw fail(400,'Elegí el mes de descuento');
 return copy(body);
}
function localDate(ts){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(ts);}
const iso=(v,fallback)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:fallback;
function kindOf(m){const type=String(m?.tipo||'').toLowerCase();return type==='comision'?'commission':type==='adelanto'?'advance':['transporte','materiales','gasto_empresa','otro'].includes(type)?'expense':null;}
function context(profile,cfg,action){
 const allowed=action==='correct-medium'?['empleados.pagarMovimiento']:action==='materialize-commission'?['empleados.aprobarMovimiento','empleados.pagarMovimiento']:['empleados.aprobarMovimiento'];
 if(!allowed.some(name=>Views.actionAllowed(profile,cfg,name)))throw fail(403,'No tenés permiso para esta operación de cuenta','SV_ACCOUNT_ACTION_DENIED');return allowed;
}
function commissionState(m){
 const amount=numeric(m.monto),payment=paid(m);if(['rechazado','anulado'].includes(state(m)))return state(m);
 if(state(m)==='pagado'||payment>=amount-0.01)return 'pagado';if(state(m)==='pagado_parcial'||payment>0)return 'pagado_parcial';
 return state(m)==='aprobado'||m.aprobadoTs||m.aprobadoPor||m.fechaAprobacion?'pendiente_pago':'pendiente_aprobacion';
}
function buildExpense({movement:m,employee={},employeeId,movementKey,kind,actorName='',date,ts}){
 const monto=numeric(m.monto);if(!Number.isFinite(monto)||monto<=0)throw fail(409,'El movimiento requiere revisar su importe original','SV_ACCOUNT_COMMAND_REVIEW');
 const legacyKey='ctaemp/'+employeeId+'/'+movementKey,owner={empleadoId:employeeId,empleadoFbKey:employeeId,empleadoNombre:m.empleadoNombre||employee.nombre||''};
 if(kind==='commission'){
  const estado=commissionState(m),g={fecha:iso(m.fechaAprobacion||m.fecha,date),descripcion:Public.description(m.ventaId||m.ventaFbKey,m.cliente),categoria:'Personal',tipo:'Comisión',tipoPagable:'comision',monto:copy(m.monto),montoPagado:paid(m),estado,requiereAprobacion:estado==='pendiente_aprobacion',aprobadoPor:m.aprobadoPor||'',aprobadoTs:m.aprobadoTs||null,fechaAprobacion:m.fechaAprobacion||'',...owner,ventaId:m.ventaId||'',ventaFbKey:m.ventaFbKey||'',cliente:m.cliente||'',origen:'comision',origenLegacy:'ctaemp',legacyKey,generadoPor:actorName,ts:m.ts||ts};
  // Preserve original private economic fields and types, including an absent
  // historical field. No public DTO default can manufacture a zero percentage.
  for(const field of ['pct','pctOriginal','porcentaje','gananciaBase'])if(Object.hasOwn(m,field))g[field]=copy(m[field]);
  if(m.pagos)g.pagos=copy(m.pagos);else if(g.montoPagado>0)g.saldoPagadoLegacy=g.montoPagado;return g;
 }
 if(kind==='advance'){
  const payments=m.pagos||{},medium=m.medioPago||Object.values(payments).find(Boolean)?.medio;if(!medium)throw fail(409,'Falta el medio de pago del adelanto','SV_ACCOUNT_COMMAND_REVIEW');
  const detalle=String(m.descripcion||'').trim(),nombre=owner.empleadoNombre;
  return {periodoDescuento:Advance.discountPeriod(m),fecha:m.fechaPago||m.fecha||date,vencimiento:'',tipo:'Variable',tipoPagable:'adelanto',categoria:'Personal',descripcion:'Adelanto de personal'+(nombre?' — '+nombre:'')+(detalle?' · '+detalle:''),monto:copy(m.monto),montoPagado:monto,estado:'pagado',medio:medium,pagos:copy(payments),comprobanteSolicitudUrl:m.fotoUrl||null,fotoBase64:m.fotoBase64||m.fotoUrl||null,...owner,origen:'adelanto_personal',origenLegacy:'ctaemp',legacyKey,usuario:m.usuario||actorName,ts:m.ts||ts};
 }
 const requires=state(m)==='pendiente',categories={transporte:'Movilidad',materiales:'Materiales',gasto_empresa:'Gasto empresa',otro:'Otro'},g={fecha:m.fecha||date,tipo:'Variable',tipoPagable:'gasto_empresa',categoria:categories[m.tipo]||'Otro',descripcion:m.descripcion||m.desc||'Gasto solicitado por empleado',monto:copy(m.monto),montoPagado:paid(m),estado:state(m)==='pagado'?'pagado':state(m)==='rechazado'?'rechazado':requires?'pendiente_aprobacion':'aprobado',requiereAprobacion:requires,...owner,solicitadoPor:m.usuario||'',solicitadoTs:m.ts||ts,movimientoCtaKey:movementKey,comprobanteSolicitudUrl:m.fotoUrl||null,ts:m.ts||ts};
 if(m.pagos)g.pagos=copy(m.pagos);if(m.medioPago)g.medio=m.medioPago;return g;
}
function applyAction({body,movement,expense,kind,actorName,role,date,ts}){
 const m=copy(movement),g=copy(expense),action=body.action;
 if(['approve','reject'].includes(action)){
  if(paid(m)>0||paid(g)>0||Object.values(m.pagos||{}).some(p=>p&&p.anulado!==true&&String(p.estado||'').toLowerCase()!=='anulado'&&numeric(p.monto)>0))throw fail(409,'Un movimiento con pagos no puede cambiar su aprobación','SV_ACCOUNT_COMMAND_REVIEW');
  if(state(m)==='anulado'||g&&Calc.normalizarEstadoGasto(g)==='anulado')throw fail(409,'El movimiento está anulado','SV_ACCOUNT_COMMAND_REVIEW');
  const changes=action==='approve'?{estado:'aprobado',requiereAprobacion:false,aprobadoPor:actorName,fechaAprobacion:date,aprobadoTs:ts}:{estado:'rechazado',requiereAprobacion:false,rechazadoPor:actorName,motivoRechazo:body.motivo||'',fechaRechazo:date,aprobadoPor:null,fechaAprobacion:null,aprobadoTs:null};
  Object.assign(m,changes);if(g)Object.assign(g,changes,{estado:action==='approve'&&kind==='commission'?'pendiente_pago':changes.estado});
 }else if(action==='correct-medium'){
  if(body.pagoKey!==undefined){
   const p=m.pagos?.[body.pagoKey],other=g?.pagos?.[body.pagoKey];if(!object(p)||g&&(!object(other)||numeric(other.monto)!==numeric(p.monto)))throw fail(409,'El historial del gasto y del movimiento requiere revisión','SV_ACCOUNT_COMMAND_REVIEW');
   m.pagos[body.pagoKey]={...p,medio:body.medio};if(g)g.pagos[body.pagoKey]={...other,medio:body.medio};
  }else if(Object.values(m.pagos||{}).some(Boolean)||g&&Object.values(g.pagos||{}).some(Boolean))throw fail(409,'Seleccioná el pago que querés corregir','SV_ACCOUNT_COMMAND_REVIEW');
  m.medioPago=body.medio;if(g)g.medio=body.medio;
 }else if(action==='deliver-advance'){
  if(kind!=='advance'||state(m)!=='pendiente'||paid(m)>0||numeric(m.montoCompensado)>0||Object.values(m.pagos||{}).some(Boolean)||g)throw fail(409,'El adelanto cambió o ya fue entregado','SV_ACCOUNT_COMMAND_REVIEW');
  const amount=numeric(m.monto);if(!(amount>0)||!Number.isFinite(amount))throw fail(409,'El adelanto requiere revisar su importe','SV_ACCOUNT_COMMAND_REVIEW');
  const paymentKey=_claveOperacionConcurrente('entrega_adelanto',[body.id,body.employeeId,body.movementKey]);
  Object.assign(m,{periodoDescuento:body.periodoDescuento,estado:'pagado',aprobadoPor:actorName,fechaAprobacion:date,aprobadoTs:ts,montoPagado:amount,fechaPago:date,medioPago:body.medio,pagos:{[paymentKey]:{monto:amount,fecha:date,medio:body.medio,concepto:'adelanto',usuario:actorName,rol:role,ts}}});
 }else if(action!=='materialize-commission'||kind!=='commission')throw fail(400,'Esta acción requiere una comisión original');
 return {movement:m,expense:g};
}
function equivalent(g,m,employeeId,legacy){
 if(!object(g)||!Calc.esComision(g))return false;
 if(g.legacyKey===legacy)return true;
 const ids=[g.empleadoId,g.empleadoFbKey].filter(v=>v!==undefined&&v!==null&&v!=='').map(String);if(!ids.length||ids.some(v=>v!==employeeId))return false;
 if(['ventaFbKey','ventaId'].some(field=>m[field]!==undefined&&m[field]!==null&&m[field]!==''&&g[field]!==undefined&&g[field]!==null&&g[field]!==''&&String(g[field])===String(m[field])))return true;
 return Math.abs(numeric(g.monto)-Math.round(numeric(m.monto)))<=1&&String(g.descripcion||'')===String(m.descripcion||'');
}
async function resolveExpense(scope,m,body){
 const legacy='ctaemp/'+body.employeeId+'/'+body.movementKey,links=[m.gastoFbKey,m.gastoKey].filter(Boolean);
 if(links.some(v=>!key(v))||new Set(links).size>1)throw fail(409,'El vínculo del movimiento requiere revisión','SV_ACCOUNT_COMMAND_REVIEW');
 let id=links[0]||(kindOf(m)==='commission'?_claveOperacionConcurrente('gasto_comision_legacy',[body.employeeId,body.movementKey]):(kindOf(m)==='advance'?'adelanto_':'solicitud_emp_')+body.employeeId.replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+body.movementKey.replace(/[^a-zA-Z0-9_-]/g,'_'));
 if(kindOf(m)==='commission'&&!links.length){
  if(typeof scope.query!=='function')throw fail(503,'Falta el índice de movimientos para comprobar el vínculo','SV_LABOR_INDEX_INVALID');
  const bucket=await scope.get(Index.bucketPath('gastos','legacyKey',legacy)),candidates=new Map();
  if(bucket!==null&&(!object(bucket)||Object.entries(bucket).some(([k,v])=>!key(k)||v!==true)))throw fail(503,'El índice del movimiento requiere preparación','SV_LABOR_INDEX_INVALID');
  for(const candidate of Object.keys(bucket||{})){const value=await scope.get('sisventas/gastos/'+candidate);if(!value||value.legacyKey!==legacy)throw fail(503,'El índice del movimiento requiere preparación','SV_LABOR_INDEX_INVALID');candidates.set(candidate,value);}
  for(const field of ['empleadoId','empleadoFbKey']){
   const rows=await scope.query('sisventas/gastos',field,body.employeeId);if(rows!==null&&!object(rows))throw fail(503,'No se pudo comprobar el vínculo del movimiento','SV_LABOR_INDEX_INVALID');
   for(const [candidate,value]of Object.entries(rows||{})){if(!key(candidate)||String(value?.[field])!==body.employeeId)throw fail(503,'No se pudo comprobar el vínculo del movimiento','SV_LABOR_INDEX_INVALID');candidates.set(candidate,value);}
  }
  const matches=[...candidates].filter(([,g])=>equivalent(g,m,body.employeeId,legacy));
  if(matches.length>1)throw fail(409,'Hay más de un gasto equivalente. Revisá el vínculo antes de continuar','SV_ACCOUNT_COMMAND_REVIEW');
  if(matches.length)id=matches[0][0];
 }
 const expense=await scope.get('sisventas/gastos/'+id);
 if(expense){
  if(!object(expense)||expense.legacyKey&&expense.legacyKey!==legacy||[expense.empleadoId,expense.empleadoFbKey].some(v=>v!==undefined&&v!==null&&v!==''&&String(v)!==body.employeeId))throw fail(409,'El gasto está vinculado a otro movimiento','SV_ACCOUNT_COMMAND_REVIEW');
  if(!links.length&&kindOf(m)==='commission'&&!equivalent(expense,m,body.employeeId,legacy))throw fail(409,'El destino del gasto ya está ocupado','SV_ACCOUNT_COMMAND_REVIEW');
  if(!links.length&&kindOf(m)!=='commission'&&expense.legacyKey!==legacy&&!(expense.movimientoCtaKey===body.movementKey&&[expense.empleadoId,expense.empleadoFbKey].some(id=>id===body.employeeId)))throw fail(409,'El destino del gasto requiere un vínculo original verificable','SV_ACCOUNT_COMMAND_REVIEW');
  if(kindOf(m)==='advance'&&String(expense.tipoPagable||'').toLowerCase()!=='adelanto'&&!String(expense.origen||'').startsWith('adelanto_personal'))throw fail(409,'El gasto no corresponde al adelanto original','SV_ACCOUNT_COMMAND_REVIEW');
  if(kindOf(m)==='commission'&&!Calc.esComision(expense)||kindOf(m)!=='commission'&&Calc.esComision(expense)||numeric(expense.monto)!==numeric(m.monto))throw fail(409,'El gasto y el movimiento requieren revisar su vínculo','SV_ACCOUNT_COMMAND_REVIEW');
 }
 return {id,expense};
}
function createEmployeeAccountCommands({authorize,guard,db,store,now=Date.now,model}={}){
 if(typeof authorize!=='function'||typeof guard?.run!=='function')throw Error('Configuración de comandos de cuenta inválida');
 async function execute(actor,input){
  const body=describe(input);if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');model||=require('./employee-account-view-model');
  const commandActor={uid:actor.uid,claims:actor.claims,mode:'user',opId:body.id,transportDigest:digest(body),operation:'employee-account-command',input:body};
  return guard.run(commandActor,async scope=>{
   const config=await scope.get('sv_labor_config');if(!Views.enabled(config)||config.ready!==true||config.schema!==Index.VERSION)throw fail(503,'La cuenta requiere completar su preparación','SV_ACCOUNT_VIEW_UNREADY');
   if(typeof scope.getAsUser!=='function'||typeof scope.beforeCommit!=='function')throw fail(503,'Falta la verificación final de la cuenta','SV_ACCOUNT_VIEW_WRITER_UNREADY');
   const profile=await scope.get('sv_chat_roles/'+actor.uid),cfg=profile?.rol?await scope.get('sv_permisos/'+profile.rol):null;context(profile,cfg,body.action);const fingerprint=digest({profile,cfg});
   const viewPath=Views.PREFIX+'/employees/'+body.employeeId,envelope=await scope.getAsUser(viewPath);
   if(Views.revisionOf(envelope)!==body.expectedRevision)throw fail(409,'La cuenta cambió. Volvé a revisar la operación','SV_CAS_CONFLICT');
   const path='sisventas/ctaemp/'+body.employeeId+'/'+body.movementKey,original=await scope.get(path),kind=kindOf(original);
   if(!kind)throw fail(409,'El movimiento ya no está disponible o requiere revisión','SV_ACCOUNT_COMMAND_REVIEW');
   const projected=model.projectMovement(original,{employeeId:body.employeeId,key:body.movementKey});
   if(projected?.complete!==true||!same(projected.value,envelope.ctaemp?.[body.movementKey]))throw fail(409,'El movimiento y su vista requieren revisión','SV_ACCOUNT_VIEW_REVIEW');
   const employee=await scope.get('sisventas/empleados/'+body.employeeId);if(!object(employee))throw fail(409,'El empleado ya no está disponible','SV_ACCOUNT_COMMAND_REVIEW');
   const {id:gastoKey,expense}=await resolveExpense(scope,original,body);
   if(expense){const visible=model.projectExpense(expense,{key:gastoKey});if(visible?.complete!==true||!same(visible.value,envelope.gastos?.[gastoKey]))throw fail(409,'El gasto y su vista requieren revisión','SV_ACCOUNT_VIEW_REVIEW');}
   commandProofs.set(commandActor,Object.freeze({uid:actor.uid,action:body.action,employeeId:body.employeeId,movementKey:body.movementKey,gastoKey,expectedRevision:body.expectedRevision,paths:Object.freeze({[path]:digest(original),['sisventas/gastos/'+gastoKey]:digest(expense)})}));
   const ts=now();if(!Number.isSafeInteger(ts)||ts<0)throw fail(503,'No se pudo confirmar la fecha de la operación');
   const actorName=profile.nombre||profile.usuario||actor.uid,date=localDate(ts),applied=applyAction({body,movement:original,expense,kind,actorName,role:profile.rol,date,ts});
   const out=applied.movement,patch={};let gasto=applied.expense;
   if(!gasto&&!(kind==='advance'&&state(out)!=='pagado'))gasto=buildExpense({movement:out,employee,employeeId:body.employeeId,movementKey:body.movementKey,kind,actorName,date,ts});
   if(gasto){out.gastoFbKey=gastoKey;out.migradoAGastos=true;if(kind==='commission')out.legacyKey='ctaemp/'+body.employeeId+'/'+body.movementKey;if(!expense||!same(gasto,expense))patch['sisventas/gastos/'+gastoKey]=gasto;}
   if(!same(out,original))patch[path]=out;
   scope.beforeCommit(async({readFresh,readFreshAsUser}={})=>{
    if(typeof readFresh!=='function'||typeof readFreshAsUser!=='function')throw fail(503,'Falta la verificación final de la cuenta','SV_ACCOUNT_VIEW_WRITER_UNREADY');
    const freshProfile=await readFresh('sv_chat_roles/'+actor.uid),freshCfg=freshProfile?.rol?await readFresh('sv_permisos/'+freshProfile.rol):null;context(freshProfile,freshCfg,body.action);
    if(digest({profile:freshProfile,cfg:freshCfg})!==fingerprint)throw fail(409,'Los permisos cambiaron. Volvé a revisar la operación','SV_LABOR_AUTH_CHANGED');
    if(Views.revisionOf(await readFreshAsUser(viewPath))!==body.expectedRevision)throw fail(409,'La cuenta cambió durante el guardado','SV_CAS_CONFLICT');
    if(!expense&&gasto&&await readFresh('sisventas/gastos/'+gastoKey)!==null)throw fail(409,'El destino del gasto ya está ocupado','SV_CAS_CONFLICT');
   });
   if(Object.keys(patch).length)await scope.update(patch);return {ok:true,committed:true,gastoKey:gasto?gastoKey:null};
  });
 }
 return {authorize,execute};
}
module.exports={trustedCommand,ACTIONS,describe,kindOf,context,localDate,commissionState,buildExpense,applyAction,equivalent,resolveExpense,createEmployeeAccountCommands};