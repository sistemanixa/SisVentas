'use strict';
const {isDeepStrictEqual}=require('node:util');
const {digest}=require('./labor-guard');
const Directory=require('./employee-directory');
const Views=require('./employee-account-view-model');
const BASE='sv_employee_account_views/v1/globalEmployeeDirectory';
const INTERNAL=new Set(['admin','administrativo','vendedor','tecnico','tecnico_vendedor']),EXTERNAL=new Set(['distribuidor','distribuidora','compras_paraguay','cliente','externo','external']);
const fail=(statusCode,message,code='SV_EMPLOYEE_HISTORY_INVALID')=>Object.assign(Error(message),{statusCode,code});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const key=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const text=(v,max=4000)=>typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
const nonce=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(v);
function shape(value,fields){if(!plain(value)||Object.keys(value).some(k=>!fields.includes(k))||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))throw fail(400,'Solicitud de legajo inválida');}
function reference(value){shape(value,['key','nombre','tipo']);if(!key(value.key)||!text(value.nombre,512)||!value.nombre||typeof value.tipo!=='string'||!/^(?:application\/pdf|image\/(?:jpeg|png|webp))$/i.test(value.tipo))throw fail(400,'Referencia de documento inválida');return structuredClone(value);}
function validate(body){
 shape(body,['id','employeeId','expectedRevision','action','activo','fecha','motivo','obs','adjuntos','documento']);
 if(!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!key(body.employeeId)||!nonce(body.expectedRevision)||!['status','attach'].includes(body.action))throw fail(400,'Solicitud de legajo inválida');
 if(Buffer.byteLength(JSON.stringify(body))>16000)throw fail(413,'El cambio de legajo supera el tamaño permitido');
 if(body.action==='status'){
  if(body.documento!==undefined||typeof body.activo!=='boolean'||typeof body.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)||!Number.isFinite(Date.parse(body.fecha+'T12:00:00Z'))||new Date(body.fecha+'T12:00:00Z').toISOString().slice(0,10)!==body.fecha||!text(body.motivo,1000)||!body.motivo.trim()||body.obs!==undefined&&!text(body.obs))throw fail(400,'Completá motivo, fecha y estado válidos');
  if(body.adjuntos!==undefined&&(!Array.isArray(body.adjuntos)||body.adjuntos.length>1||body.activo&&body.adjuntos.length))throw fail(400,'Referencia de documento inválida');for(const ref of body.adjuntos||[])reference(ref);
 }else{if(['activo','fecha','motivo','obs','adjuntos'].some(k=>Object.hasOwn(body,k)))throw fail(400,'La acción sólo permite adjuntar un documento');reference(body.documento);}
 return body;
}
function copiedHistory(raw){if(raw==null)return [];if(!Array.isArray(raw)&&!plain(raw))throw fail(409,'El historial del empleado requiere revisión','SV_EMPLOYEE_HISTORY_REVIEW');return structuredClone(raw);}
function historyEntries(history){return Object.entries(history).filter(([,row])=>plain(row));}
function appendReference(row,document,id){const value=structuredClone(row);if(value.adjunto?.key===document.key||Object.values(value.adjuntos||{}).some(ref=>ref?.key===document.key))throw fail(409,'El documento ya está vinculado al legajo','SV_EMPLOYEE_DOCUMENT_EXISTS');if(value.adjuntos==null)value.adjuntos=[];else if(!Array.isArray(value.adjuntos)&&!plain(value.adjuntos))throw fail(409,'Los adjuntos anteriores requieren revisión','SV_EMPLOYEE_HISTORY_REVIEW');if(Array.isArray(value.adjuntos))value.adjuntos.push(document);else{const k='documento_'+id;if(Object.hasOwn(value.adjuntos,k))throw fail(409,'La referencia del documento ya está ocupada');Object.defineProperty(value.adjuntos,k,{value:document,enumerable:true,writable:true,configurable:true});}return value;}
function planHistory(employee,body,{usuario,ts,documents=[]}){
 if(!plain(employee))throw fail(404,'El empleado ya no está disponible');const history=copiedHistory(employee.historial),patch={};
 if(body.action==='status'){
  if((employee.activo!==false)===body.activo)throw fail(409,'El estado del empleado cambió. Volvé a abrir el legajo.','SV_CAS_CONFLICT');
  const event={tipo:body.activo?'alta':'baja',motivo:body.motivo,fecha:body.fecha,obs:body.obs||'',usuario,ts};if(documents.length)event.adjuntos=documents;
  if(Array.isArray(history))history.push(event);else{const id='estado_'+body.id;if(Object.hasOwn(history,id))throw fail(409,'La referencia del evento ya está ocupada');Object.defineProperty(history,id,{value:event,enumerable:true,writable:true,configurable:true});}patch.activo=body.activo;
 }else{
  if(employee.activo!==false)throw fail(409,'El empleado ya no está dado de baja. Volvé a abrir el legajo.','SV_CAS_CONFLICT');
  const rows=historyEntries(history).filter(([,row])=>row.tipo==='baja').sort((a,b)=>String(b[1].fecha||'').localeCompare(String(a[1].fecha||''))||(Number(b[1].ts)||0)-(Number(a[1].ts)||0));
  if(!rows.length)throw fail(409,'El empleado no tiene una baja registrada','SV_EMPLOYEE_HISTORY_REVIEW');const [id,row]=rows[0];history[id]=appendReference(row,documents[0],body.id);
 }
 patch.historial=history;return patch;
}
function createEmployeeDirectoryCommands({authorize,db,guard,now=Date.now}){
 if(typeof authorize!=='function'||!db?.ref||!guard?.run)throw TypeError('Falta el circuito seguro del legajo');
 async function authorizeRequest(req){if(req.method!=='POST')throw fail(405,'Método no permitido');const q=new URL(req.url,'http://localhost').searchParams;if(q.has('verComo')||q.has('viewProfile'))throw fail(403,'Volvé a tu cuenta para modificar el legajo');return authorize(req);}
 async function access(read,actor,body){
  const profile=await read('sv_chat_roles/'+actor.uid),role=profile?.rol;if(profile?.activo!==true||!key(role)||EXTERNAL.has(role))throw fail(403,'No tenés permiso para modificar empleados','SV_EMPLOYEE_HISTORY_FORBIDDEN');const cfg=await read('sv_permisos/'+role),reset=await read('sv_access_resets/'+actor.uid);
  if(profile?.activo!==true||!key(role)||EXTERNAL.has(role)||!INTERNAL.has(role)&&(!plain(cfg)||cfg.indiceVersion!==2||!plain(cfg.indiceModulos))||!Directory.moduleAllowed(cfg,'empleados',role))throw fail(403,'No tenés permiso para modificar empleados','SV_EMPLOYEE_HISTORY_FORBIDDEN');
  const actions=cfg?.acciones,section=actions?.empleados,override=section?.editar;if(cfg!=null&&(actions!==undefined&&!plain(actions)||section!==undefined&&!plain(section))||(typeof override==='boolean'?!override:override!==undefined&&override!==null||!['admin','administrativo'].includes(role)))throw fail(403,'No tenés permiso para modificar empleados','SV_EMPLOYEE_HISTORY_FORBIDDEN');
  if(actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail(403,'Actualizá tu acceso y volvé a ingresar','SV_EMPLOYEE_HISTORY_FORBIDDEN');
  if((body.action==='attach'||body.adjuntos?.length)&&role!=='admin')throw fail(403,'Sólo administración puede adjuntar documentos de RR. HH.','SV_EMPLOYEE_HISTORY_FORBIDDEN');
  return {role,cfg,profile,fingerprint:digest({profile,cfg,reset}),name:profile.nombre||actor.claims.name||actor.uid};
 }
 async function execute(actor,body){
  if(!key(actor?.uid)||actor.uid.length>128||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');validate(body);
  const captured=await access(async p=>(await db.ref(p).get()).val(),actor,body),rowPath=BASE+'/rows/'+body.employeeId,rawPath='sisventas/empleados/'+body.employeeId;
  return guard.run({uid:actor.uid,claims:actor.claims,mode:'user',role:captured.role,opId:body.id,transportDigest:digest(body),operation:'employee-history-'+body.action,input:body},async scope=>{
   if(typeof scope.getAsUser!=='function'||typeof scope.beforeCommit!=='function')throw fail(503,'El legajo necesita completar su actualización');
   const checked=await access(p=>scope.get(p),actor,body);if(checked.fingerprint!==captured.fingerprint)throw fail(409,'Los permisos cambiaron. Volvé a revisar el legajo.','SV_LABOR_AUTH_CHANGED');
   const row=await scope.getAsUser(rowPath);if(row?.meta?.schema!==1||row.meta.ready!==true||!nonce(row.meta.revision))throw fail(503,'El legajo necesita completar su preparación','SV_EMPLOYEE_DIRECTORY_UNREADY');if(row.meta.revision!==body.expectedRevision)throw fail(409,'El legajo cambió. Volvé a abrirlo.','SV_CAS_CONFLICT');
   const raw=await scope.get(rawPath),projected=Views.projectEmployee(raw,{key:body.employeeId});if(!projected.complete||!isDeepStrictEqual(projected.value,row.value))throw fail(409,'El legajo y su vista requieren revisión','SV_EMPLOYEE_DIRECTORY_REVIEW');
   const documents=[];for(const ref of body.action==='attach'?[body.documento]:body.adjuntos||[]){const path='sv_rrhh_adjuntos/'+body.employeeId+'/'+ref.key,nombre=await scope.getAsUser(path+'/nombre'),tipo=await scope.getAsUser(path+'/tipo');if(nombre!==ref.nombre||tipo!==ref.tipo)throw fail(409,'El documento cambió o ya no está disponible','SV_EMPLOYEE_DOCUMENT_REVIEW');documents.push(reference(ref));}
   const ts=now();if(!Number.isSafeInteger(ts)||ts<0)throw fail(503,'No se pudo fechar el cambio de legajo');const name=text(checked.name,512)&&checked.name?checked.name:actor.uid,changes=planHistory(raw,body,{usuario:name,ts,documents}),patch={};for(const [field,value]of Object.entries(changes))patch[rawPath+'/'+field]=value;
   scope.beforeCommit(async fresh=>{const current=await access(p=>fresh.readFresh(p),actor,body);if(current.fingerprint!==captured.fingerprint)throw fail(409,'Los permisos cambiaron. Volvé a revisar el legajo.','SV_LABOR_AUTH_CHANGED');for(const ref of documents){const path='sv_rrhh_adjuntos/'+body.employeeId+'/'+ref.key;if(await fresh.readFreshAsUser(path+'/nombre')!==ref.nombre||await fresh.readFreshAsUser(path+'/tipo')!==ref.tipo)throw fail(409,'El documento cambió. Volvé a revisar el legajo.','SV_EMPLOYEE_DOCUMENT_REVIEW');}const currentRow=await fresh.readFreshAsUser(rowPath);if(currentRow?.meta?.schema!==1||currentRow?.meta?.revision!==body.expectedRevision||currentRow?.meta?.ready!==true||digest(await fresh.readFresh(rawPath))!==digest(raw))throw fail(409,'El legajo cambió. Volvé a abrirlo.','SV_CAS_CONFLICT');});
   await scope.update(patch);return {ok:true,committed:true,employeeId:body.employeeId,action:body.action};
  });
 }
 return {authorize:authorizeRequest,execute};
}
module.exports={BASE,createEmployeeDirectoryCommands,validate,planHistory};
