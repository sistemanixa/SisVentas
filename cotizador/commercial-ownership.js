'use strict';
const reads=require('./domain-read-policy');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
// Las identidades siguen siendo ASCII; las claves de registros heredados admiten
// espacios y Unicode como Proyectos, sin permitir segmentos ni propiedades especiales.
const recordKey=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype','hasOwnProperty'].includes(v);
function linkedBudgetKey(value){
 if(!value||!['string','number','boolean'].includes(typeof value))return null;
 const id=String(value);
 return id&&Buffer.byteLength(id)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(id)&&!['__proto__','constructor','prototype','hasOwnProperty'].includes(id)?id:null;
}
const normalize=v=>String(v||'').trim().normalize('NFC').toLocaleLowerCase('es');
const role=v=>normalize(v).replace(/^administrador$/,'admin').replace(/^tecnico-vendedor$/,'tecnico_vendedor');
function moduleAllowed(r,m,permissions){
 if(!roles.includes(r))return false;
 const cfg=permissions?.[r];
 if(cfg)return cfg.indiceVersion===2&&cfg.indiceModulos?.[m]===true&&!Object.values(cfg.bloqueados||{}).includes(m);
 return !reads.restrictedDefaults[m]||reads.restrictedDefaults[m].includes(r);
}
function eligible(r,domain,permissions){return (domain==='ventas'?['venta','detalle']:['presupuesto']).some(m=>moduleAllowed(r,m,permissions));}
function validateCommercialActor(actor,profile,permissions){
 if(actor?.mode!=='user'||actor.commercialContext!==true||!['ventas','presupuestos'].includes(actor.domain)||!actor.uid||actor.claims?.uid!==actor.uid||actor.claims?.svPasswordChangeRequired===true||profile?.activo!==true||profile.rol!==actor.role||!roles.includes(actor.role))throw Object.assign(fail(403,'La sesión comercial cambió. Volvé a ingresar.'),{code:'SV_LABOR_AUTH_CHANGED'});
 if((permissions?.indiceRevision??null)!==(actor.permissionRevision??null)||require('./labor-guard').digest(permissions||{})!==actor.permissionDigest)throw Object.assign(fail(409,'Los permisos cambiaron. Volvé a revisar la operación.'),{code:'SV_LABOR_AUTH_CHANGED'});
 if(!moduleAllowed(actor.role,actor.domain==='ventas'?'venta':'presupuesto',{[actor.role]:permissions})||actor.operation==='commercial-assign'&&actor.role!=='admin')throw fail(403,'El módulo de ventas ya no está habilitado para esta operación');
}
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
 const sourceKey=domain==='ventas'?linkedBudgetKey(record.presupuestoFbKey):null,source=sourceKey?budgets?.[sourceKey]:null;
 const candidate=source||record;
 const created=Object.values(candidate.audit||{}).find(a=>/^(?:presupuesto\s+creado|venta\s+(?:adicional\s+)?creada|creado\b)/i.test(a.accion||'')&&a.usuario);
 return {name:String(candidate.creadorOriginalNombre||created?.usuario||candidate.creadaPor||candidate.creadoPor||candidate.usuario||candidate.empleado||'Sin registrar'),uid:candidate.creadorOriginalUid||candidate.creadaPorUid||candidate.creadoPorUid||candidate.empleadoUid||''};
}
function historicalConversionAudit(record,budgets){
 if(Object.values(record.audit||{}).some(e=>e.tipo==='conversion_presupuesto_venta'))return null;
 const sourceKey=linkedBudgetKey(record.presupuestoFbKey),source=sourceKey?budgets?.[sourceKey]:null;if(!source)return null;
 const events=Object.values(source.audit||{}).filter(e=>e.usuario&&e.fecha&&(/Cliente considerado visto y aceptado al convertir a venta/i.test(e.accion||'')||e.tipo==='conversion_presupuesto_venta'));
 if(events.length!==1)return null;
 const event=events[0],author=originalAuthor(record,'ventas',budgets);
 return {tipo:'conversion_presupuesto_venta',fecha:event.fecha,usuario:event.usuario,accion:'Conversión histórica de '+(source.id||'presupuesto de origen')+' a '+(record.id||'venta')+' · Creador original: '+author.name+' · Según auditoría del presupuesto',referenciaHistorica:true};
}
function createCommercialOwnership({auth,db,enabled=false,now=Date.now,collectionReader,commercialProtocol=false,publicTransport}){
 // Instantánea privada, de un solo uso dentro de la petición que autorizó al actor.
 // No es una caché entre consultas: cada authorize vuelve a verificar Auth y roles.
 if(commercialProtocol===true&&(!publicTransport?.projectRecord||!publicTransport?.list))throw TypeError('Falta la proyección comercial protegida');
 const requestContexts=new WeakMap();
 const read=async p=>(await db.ref(p).get()).val();
 const readCollection=(p,conditional)=>conditional&&collectionReader&&typeof collectionReader.read==='function'&&['sisventas/ventas','sisventas/presupuestos'].includes(p)
  ?collectionReader.read(p):read(p);
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
  if(commercialProtocol===true&&!require('./commercial-view-protocol').active(await read('sv_labor_config')))throw Object.assign(fail(503,'El circuito comercial protegido todavía no está habilitado'),{code:'SV_COMMERCIAL_PROTOCOL_OFF'});
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
 async function linkedBudgets(records){
  const ids=[...new Set(Object.values(records||{}).map(record=>linkedBudgetKey(record?.presupuestoFbKey)).filter(Boolean))],budgets=Object.create(null);
  let cursor=0,failed=false,failure;
  await Promise.all(Array.from({length:Math.min(6,ids.length)},async()=>{
   while(!failed&&cursor<ids.length){
    const id=ids[cursor++];
    try{budgets[id]=await read('sisventas/presupuestos/'+id);}
    catch(error){if(!failed){failed=true;failure=error;}}
   }
  }));
  if(failed)throw failure;return budgets;
 }
 async function recordsContext(domain,authorizedContext,useCollectionReader=false){
  const results=await Promise.allSettled([authorizedContext||context(),readCollection('sisventas/'+domain,useCollectionReader)]);
  const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  const [c,records]=results.map(result=>result.value),budgets=domain==='ventas'?await linkedBudgets(records):null;
  return {c,records:records||{},budgets};
 }
 function recordOwner(r,domain,c,budgets){if(Object.hasOwn(r,'responsableUid'))return owner(r,domain,c.people);const sourceKey=domain==='ventas'?linkedBudgetKey(r.presupuestoFbKey):null,source=sourceKey?budgets?.[sourceKey]:null;return owner(source||r,source?'presupuestos':domain,c.people);}
 async function list(actor){const authorizedContext=requestContexts.get(actor);requestContexts.delete(actor);const {c,records,budgets}=await recordsContext(actor.domain,authorizedContext,true);const result={};for(const [id,r]of Object.entries(records)){const uid=recordOwner(r,actor.domain,c,budgets);if(actor.role==='admin'||uid===actor.uid){result[id]={...r,_svOwnerUid:uid||'',_svOriginalAuthor:originalAuthor(r,actor.domain,budgets)};const event=actor.domain==='ventas'?historicalConversionAudit(r,budgets):null;if(event)result[id]._svConversionAudit=event;}}return {records:commercialProtocol===true?await publicTransport.list(actor,actor.domain,result):result};}
 async function options(actor){if(actor.role!=='admin'||actor.viewing)throw fail(403,'Solo el administrador puede reasignar');const c=await context();return {users:c.people.filter(p=>eligible(p.role,actor.domain,c.permissions)).map(p=>({uid:p.uid,nombre:p.name,rol:p.role})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'))};}
 async function mutate(actor,body,assign){
  // Preparar consume una sola vez la instantánea de esta misma petición,
  // obtenida por authorize. Otra operación requiere un contexto fresco;
  // reasignar conserva su revalidación propia y nunca utiliza esta instantánea.
  const authorizedContext=!assign?requestContexts.get(actor):null;if(!assign)requestContexts.delete(actor);
  if(actor.viewing)throw fail(403,'Volvé a tu cuenta para modificar el responsable');
  if(assign&&actor.role!=='admin')throw fail(403,'Solo el administrador puede reasignar');
  if(!key(body?.id))throw fail(400,'Registro inválido');
  const c=authorizedContext||await context(),budgets=actor.domain==='ventas'?Object.create(null):null;let target;
  if(assign){target=c.people.find(p=>p.uid===body.uid);if(!target||!eligible(target.role,actor.domain,c.permissions))throw fail(403,'La persona ya no tiene habilitado este módulo');}
  const ref=db.ref('sisventas/'+actor.domain+'/'+body.id),stamp=now(),authorDirectory=new Map();let error,listener,initial;
  try{
   await new Promise((resolve,reject)=>{listener=snapshot=>{initial=snapshot.val();resolve();};ref.on('value',listener,reject);});
   if(budgets)Object.assign(budgets,await linkedBudgets([initial]));
   if(actor.domain==='ventas'&&actor.role==='admin'&&initial&&(assign||!initial.responsableUid)&&!Object.hasOwn(initial,'creadorOriginalUid')){
    const source=originalAuthor(initial,actor.domain,budgets),matches=c.people.filter(p=>p.aliases.includes(normalize(source.name))),authorUid=source.uid||(matches.length===1?matches[0].uid:null);
    if(key(authorUid))authorDirectory.set(authorUid,await read('sv_chat_directorio/'+authorUid));
   }
   for(let attempt=0;attempt<3;attempt++){
   let missingSource,missingAuthor,authorReview=false;
   const result=await ref.transaction(current=>{
    try{
     error=null;missingSource=null;missingAuthor=null;authorReview=false;if(!current)throw fail(404,'Registro no disponible');
     const sourceKey=actor.domain==='ventas'?linkedBudgetKey(current.presupuestoFbKey):null;
     // Si cambió la referencia durante la preparación, no decidir propiedad
     // ni autoría con otro presupuesto. Cargar esa ficha y revalidar el mismo
     // registro en una transacción nueva, con un límite por solicitud.
     if(sourceKey&&!Object.hasOwn(budgets,sourceKey)){missingSource=sourceKey;return;}
     const currentOwner=recordOwner(current,actor.domain,c,budgets);
     if(!assign){if(actor.role!=='admin'&&currentOwner!==actor.uid)throw fail(403,'Este registro no está asignado a tu cuenta');if(current.responsableUid)return current;if(actor.domain==='ventas'&&actor.role!=='admin')throw fail(403,'Un administrador debe vincular el responsable de este registro histórico antes de editarlo');target=c.people.find(p=>p.uid===currentOwner);if(!target)return current;}
     if(assign&&(Number(body.revision||0)!==Number(current.responsableRevision||0)||String(body.owner||'')!==String(current.responsableUid||'')))throw fail(409,'Cambió el responsable. Actualizá antes de reasignar');
     if(current.responsableUid===target.uid)return current;
     const source=originalAuthor(current,actor.domain,budgets),matches=c.people.filter(p=>p.aliases.includes(normalize(source.name))),resolvedAuthor=source.uid||(matches.length===1?matches[0].uid:null),authorUid=actor.domain==='ventas'&&!key(resolvedAuthor)?null:resolvedAuthor,canAddAuthor=actor.domain==='ventas'?!Object.hasOwn(current,'creadorOriginalUid'):!current.creadorOriginalUid;
     const original={};if(canAddAuthor&&authorUid){
      if(actor.domain!=='ventas'){original.creadorOriginalUid=authorUid;original.creadorOriginalNombre=source.name;}
      else{
       if(!authorDirectory.has(authorUid)){missingAuthor=authorUid;return;}
       const directoryName=authorDirectory.get(authorUid)?.nombre;
       if(typeof directoryName==='string'&&directoryName&&(current.creadorOriginalNombre===undefined||current.creadorOriginalNombre===directoryName)){
        original.creadorOriginalUid=authorUid;if(current.creadorOriginalNombre===undefined)original.creadorOriginalNombre=directoryName;
       }else authorReview=true;
      }
     }else if(actor.domain==='ventas'&&canAddAuthor&&(current.creadorOriginalNombre!==undefined||source.uid))authorReview=true;
     if((actor.domain==='ventas'?!Object.hasOwn(current,'creadoEn'):!current.creadoEn)&&Number.isFinite(current.ts))original.creadoEn=current.ts;
     const audit=Object.values(current.audit||{}).concat([{fecha:new Date(stamp).toISOString(),ts:stamp,usuario:actor.name,actorUid:actor.realUid,accion:assign?'Reasignación comercial':'Vinculación de identidad histórica',responsableAnterior:currentOwner||null,responsableNuevo:target.uid,...(authorReview?{autorOriginalPendiente:true}:{})}]);
     return {...current,...original,responsableUid:target.uid,responsableNombre:target.name,responsableRol:target.role,responsableRevision:Number(current.responsableRevision||0)+1,responsableActualizadoEn:stamp,audit};
    }catch(e){error=e;return;}
   },undefined,false);
   if(missingSource){if(attempt===2)throw fail(409,'Cambió el presupuesto de origen. Actualizá el registro');Object.assign(budgets,await linkedBudgets([{presupuestoFbKey:missingSource}]));continue;}
   if(missingAuthor){if(attempt===2)throw fail(409,'Cambió la autoría original. Actualizá el registro');authorDirectory.set(missingAuthor,await read('sv_chat_directorio/'+missingAuthor));continue;}
   if(error)throw error;if(!result.committed)throw fail(409,'No se pudo confirmar. Actualizá el registro');return {record:commercialProtocol===true?await publicTransport.projectRecord(actor,actor.domain,body.id,result.snapshot.val(),{issue:true}):result.snapshot.val(),...(authorReview?{warnings:[{code:'SV_COMMERCIAL_AUTHOR_REVIEW',mensaje:'Se conservó la autoría histórica sin agregar una identidad que no coincide con el directorio.'}]}:{})};
   }
  }finally{if(listener)ref.off('value',listener);}
 }
 async function visibleRecords(actor,domain){const {c,records,budgets}=await recordsContext(domain);return Object.fromEntries(Object.entries(records).filter(([,r])=>actor.role==='admin'||recordOwner(r,domain,c,budgets)===actor.uid));}
 async function authorizedRecord(actor,domain,record,c){
  if(!record||typeof record!=='object'||Array.isArray(record))throw fail(404,'Registro no disponible');
  const budgets=Object.create(null),source=linkedBudgetKey(record.presupuestoFbKey);
  if(actor.role!=='admin'&&domain==='ventas'&&!Object.hasOwn(record,'responsableUid')&&source)budgets[source]=await read('sisventas/presupuestos/'+source);
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
 function fiscalAllowed(actor,cfg,identity){
  const action=cfg?.acciones?.facturas?.verEmitidas;
  if(actor.viewing||actor.realUid!==actor.uid||actor.claims?.uid!==actor.uid||actor.claims?.svPasswordChangeRequired===true||identity?.activo!==true||identity.rol!==actor.role||!moduleAllowed(actor.role,'facturas',{[actor.role]:cfg})||!(action===true||action===undefined&&actor.role==='admin'))throw Object.assign(fail(403,'No tenés permiso para ver esta factura.'),{code:'SV_FISCAL_FORBIDDEN'});
 }
 async function fiscalDocument(actor,id,selector){
  const c=requestContexts.get(actor);requestContexts.delete(actor);
  if(!c||actor.domain!=='ventas'||!recordKey(id))throw Object.assign(fail(403,'Acceso fiscal no autorizado.'),{code:'SV_FISCAL_FORBIDDEN'});
  const documents=require('./commercial-fiscal-document');documents.reference(selector?.kind,selector?.reference);
  fiscalAllowed(actor,c.permissions[actor.role],c.identities[actor.uid]);
  const record=await read('sisventas/ventas/'+id);
  // Verificación final de identidad, permiso y responsable, sin leer historial.
  const [identity,permissions,currentOwner]=await Promise.all([read('sv_chat_roles/'+actor.uid),read('sv_permisos/'+actor.role),actor.role==='admin'?Promise.resolve(null):read('sisventas/ventas/'+id+'/responsableUid')]);
  fiscalAllowed(actor,permissions,identity);
  if(actor.role!=='admin'&&(currentOwner!==null&&currentOwner!==actor.uid||currentOwner===null&&Object.hasOwn(record||{},'responsableUid')))throw fail(404,'Registro no disponible');
  await authorizedRecord(actor,'ventas',record,c);
  return documents.selectDocument(record,selector);
 }
 async function detail(actor,id){if(commercialProtocol!==true)throw fail(503,'El detalle comercial protegido todavía no está habilitado');const raw=await assertRecord(actor,actor.domain,id);return {record:await publicTransport.projectRecord(actor,actor.domain,id,raw)};}
 return {authorize,fiscalDocument,list,detail,options,assign:(a,b)=>mutate(a,b,true),prepare:(a,b)=>mutate(a,b,false),visibleRecords,assertRecord,visibleRecordsByIds};
}
module.exports={createCommercialOwnership,moduleAllowed,eligible,profiles,owner,originalAuthor,validateCommercialActor};
