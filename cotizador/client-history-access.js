'use strict';
const Domains=require('./domain-read-policy');
const Audience=require('./commercial-models/client-history-audience.v1.js');
const {moduleAllowed,owner}=require('./commercial-ownership');
const {assertAccessReady}=require('./user-access');
const {isDeepStrictEqual}=require('node:util');
const {digest}=require('./labor-guard');
const {key:recordKey}=require('./commercial-pages-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const historyActions={
 'ot.verTodas':{modulo:'ordentrabajo',roles:['admin','administrativo','vendedor','tecnico_vendedor']},
 'dashboard.metricasGlobales':{modulo:'dashboard',roles:['admin']},
 'dashboard.otsPendientes':{modulo:'dashboard',roles:['admin']}
};
function createClientHistoryAccess({auth,db,readAsUser}={}){
 const identities=new WeakMap();
 const assignmentProofs=new WeakMap();
 const read=async path=>(await db.ref(path).get()).val();
 async function authorize(req){
  const bearer=String(req?.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!bearer)throw fail(401,'Sesión requerida.');
  let claims;try{claims=await auth.verifyIdToken(bearer[1],true);}catch(_){throw fail(401,'Sesión inválida.');}
  if(!key(claims.uid))throw fail(403,'Identidad inválida.');
  await assertAccessReady(db,claims);
  if(req.viewing===true||req.headers?.['x-sv-view-as'])throw fail(403,'Historial no disponible en Ver como.');
  const profile=await read('sv_chat_roles/'+claims.uid);
  if(profile?.activo!==true||!Domains.internalRoles.includes(profile.rol))throw fail(403,'Acceso inactivo.');
  const role=profile.rol,config=await read('sv_permisos/'+role);
  if(!config||config.indiceVersion!==2||!config.indiceModulos||!Number.isSafeInteger(config.indiceRevision))throw fail(403,'Falta verificar los permisos actuales.');
  const modules=module=>moduleAllowed(role,module,{[role]:config});
  const actions=action=>{const rule=historyActions[action];if(!rule||!modules(rule.modulo))return false;const [group,...parts]=action.split('.'),nested=config.acciones?.[group]?.[parts.join('_')],flat=config.acciones?.[action];if(typeof nested==='boolean'&&typeof flat==='boolean'&&nested!==flat)return false;const value=typeof nested==='boolean'?nested:flat;return typeof value==='boolean'?value:rule.roles.includes(role);};
  const context={uid:claims.uid,authUid:claims.uid,role,active:true,viewing:false,passwordResetRequired:false,permissionRevision:config.indiceRevision,moduleAllowed:modules,actionAllowed:actions,financialHistoryAccess:{ventas:['venta','detalle','cobranzas'].some(modules),pagos:['venta','detalle','cobranzas'].some(modules),presupuestos:modules('presupuesto')},employee:null,employeeDirectory:null};
  if(Audience.plan(context,'ordenes_trabajo')?.originals==='assigned'){
   const records=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(claims.uid).get()).val()||{},matches=Object.entries(records).filter(([,record])=>record.uid===claims.uid);
   if(matches.length!==1||!recordKey(matches[0][0])||matches[0][1].activo===false||matches[0][1].rol!==role)throw fail(403,'Identidad de empleado ambigua.');
   const binding=await read('sv_empleado_uid/'+claims.uid);if(binding?.perfilFbKey!==matches[0][0])throw fail(403,'El vínculo de empleado no coincide con el perfil.');
   const links=[...new Set(['empleadoFbKey','empleadoId','empFbKey'].map(field=>matches[0][1][field]).filter(value=>value!=null&&value!=='').map(String))];
   if(links.length!==1||!recordKey(links[0]))throw fail(403,'Falta un vínculo inequívoco de empleado.');
   const fields=['activo','id','codigo','uid','estado','tipoBaja'],employee=Object.fromEntries(await Promise.all(fields.map(async field=>[field,await read('sisventas/empleados/'+links[0]+'/'+field)])));
   const identifiable=['uid','id','codigo'].some(field=>['string','number'].includes(typeof employee[field])&&String(employee[field]).trim()!=='');
   if(!identifiable||employee.activo===false||employee.uid&&employee.uid!==claims.uid||['inactivo','despedido','renuncia'].includes(String(employee.estado||'').toLowerCase())||employee.tipoBaja)throw fail(403,'Empleado no verificable.');
   context.employee={fbKey:links[0],id:employee.id,codigo:employee.codigo,activo:true};
   context.employeeDirectory=Object.freeze({[links[0]]:Object.freeze({...context.employee})});
   context.employeeDirectoryVerified=true;context.employeeDirectoryScope='key-only';
  }
  context.revision=digest({profile,config,employee:context.employee,employeeDirectoryScope:context.employeeDirectoryScope||null});
  Object.freeze(context.financialHistoryAccess);if(context.employee)Object.freeze(context.employee);identities.set(context,{claims,config:structuredClone(config)});return Object.freeze(context);
 }
 async function original(req,domain,id){
  const context=await authorize(req);return {context,record:await readOriginal(domain,id,context)};
 }
 async function readOriginal(domain,id,context){
  if(!recordKey(id))throw fail(400,'Referencia inválida.');const identity=identities.get(context);if(!identity)throw fail(403,'Contexto de historial no verificado.');
  await assertAccessReady(db,identity.claims);const profile=await read('sv_chat_roles/'+context.uid),config=await read('sv_permisos/'+context.role);
  if(profile?.activo!==true||profile.rol!==context.role||!isDeepStrictEqual(config,identity.config))throw fail(403,'Los permisos del historial cambiaron.');
  const plan=Audience.plan(context,domain);
  if(!plan||plan.originals==='none')throw fail(403,'Historial no autorizado.');
  if(typeof readAsUser!=='function')throw fail(503,'Falta la lectura autorizada del original.');
  const record=await readAsUser('sisventas/'+domain+'/'+id,{uid:context.uid,claims:identity.claims});
  if(!record||!Audience.allows(context,domain,{origin:'original',record,ownerUid:owner(record,domain,[])}))throw fail(404,'Registro no disponible.');
  return record;
 }
 const assignmentFields=['tecnicoFbKey','empleadoFbKey','tecnicoKey','tecnico','tecnicoNombre'];
 async function assignment(id){return Object.fromEntries(await Promise.all(assignmentFields.map(async field=>[field,await read('sisventas/ordenes_trabajo/'+id+'/'+field)])));}
 async function verifyContext(context){const identity=identities.get(context);if(!identity)throw fail(403,'Contexto de historial no verificado.');await assertAccessReady(db,identity.claims);const profile=await read('sv_chat_roles/'+context.uid),config=await read('sv_permisos/'+context.role);if(profile?.activo!==true||profile.rol!==context.role||!isDeepStrictEqual(config,identity.config))throw fail(403,'Los permisos del historial cambiaron.');return identity;}
 async function readHistoryOriginal(domain,id,context){
  if(domain!=='ordenes_trabajo'||!recordKey(id)||Audience.plan(context,domain)?.originals!=='assigned')throw fail(403,'La verificación de asignación no corresponde a esta consulta.');
  const identity=await verifyContext(context),metadata=await assignment(id);
  const field=assignmentFields.slice(0,3).find(name=>metadata[name]!=null&&metadata[name]!=='');
  if(!field||!['string','number'].includes(typeof metadata[field])||!String(metadata[field]).trim()||!recordKey(String(metadata[field]).trim()))throw fail(409,'Falta verificar la asignación original; no se confirmó un historial vacío.');
  const assigned=require('./ot-personal-scope').assigned(metadata,context.employee,context.employeeDirectory);
  let record=null;
  if(assigned){if(typeof readAsUser!=='function')throw fail(503,'Falta la lectura autorizada del original.');record=await readAsUser('sisventas/ordenes_trabajo/'+id,{uid:context.uid,claims:identity.claims});if(!record)throw fail(409,'Falta el original de la OT asignada.');for(const name of assignmentFields)if(!isDeepStrictEqual(record[name]??null,metadata[name]??null))throw fail(409,'La asignación cambió durante la lectura.');}
  const proof=Object.freeze({});assignmentProofs.set(proof,{id,metadata,uid:context.uid,revision:context.revision});
  return {status:assigned?'included':'excluded',reason:assigned?'assigned-self':'assigned-other',record,proof};
 }
 async function verifyHistoryOriginal(proof,context){await verifyContext(context);const saved=assignmentProofs.get(proof);if(!saved||saved.uid!==context.uid||saved.revision!==context.revision)throw fail(403,'Prueba de asignación no verificada.');if(!isDeepStrictEqual(await assignment(saved.id),saved.metadata))throw fail(409,'La asignación cambió al completar el historial.');return true;}
 async function readClient(clientKey,context){if(!recordKey(clientKey))throw fail(400,'Cliente inválido.');const identity=await verifyContext(context);if(!Domains.allows('clientes',context.role,context.moduleAllowed,context.actionAllowed))throw fail(403,'Cliente no autorizado.');if(typeof readAsUser!=='function')throw fail(503,'Falta la lectura autorizada del cliente.');const record=await readAsUser('sisventas/clientes/'+clientKey,{uid:context.uid,claims:identity.claims});if(!record)throw fail(404,'Cliente no disponible.');return record;}
 return Object.freeze({authorize,readOriginal,original,readHistoryOriginal,verifyHistoryOriginal,readClient});
}
module.exports={create:createClientHistoryAccess,createClientHistoryAccess};
