'use strict';
const reads=require('./domain-read-policy');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
// Las identidades siguen siendo ASCII; las claves de registros heredados admiten
// espacios y Unicode como Proyectos, sin permitir segmentos ni propiedades especiales.
const recordKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype','hasOwnProperty'].includes(v);
const normalize=v=>String(v||'').trim().normalize('NFC').toLocaleLowerCase('es');
const role=v=>normalize(v).replace(/^administrador$/,'admin').replace(/^tecnico-vendedor$/,'tecnico_vendedor');
function moduleAllowed(r,m,permissions){
 if(!roles.includes(r))return false;
 const cfg=permissions?.[r];
 if(cfg)return cfg.indiceVersion===2&&cfg.indiceModulos?.[m]===true&&!Object.values(cfg.bloqueados||{}).includes(m);
 return !reads.restrictedDefaults[m]||reads.restrictedDefaults[m].includes(r);
}
function eligible(r,domain,permissions){return (domain==='ventas'?['venta','detalle']:['presupuesto']).some(m=>moduleAllowed(r,m,permissions));}
function profiles(users,identities){
 const counts={};for(const u of Object.values(users||{}))if(key(u.uid))counts[u.uid]=(counts[u.uid]||0)+1;
 return Object.entries(users||{}).filter(([,u])=>counts[u.uid]===1&&u.activo!==false&&identities?.[u.uid]?.activo===true&&role(u.rol)===identities[u.uid].rol&&roles.includes(identities[u.uid].rol)).map(([id,u])=>({uid:u.uid,id,name:String(u.nombre||u.login||'Usuario').slice(0,160),role:identities[u.uid].rol,aliases:[u.nombre,u.login,u.email,u.mail,u.empleadoFbKey,u.empleadoId,u.empFbKey].filter(Boolean).map(normalize)}));
}
function owner(record,domain,people){
 if(!record)return null;
 if(Object.hasOwn(record,'responsableUid'))return key(record.responsableUid)?record.responsableUid:null;
 const explicit=['creadaPorUid','creadoPorUid','usuarioUid','empleadoUid'].map(k=>record[k]).filter(Boolean);
 if(explicit.length){const unique=[...new Set(explicit)];return unique.length===1&&key(unique[0])?unique[0]:null;}
 // Un comisionado o vendedor no prueba autoría. No usar empleado/vendedor de ventas.
 const names=(domain==='ventas'?[record.creadaPor,record.creadoPor,record.createdBy,record.usuario]:[record.creadoPor,record.usuario,record.empleado]).filter(Boolean).map(normalize);
 if(!names.length)return null;
 const matches=new Set();for(const name of names){const found=people.filter(p=>p.aliases.includes(name));if(found.length!==1)return null;matches.add(found[0].uid);}
 return matches.size===1?[...matches][0]:null;
}
function originalAuthor(record,domain,budgets){
 const source=domain==='ventas'&&record.presupuestoFbKey?budgets?.[record.presupuestoFbKey]:null;
 const candidate=source||record;
 const created=Object.values(candidate.audit||{}).find(a=>/^(?:presupuesto\s+creado|venta\s+(?:adicional\s+)?creada|creado\b)/i.test(a.accion||'')&&a.usuario);
 return {name:String(candidate.creadorOriginalNombre||created?.usuario||candidate.creadaPor||candidate.creadoPor||candidate.usuario||candidate.empleado||'Sin registrar'),uid:candidate.creadorOriginalUid||candidate.creadaPorUid||candidate.creadoPorUid||candidate.empleadoUid||''};
}
function historicalConversionAudit(record,budgets){
 if(Object.values(record.audit||{}).some(e=>e.tipo==='conversion_presupuesto_venta'))return null;
 const source=budgets?.[record.presupuestoFbKey];if(!source)return null;
 const events=Object.values(source.audit||{}).filter(e=>e.usuario&&e.fecha&&(/Cliente considerado visto y aceptado al convertir a venta/i.test(e.accion||'')||e.tipo==='conversion_presupuesto_venta'));
 if(events.length!==1)return null;
 const event=events[0],author=originalAuthor(record,'ventas',budgets);
 return {tipo:'conversion_presupuesto_venta',fecha:event.fecha,usuario:event.usuario,accion:'Conversión histórica de '+(source.id||'presupuesto de origen')+' a '+(record.id||'venta')+' · Creador original: '+author.name+' · Según auditoría del presupuesto',referenciaHistorica:true};
}
function createCommercialOwnership({auth,db,enabled=false,now=Date.now}){
 // Instantánea privada, de un solo uso dentro de la petición que autorizó al actor.
 // No es una caché entre consultas: cada authorize vuelve a verificar Auth y roles.
 const requestContexts=new WeakMap();
 const read=async p=>(await db.ref(p).get()).val();
 async function context(){
  const results=await Promise.allSettled([read('sv_usuarios'),read('sv_chat_roles'),read('sv_permisos')]);
  const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  const [users,identities,permissions]=results.map(result=>result.value);
  return {people:profiles(users,identities),identities:identities||{},permissions:permissions||{}};
 }
 async function authorize(req,domain,viewUid){
  if(!['ventas','presupuestos'].includes(domain))throw fail(404,'Módulo no disponible');
  const token=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!token)throw fail(401,'Sesión requerida');
  let u;try{u=await auth.verifyIdToken(token[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  if(!enabled)throw fail(503,'La privacidad comercial todavía no está habilitada');
  const c=await context(),own=c.identities[u.uid];if(!key(u.uid)||own?.activo!==true||!roles.includes(own.rol))throw fail(403,'Acceso inactivo');
  if(viewUid&&viewUid!==u.uid){if(own.rol!=='admin'||!key(viewUid))throw fail(403,'Contexto no autorizado');}
  const uid=viewUid||u.uid,identity=c.identities[uid],person=c.people.find(p=>p.uid===uid);
  if(identity?.activo!==true||!person)throw fail(403,'La cuenta requiere revisión de identidad');
  const canRead=reads.allows(domain,identity.rol,m=>moduleAllowed(identity.rol,m,c.permissions),a=>{
   const [group,name]=a.split('.'),v=c.permissions[identity.rol]?.acciones?.[group]?.[name];return typeof v==='boolean'?v:identity.rol==='admin';
  });
  if(!canRead)throw fail(403,'Módulo no habilitado para este rol');
  const actor={uid,realUid:u.uid,role:identity.rol,name:person.name,domain,viewing:uid!==u.uid};
  Object.defineProperty(actor,'claims',{value:u});
  Object.defineProperty(actor,'permissionRevision',{value:c.permissions[identity.rol]?.indiceRevision??null});
  Object.defineProperty(actor,'permissionDigest',{value:require('./labor-guard').digest(c.permissions[identity.rol]||{})});
  requestContexts.set(actor,c);return actor;
 }
 async function recordsContext(domain,authorizedContext){const [c,records,budgets]=await Promise.all([authorizedContext||context(),read('sisventas/'+domain),domain==='ventas'?read('sisventas/presupuestos'):Promise.resolve(null)]);return {c,records:records||{},budgets};}
 function recordOwner(r,domain,c,budgets){if(Object.hasOwn(r,'responsableUid'))return owner(r,domain,c.people);const source=domain==='ventas'&&r.presupuestoFbKey?budgets?.[r.presupuestoFbKey]:null;return owner(source||r,source?'presupuestos':domain,c.people);}
 async function list(actor){const authorizedContext=requestContexts.get(actor);requestContexts.delete(actor);const {c,records,budgets}=await recordsContext(actor.domain,authorizedContext);const result={};for(const [id,r]of Object.entries(records)){const uid=recordOwner(r,actor.domain,c,budgets);if(actor.role==='admin'||uid===actor.uid){result[id]={...r,_svOwnerUid:uid||'',_svOriginalAuthor:originalAuthor(r,actor.domain,budgets)};const event=actor.domain==='ventas'?historicalConversionAudit(r,budgets):null;if(event)result[id]._svConversionAudit=event;}}return {records:result};}
 async function options(actor){if(actor.role!=='admin'||actor.viewing)throw fail(403,'Solo el administrador puede reasignar');const c=await context();return {users:c.people.filter(p=>eligible(p.role,actor.domain,c.permissions)).map(p=>({uid:p.uid,nombre:p.name,rol:p.role})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))};}
 async function mutate(actor,body,assign){
  if(actor.viewing)throw fail(403,'Volvé a tu cuenta para modificar el responsable');
  if(assign&&actor.role!=='admin')throw fail(403,'Solo el administrador puede reasignar');
  if(!key(body?.id))throw fail(400,'Registro inválido');
  const c=await context(),budgets=actor.domain==='ventas'?await read('sisventas/presupuestos'):null;let target;
  if(assign){target=c.people.find(p=>p.uid===body.uid);if(!target||!eligible(target.role,actor.domain,c.permissions))throw fail(403,'La persona ya no tiene habilitado este módulo');}
  const ref=db.ref('sisventas/'+actor.domain+'/'+body.id),stamp=now();let error,listener;
  try{
   await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
   const result=await ref.transaction(current=>{
    try{
     error=null;if(!current)throw fail(404,'Registro no disponible');
     const currentOwner=recordOwner(current,actor.domain,c,budgets);
     if(!assign){if(actor.role!=='admin'&&currentOwner!==actor.uid)throw fail(403,'Este registro no está asignado a tu cuenta');if(current.responsableUid)return current;target=c.people.find(p=>p.uid===currentOwner);if(!target)return current;}
     if(assign&&(Number(body.revision||0)!==Number(current.responsableRevision||0)||String(body.owner||'')!==String(current.responsableUid||'')))throw fail(409,'Cambió el responsable. Actualizá antes de reasignar');
     if(current.responsableUid===target.uid)return current;
     const audit=Object.values(current.audit||{}).concat([{fecha:new Date(stamp).toISOString(),ts:stamp,usuario:actor.name,actorUid:actor.realUid,accion:assign?'Reasignación comercial':'Vinculación de identidad histórica',responsableAnterior:currentOwner||null,responsableNuevo:target.uid}]);
     const source=originalAuthor(current,actor.domain,budgets),matches=c.people.filter(p=>p.aliases.includes(normalize(source.name))),authorUid=source.uid||(matches.length===1?matches[0].uid:null);
     const original={};if(!current.creadorOriginalUid&&authorUid){original.creadorOriginalUid=authorUid;original.creadorOriginalNombre=source.name;}if(!current.creadoEn&&Number.isFinite(current.ts))original.creadoEn=current.ts;
     return {...current,...original,responsableUid:target.uid,responsableNombre:target.name,responsableRol:target.role,responsableRevision:Number(current.responsableRevision||0)+1,responsableActualizadoEn:stamp,audit};
    }catch(e){error=e;return;}
   },undefined,false);
   if(error)throw error;if(!result.committed)throw fail(409,'No se pudo confirmar. Actualizá el registro');return {record:result.snapshot.val()};
  }finally{if(listener)ref.off('value',listener);}
 }
 async function visibleRecords(actor,domain){const {c,records,budgets}=await recordsContext(domain);return Object.fromEntries(Object.entries(records).filter(([,r])=>actor.role==='admin'||recordOwner(r,domain,c,budgets)===actor.uid));}
 async function authorizedRecord(actor,domain,record,c){
  if(!record||typeof record!=='object'||Array.isArray(record))throw fail(404,'Registro no disponible');
  const budgets=Object.create(null),source=record.presupuestoFbKey;
  if(actor.role!=='admin'&&domain==='ventas'&&!Object.hasOwn(record,'responsableUid')&&source&&['string','number','boolean'].includes(typeof source)){
   const reference=String(source);
   if(Buffer.byteLength(reference)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(reference))budgets[reference]=await read('sisventas/presupuestos/'+reference);
  }
  if(actor.role!=='admin'&&recordOwner(record,domain,c,budgets)!==actor.uid)throw fail(404,'Registro no disponible');
  return record;
 }
 async function assertRecord(actor,domain,id){
  if(!['ventas','presupuestos'].includes(domain)||!recordKey(id))throw fail(404,'Registro no disponible');
  // Comprobar una ficha no necesita construir todo el listado comercial.
  // El contexto se relee por operación; no se reutiliza una autorización vieja.
  const results=await Promise.allSettled([context(),read('sisventas/'+domain+'/'+id)]);
  const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  const [c,record]=results.map(result=>result.value);
  return authorizedRecord(actor,domain,record,c);
 }
 async function visibleRecordsByIds(actor,domain,ids){
  if(!['ventas','presupuestos'].includes(domain)||!Array.isArray(ids))throw fail(404,'Registros no disponibles');
  const selected=[...new Set(ids.filter(recordKey))],result=Object.create(null);
  if(!selected.length)return result;
  // Un contexto fresco para este conjunto exacto, nunca para otra operación.
  const c=await context();let cursor=0,error;
  await Promise.all(Array.from({length:Math.min(6,selected.length)},async()=>{
   while(!error&&cursor<selected.length){
    const id=selected[cursor++];
    try{result[id]=await authorizedRecord(actor,domain,await read('sisventas/'+domain+'/'+id),c);}
    catch(e){if(e.statusCode!==404)error=e;}
   }
  }));
  if(error)throw error;
  return result;
 }
 return {authorize,list,options,assign:(a,b)=>mutate(a,b,true),prepare:(a,b)=>mutate(a,b,false),visibleRecords,assertRecord,visibleRecordsByIds};
}
module.exports={createCommercialOwnership,moduleAllowed,eligible,profiles,owner,originalAuthor};
