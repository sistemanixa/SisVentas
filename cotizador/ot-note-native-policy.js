'use strict';
// Server-only bridge for the existing atomic note wire. Root owns cohort admission.
const {digest}=require('./labor-guard'),Model=require('./ot-metadata-model'),Policy=require('./ot-metadata-policy'),Assigned=require('./ot-personal-scope');
const CONFIG='sv_ot_metadata_config';
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,fields)=>object(v)&&Reflect.ownKeys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const fail=(message,statusCode=409,code='SV_OT_NOTE_NATIVE_REVIEW')=>Object.assign(Error(message),{statusCode,code});
function requireValue(ok,message,statusCode,code){if(!ok)throw fail(message,statusCode,code);}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
async function prepare({actor,lease,body,patch,scope,now=Date.now}={}){
 const stamp=typeof now==='function'?now():now;
 requireValue(Number.isSafeInteger(stamp)&&stamp>0&&Number.isFinite(new Date(stamp).getTime()),'Falta la fecha del servidor.',503);
 requireValue(exact(body,['id','kind','path','value','expectedHashes'])&&key(body.id)&&body.id.length>=8&&body.kind==='atomic'&&body.path===''&&object(body.value)&&Object.keys(body.value).length===1,'La operación debe contener una única nota y sus comparaciones.',400);
 const notePath=Object.keys(body.value)[0],match=/^sisventas\/ordenes_trabajo\/([^/]+)\/notasTecnico\/([^/]+)$/.exec(notePath);
 requireValue(match&&key(match[1])&&key(match[2]),'La nota no tiene una referencia válida.',400);
 const [,otKey,noteKey]=match,parent='sisventas/ordenes_trabajo/'+otKey,idPath=parent+'/id',after=body.value[notePath];
 requireValue(exact(body.expectedHashes,[idPath,notePath])&&Object.values(body.expectedHashes).every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))&&exact(patch,[notePath])&&digest(patch)===digest(body.value),'La nota necesita exactamente el CAS de su identidad y su original.',400);
 const wireDigest=digest(body);
 requireValue(key(actor?.uid)&&actor.claims?.uid===actor.uid&&actor.mode==='user'&&!actor.viewing&&!actor.viewAs&&(!actor.realUid||actor.realUid===actor.uid)&&!actor.financialAction&&actor.opId===body.id&&actor.transportDigest===wireDigest&&digest(actor.input)===wireDigest,'La nota no corresponde a esta sesión.',403);
 requireValue(typeof scope?.getAsUser==='function'&&typeof scope.get==='function'&&typeof scope.beforeCommit==='function'&&typeof scope.query==='function'&&lease&&lease.actorUid===actor.uid&&lease.opId===body.id&&lease.digest===wireDigest&&key(lease.fence)&&lease.expiresAt>stamp&&digest(scope.lease)===digest(lease),'Falta el lease nativo vigente.',403);
 const identity={uid:actor.uid,claimsDigest:digest(actor.claims),opId:actor.opId,transportDigest:wireDigest,fence:lease.fence},reads=new Map(),queries=[];
 const read=async path=>{if(!reads.has(path))reads.set(path,structuredClone(await scope.get(path)));return structuredClone(reads.get(path));};
 async function access(reader){
  const profile=await reader('sv_chat_roles/'+identity.uid),cfg=key(profile?.rol)?await reader('sv_permisos/'+profile.rol):null,authority=Model.authority(profile,cfg,'note'),reset=await reader('sv_access_resets/'+identity.uid);
  requireValue(!actor.claims.svPasswordChangeRequired&&!reset?.required&&(reset?.version==null||reset.version===actor.claims.svAccessVersion),'Actualizá tu acceso antes de guardar.',403);
  const config=await reader(CONFIG);requireValue(config?.schema===1&&config.ready===true&&key(config.generation),'La metadata de OT no está preparada.',503);
  const directory=await reader('sv_chat_directorio/'+identity.uid),name=directory?.nombre||identity.uid;requireValue(typeof name==='string'&&name.trim(),'La autoría del servidor requiere revisión.',403);
  return{...authority,name,generation:config.generation};
 }
 async function assigned(ot,role,reader,query){
  if(!['tecnico','tecnico_vendedor'].includes(role))return;
  const binding=await reader('sv_empleado_uid/'+identity.uid),account=key(binding?.perfilFbKey)?await reader('sv_usuarios/'+binding.perfilFbKey):null;
  requireValue(account&&account.uid===identity.uid&&account.activo!==false&&key(account.empleadoFbKey),'El vínculo del técnico requiere revisión.',403);
  const employee=await reader('sisventas/empleados/'+account.empleadoFbKey),hasKey=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(field=>ot[field]!=null&&String(ot[field]).trim()),directory=!hasKey&&employee?.nombre?await query('sisventas/empleados','nombre',employee.nombre):{};
  requireValue(employee&&employee.activo!==false&&directory&&typeof directory==='object'&&Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory).map(([id,value])=>[id,{...value,fbKey:id}]))),'La OT no está asignada a tu cuenta.',403);
 }
 const ot=await scope.getAsUser(parent);
 requireValue(object(ot)&&!ot._svSummary&&!ot._svListSummary&&!ot._svPagedSummary,'Hace falta la OT original autorizada.');
 requireValue(typeof ot.id==='string'&&ot.id.trim()||typeof ot.id==='number'&&Number.isFinite(ot.id),'Falta la identidad original de la OT.');
 requireValue(ot.notasTecnico==null||typeof ot.notasTecnico==='object','El historial de notas requiere revisión.');
 const before=Object.hasOwn(ot.notasTecnico||{},noteKey)?ot.notasTecnico[noteKey]:null;
 requireValue(digest(ot.id)===body.expectedHashes[idPath]&&digest(before)===body.expectedHashes[notePath],'La nota o la identidad de la OT cambió.',409,'SV_CAS_CONFLICT');
 requireValue(before===null||object(before),'La nota original requiere revisión; no se reemplaza un valor histórico.');
 requireValue(ot.audit==null||Array.isArray(ot.audit),'La auditoría original requiere revisión.');
 const authority=await access(read);await assigned(ot,authority.role,read,async(...args)=>{const rows=await scope.query(...args);queries.push({args,rows:structuredClone(rows)});return rows;});
 if(after!==null){
  requireValue(object(after)&&typeof after.texto==='string'&&after.texto.trim()&&after.texto.length<=10000,'La nota necesita texto válido.',400);
  if(before===null){
   requireValue(Object.keys(after).every(k=>['texto','autor','rol','ts','_firebaseKey'].includes(k))&&(!Object.hasOwn(after,'autor')||after.autor===authority.name)&&(!Object.hasOwn(after,'rol')||after.rol===authority.role)&&(!Object.hasOwn(after,'_firebaseKey')||after._firebaseKey===noteKey)&&(!Object.hasOwn(after,'ts')||Number.isSafeInteger(after.ts)&&after.ts>0),'La autoría de una nota nueva no se toma del cliente.',403);
  }else{
   const previous=structuredClone(before),requested=structuredClone(after);delete previous.texto;delete requested.texto;
   requireValue(after.texto!==before.texto&&digest(previous)===digest(requested),'Editar una nota sólo permite cambiar su texto.',403);
  }
 }else requireValue(before!==null,'La nota ya no existe.');
 const modeled=Model.plan({ot,kind:'note',changes:{key:noteKey,note:after===null?null:{texto:after.texto}},actor:{uid:identity.uid,name:authority.name,role:authority.role},at:new Date(stamp).toISOString()}),relative='notasTecnico/'+noteKey;
 const canonicalNote=after===null?null:before===null?{...modeled.patch[relative],_firebaseKey:noteKey}:{...structuredClone(before),texto:modeled.patch[relative].texto};
 const planned=freeze({[notePath]:structuredClone(canonicalNote),[parent+'/audit']:structuredClone(modeled.patch.audit)});
 const capability=Policy.issue({uid:identity.uid,otKey,operationId:identity.opId,kind:'note',generation:authority.generation,role:authority.role,permissionRevision:authority.permissionRevision,permissionDigest:authority.permissionDigest});
 Object.assign(actor,{operation:'ot-metadata',role:authority.role,permissionRevision:authority.permissionRevision,permissionDigest:authority.permissionDigest,otMetadata:capability});
 scope.beforeCommit(async({readFresh,readFreshAsUser,queryFresh})=>{
  requireValue(typeof readFresh==='function'&&typeof readFreshAsUser==='function'&&typeof queryFresh==='function','Falta revalidar la nota con sus permisos nativos.',503);
  requireValue(actor.uid===identity.uid&&actor.opId===identity.opId&&actor.mode==='user'&&actor.operation==='ot-metadata'&&actor.otMetadata===capability&&!actor.financialAction&&!actor.viewing&&!actor.viewAs&&(!actor.realUid||actor.realUid===actor.uid)&&digest(actor.claims)===identity.claimsDigest&&actor.transportDigest===wireDigest&&digest(actor.input)===wireDigest&&digest(body)===wireDigest&&lease.fence===identity.fence&&Policy.token(actor,lease).svOTMetadataVersion===1,'La capacidad de la nota cambió.',403);
  const live=new Map(),freshRead=async path=>{if(!live.has(path))live.set(path,structuredClone(await readFresh(path)));return structuredClone(live.get(path));},current=await readFreshAsUser(parent);
  requireValue(digest(current)===digest(ot),'La OT cambió antes de confirmar la nota.',409,'SV_CAS_CONFLICT');
  const fresh=await access(freshRead);requireValue(digest(fresh)===digest(authority)&&actor.role===authority.role&&actor.permissionRevision===authority.permissionRevision&&actor.permissionDigest===authority.permissionDigest,'Los permisos o la autoría cambiaron.',409);
  Policy.validate(actor,await freshRead('sv_chat_roles/'+identity.uid),await freshRead('sv_permisos/'+authority.role));
  for(const [path,value]of reads)requireValue(digest(await freshRead(path))===digest(value),'La identidad, asignación o habilitación de la nota cambió.',409);
  const queryValues=new Map(),freshQuery=async(...args)=>{const id=JSON.stringify(args);if(!queryValues.has(id))queryValues.set(id,structuredClone(await queryFresh(...args)));return structuredClone(queryValues.get(id));};await assigned(current,fresh.role,freshRead,freshQuery);
  for(const entry of queries)requireValue(digest(await freshQuery(...entry.args))===digest(entry.rows),'La asignación del técnico cambió.',409);
 });
 // canonicalNote is response-only state. Never return it from Guard's receipt result.
 return Object.freeze({patch:planned,notePath,canonicalNote:freeze(structuredClone(canonicalNote))});
}
module.exports={prepare};
