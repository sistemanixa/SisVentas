'use strict';
const crypto=require('node:crypto'),Model=require('./projects-model'),isService=require('./ot-lifecycle-model').service;
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const commercial=roles.filter(r=>r!=='tecnico');
function createProjects({auth,db,enabled=false,collectionReader,scopedReads=false,queryReader,now=Date.now,uuid=crypto.randomUUID,storage,bucketName,listStore}){
 const read=async p=>(await db.ref(p).get()).val();
 async function authorize(req){
  const token=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!token)throw fail(401,'Sesión requerida');
  let user;try{user=await auth.verifyIdToken(token[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  Model.key(user.uid);const identity=await read('sv_chat_roles/'+user.uid);if(identity?.activo!==true||!roles.includes(identity.rol))throw fail(403,'Usuario sin acceso');
  if(!enabled)throw fail(503,'Proyectos todavía no está habilitado en el servidor');
  const [stored,ownName]=await Promise.all([read('sv_permisos/'+identity.rol),read('sv_chat_directorio/'+user.uid+'/nombre')]);
  const cfg=stored||{},blocked=Object.values(cfg.bloqueados||{}),mod=m=>stored?!blocked.includes(m):['clientes','presupuesto'].includes(m)?commercial.includes(identity.rol):true;
  if(!mod('proyectos'))throw fail(403,'Proyectos está bloqueado para tu rol');
  const action=(name,defaults)=>typeof cfg.acciones?.proyectos?.[name]==='boolean'?cfg.acciones.proyectos[name]:defaults.includes(identity.rol);
  return {uid:user.uid,name:String(ownName||'Usuario').slice(0,100),role:identity.rol,enabled:true,createAllowed:action('crear',commercial),editAllowed:action('editar',roles),quoteAllowed:commercial.includes(identity.rol)&&mod('presupuesto')&&action('presupuestar',commercial),clientAllowed:commercial.includes(identity.rol)&&mod('clientes')};
 }
 async function directory(){
  const [data,identities]=await Promise.all([read('sv_chat_directorio'),read('sv_chat_roles')]);
  return Object.entries(data||{}).filter(([uid,p])=>p.activo!==false&&identities?.[uid]?.activo===true&&roles.includes(identities[uid].rol)).map(([uid,p])=>({uid,name:String(p.nombre||'Usuario').slice(0,100),role:identities[uid].rol}));
 }
 function materialLines(items){
  const seen=new Map(),entries=Object.entries(items||{}),positional=Array.isArray(items)||entries.every(([key])=>/^\d+$/.test(key));
  return entries.map(([rowKey,i])=>{
   const identity=JSON.stringify([String(i.productoFbKey||i.productoId||''),String(i.cod||i.codigo||''),String(i.desc||i.descripcion||''),String(i.variante||i.variant||i.varianteId||''),String(i.unidad||i.unit||'')]),occurrence=seen.get(identity)||0;seen.set(identity,occurrence+1);
   const explicit=String(i.lineId||i.renglonId||i.itemLineId||(!positional?rowKey:'')),sourceIdentity=crypto.createHash('sha256').update(identity).digest('hex');
   return {lineId:crypto.createHash('sha256').update(JSON.stringify([explicit,sourceIdentity,explicit?'':occurrence])).digest('hex').slice(0,20),sourceIdentity,description:String(i.desc||i.descripcion||'').slice(0,200),qty:Number(i.qty??i.cantidad)||0,unitPrice:Number(i.punit)||0,code:String(i.cod||i.codigo||'').slice(0,80),productId:String(i.productoFbKey||'').slice(0,128),photo:typeof (i.imagenUrl||i.fotoUrl||i.imagen||i.img)==='string'&&/^https:\/\//.test(i.imagenUrl||i.fotoUrl||i.imagen||i.img)?(i.imagenUrl||i.fotoUrl||i.imagen||i.img).slice(0,2000):'',operational:!isService(i)};
  });
 }
 function budget(id,p){return {id,number:String(p.numero||p.id||id).slice(0,80),title:String(p.tituloSolucion||p.cliente||'Presupuesto').slice(0,160),clientId:String(p.clienteFbKey||p.clienteKey||p.clienteId||''),total:p.total!=null&&Number.isFinite(Number(p.total))?Number(p.total):null,currency:p.moneda==='USD'?'USD':'ARS',status:String(p.estado||'borrador').slice(0,40),items:materialLines(p.items)};}
 async function quotes(actor){if(!Model.commercial(actor))return [];const records=process.env.COMMERCIAL_OWNERSHIP_ENABLED==='true'?await require('./commercial-ownership').createCommercialOwnership({auth,db,enabled:true,collectionReader,scopedReads,queryReader}).list({...actor,domain:'presupuestos'}).then(result=>result.records):await read('sisventas/presupuestos')||{};return Object.entries(records).filter(([,p])=>!p.eliminado).map(([id,p])=>budget(id,p));}
 async function quoteRecord(actor,id){return process.env.COMMERCIAL_OWNERSHIP_ENABLED==='true'?require('./commercial-ownership').createCommercialOwnership({auth,db,enabled:true,scopedReads,queryReader}).assertRecord(actor,'presupuestos',id):read('sisventas/presupuestos/'+id);}
 async function legacyLinkedRecords(ids){
  const records=Object.create(null);let cursor=0,failed=false,failure;
  await Promise.all(Array.from({length:Math.min(6,ids.length)},async()=>{
   while(!failed&&cursor<ids.length){
    const id=ids[cursor++];
    try{records[id]=await read('sisventas/presupuestos/'+id);}
    catch(error){if(!failed){failed=true;failure=error;}}
   }
  }));
  if(failed)throw failure;return records;
 }
 async function linkedQuotes(actor,projects){
  if(!Model.commercial(actor))return [];
  const ids=[...new Set(projects.flatMap(project=>Object.values(project.budgets||{})).filter(b=>b.kind==='linked').map(b=>b.sourceId))].filter(id=>{
   // Un vínculo legado inválido conserva la proyección restringida; nunca se
   // convierte en una ruta de lectura ni obliga a descargar el historial.
   try{Model.key(id);return true;}catch(error){if(error.statusCode===400)return false;throw error;}
  });
  if(!ids.length)return [];
  const records=process.env.COMMERCIAL_OWNERSHIP_ENABLED==='true'
   ?await require('./commercial-ownership').createCommercialOwnership({auth,db,enabled:true,scopedReads,queryReader}).visibleRecordsByIds(actor,'presupuestos',ids)
   :await legacyLinkedRecords(ids);
  return Object.entries(records).filter(([,record])=>record&&!record.eliminado).map(([id,record])=>budget(id,record));
 }
 async function detail(actor,id){Model.key(id);const p=await read('sv_proyectos/'+id);if(!Model.view(p,actor))throw fail(404,'Proyecto no disponible');return {project:Model.project(p,actor,await linkedQuotes(actor,[p]))};}
 async function list(actor,cursor='',summaries=true){
  if(listStore&&summaries){const result=await listStore.list(actor,cursor);return {canCreate:actor.createAllowed,...result,projects:result.projects.filter(p=>Model.view(p,actor)).map(p=>Model.project(p,actor))};}
  const data=await read('sv_proyectos')||{},visible=Object.values(data).filter(p=>Model.view(p,actor));
  const q=await linkedQuotes(actor,visible);return {canCreate:actor.createAllowed,projects:visible.map(p=>Model.project(p,actor,q)).sort((a,b)=>b.updatedAt-a.updatedAt)};
 }
 async function options(actor,projectId,kind='all'){
  if(!['all','base','budgets'].includes(kind))throw fail(400,'Opciones de proyecto inválidas');
  if(kind==='budgets'&&(!projectId||!Model.commercial(actor)))throw fail(!projectId?400:403,!projectId?'Elegí un proyecto para vincular presupuestos':'Sin permiso para presupuestos');
  let allowed=actor.createAllowed;
  if(projectId){Model.key(projectId);const p=await read('sv_proyectos/'+projectId);if(!p||!Model.view(p,actor))throw fail(404,'Proyecto no disponible');allowed=Model.edit(p,actor);}
  if(!allowed)throw fail(403,'Solo lectura');
  // Los formularios de ficha e integrantes no necesitan el historial comercial.
  // El selector de vínculos lo solicita de manera explícita y con permiso vigente.
  const [people,clients,budgets]=await Promise.all([kind==='budgets'?Promise.resolve([]):directory(),kind!=='budgets'&&actor.clientAllowed?read('sisventas/clientes'):Promise.resolve({}),kind==='base'?Promise.resolve([]):quotes(actor)]);
  return {people,clients:Object.entries(clients||{}).filter(([,c])=>c.activo!==false&&!c.eliminado).map(([id,c])=>({id,name:String(c.nombre||c.empresa||'Cliente').slice(0,160),address:String(c.dir||c.direccion||'').slice(0,240)})),budgets};
 }
 async function save(actor,body,internal={}){
  const create=body.type==='create',requestKey=create&&body.requestId?Model.key(body.requestId):'',creationSignature=requestKey?crypto.createHash('sha256').update(JSON.stringify([actor.uid,body.data])).digest('hex'):'',id=create?(requestKey?crypto.createHash('sha256').update(actor.uid+':'+requestKey).digest('hex').slice(0,32):uuid()):Model.key(body.projectId);const directoryData=create||body.type==='members'?await directory():[];
  const stamp=now(),operation=uuid();let quote;
  if(['budget-link','materials-import'].includes(body.type)){
   if(body.type==='materials-import'){const project=await read('sv_proyectos/'+id);if(!Model.view(project,actor))throw fail(404,'Proyecto no disponible');if(!Model.edit(project,actor))throw fail(403,'Este proyecto es de solo lectura');}
   if(!Model.commercial(actor))throw fail(403,'Sin permiso para presupuestos');const key=Model.key(body.data?.sourceId),record=await quoteRecord(actor,key);if(!record||record.eliminado)throw fail(404,'Presupuesto no disponible');quote=budget(key,record);if(body.type==='materials-import'){const cache=new Map();for(const item of quote.items){if(item.photo||!item.productId)continue;try{Model.key(item.productId);}catch(_){continue;}if(!cache.has(item.productId))cache.set(item.productId,await read('sisventas/productos/'+item.productId));const product=cache.get(item.productId),photo=product&&(product.imagenUrl||product.fotoUrl||product.imagen||product.img);if(typeof photo==='string'&&/^https:\/\//.test(photo))item.photo=photo.slice(0,2000);}}
  }
  let error,listener;const ref=db.ref('sv_proyectos/'+id);
  try{
  // Mantener la suscripción evita que la transacción arranque con caché null.
  // No reutilizar una copia anterior como fallback: recrearía registros ausentes.
  if(!create)await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
  const result=await ref.transaction(current=>{
   error=null;try{if(create&&current){if(requestKey&&current._creationRequest===requestKey&&current._creationSignature===creationSignature&&current.owner===actor.uid)return current;throw fail(409,'El proyecto ya existe');}const next=Model.apply(current,body,actor,{directory:directoryData,quote,photo:internal.photo,photoValidated:!!internal.photo,now:stamp,id:create?id:operation});if(create&&requestKey){next._creationRequest=requestKey;next._creationSignature=creationSignature;}if(internal.photo&&next._pendingPhotos)delete next._pendingPhotos[body.data.id+'_'+internal.photo.id];return listStore?listStore.mark(next,current):next;}catch(e){error=e;return;}
  },undefined,false);
  if(error)throw error;if(!result.committed)throw fail(409,'No se pudo confirmar el proyecto. Actualizá y reintentá.');
  const saved=result.snapshot.val();if(listStore)try{await listStore.sync(saved);}catch(error){console.warn('Project summary deferred',error.code||error.statusCode||'unavailable');}
  return {project:Model.project(saved,actor,await linkedQuotes(actor,[saved]))};
  }finally{if(listener)ref.off('value',listener);}
 }
 async function privateFile(projectId,needId,photoId){
  if(!storage||!bucketName||!/^[a-z0-9][a-z0-9._-]{2,220}[a-z0-9]$/.test(bucketName))throw fail(503,'Las fotos requieren configurar el almacenamiento privado de Proyectos');
  const bucket=storage().bucket(bucketName),[meta]=await bucket.getMetadata();if(meta.iamConfiguration?.publicAccessPrevention!=='enforced'||meta.iamConfiguration?.uniformBucketLevelAccess?.enabled!==true)throw fail(503,'El almacenamiento de fotos debe ser privado');
  return bucket.file('projects/'+Model.key(projectId)+'/'+Model.key(needId)+'/'+Model.key(photoId));
 }
 async function uploadPhoto(actor,body){
  const projectId=Model.key(body.projectId),needId=Model.key(body.needId),p=await read('sv_proyectos/'+projectId);if(!Model.view(p,actor))throw fail(404,'Proyecto no disponible');if(!Model.execute(p,actor))throw fail(403,'Este proyecto es de solo lectura');if(p.revision!==body.revision)throw fail(409,'El proyecto cambió. Actualizá antes de guardar');if(!Object.values(p.needs||{}).some(n=>n.id===needId))throw fail(404,'Necesidad no disponible');
  if(Object.values(Object.values(p.needs||{}).find(n=>n.id===needId)?.execution?.photos||{}).length>=12)throw fail(400,'Máximo de 12 fotos por necesidad');
  const image=body.image||{},type=String(image.type||''),data=String(image.data||'').replace(/^data:image\/(?:jpeg|png|webp);base64,/,''),name=String(image.name||'Foto').slice(0,120);if(!['image/jpeg','image/png','image/webp'].includes(type)||!data||data.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw fail(400,'Elegí una imagen JPG, PNG o WebP de hasta 2 MB');
  const bytes=Buffer.from(data,'base64');if(!bytes.length||bytes.length>2*1024*1024)throw fail(400,'La foto supera los 2 MB');
  const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw fail(400,'El contenido de la foto no coincide con su formato');
  let thumb;if(image.thumbnail){const raw=String(image.thumbnail).replace(/^data:image\/jpeg;base64,/,'');if(raw.length>150000||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw fail(400,'Miniatura inválida');thumb=Buffer.from(raw,'base64');if(thumb[0]!==255||thumb[1]!==216||thumb[2]!==255)throw fail(400,'Miniatura inválida');}
  const id=crypto.createHash('sha256').update(bytes).digest('hex'),photo={id,name,type,size:bytes.length,createdAt:now(),by:actor.uid,...(thumb?{thumbnail:true}:{})};
  if(Object.values(Object.values(p.needs||{}).find(n=>n.id===needId)?.execution?.photos||{}).some(x=>x.id===id))return {project:Model.project(p,actor,await linkedQuotes(actor,[p]))};
  Model.apply(p,{type:'need-photo',projectId,revision:body.revision,data:{id:needId}},actor,{id:uuid(),now:now(),photo,photoValidated:true});
  const file=await privateFile(projectId,needId,id);
  // Reserve a recoverable reference before storing bytes. Conflicts never leave
  // an unreferenced object and no concurrent confirmed upload is deleted.
  const ref=db.ref('sv_proyectos/'+projectId);let reserveError;
  const reserved=await ref.transaction(current=>{try{if(!Model.execute(current,actor))throw fail(403,'Este proyecto es de solo lectura');if(current.revision!==body.revision)throw fail(409,'El proyecto cambió. Actualizá antes de guardar');const pending={...(current._pendingPhotos||{})};if(Object.keys(pending).length>=24&&!pending[needId+'_'+id])throw fail(409,'Revisá las fotos pendientes antes de agregar más');pending[needId+'_'+id]={...photo,needId};return {...current,_pendingPhotos:pending};}catch(error){reserveError=error;return;}},undefined,false);
  if(reserveError)throw reserveError;if(!reserved.committed)throw fail(409,'No se pudo preparar la foto');
  await file.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},contentType:type,metadata:{cacheControl:'private, no-store'}}).catch(e=>{if(e.code!==412)throw e;});
  if(thumb)await(await privateFile(projectId,needId,id+'_thumb')).save(thumb,{resumable:false,preconditionOpts:{ifGenerationMatch:0},contentType:'image/jpeg',metadata:{cacheControl:'private, no-store'}}).catch(e=>{if(e.code!==412)throw e;});
  try{return await save(actor,{type:'need-photo',projectId,revision:body.revision,data:{id:needId}},{photo});}catch(error){if(error.statusCode===409)error.message='La foto quedó pendiente. Actualizá el proyecto y volvé a subir la misma imagen para recuperarla';throw error;}
 }
 async function recoverPhoto(actor,body){const projectId=Model.key(body.projectId),needId=Model.key(body.needId),photoId=Model.key(body.photoId),p=await read('sv_proyectos/'+projectId);if(!Model.execute(p,actor))throw fail(403,'Este proyecto es de solo lectura');const pending=p._pendingPhotos?.[needId+'_'+photoId];if(!pending||(pending.by!==actor.uid&&!Model.manage(p,actor)))throw fail(404,'Foto pendiente no disponible');const [bytes]=await(await privateFile(projectId,needId,photoId)).download();if(crypto.createHash('sha256').update(bytes).digest('hex')!==photoId)throw fail(409,'La foto pendiente no está completa. Volvé a subirla');const photo={...pending};delete photo.needId;if(photo.thumbnail)try{await(await privateFile(projectId,needId,photoId+'_thumb')).download();}catch(_){delete photo.thumbnail;}return save(actor,{type:'need-photo',projectId,revision:body.revision,data:{id:needId}},{photo});}
 async function photo(actor,{projectId,needId,photoId,thumbnail}){
  Model.key(projectId);Model.key(needId);Model.key(photoId);const p=await read('sv_proyectos/'+projectId);if(!Model.view(p,actor))throw fail(404,'Proyecto no disponible');const n=[...Object.values(p.needs||{}),...(Model.manage(p,actor)?Object.values(p.archivedNeeds||{}):[])].find(n=>n.id===needId),meta=[...Object.values(n?.execution?.photos||{}),...(Model.manage(p,actor)?Object.values(n?.execution?.archivedPhotos||{}):[])].find(p=>p.id===photoId);if(!meta||!['image/jpeg','image/png','image/webp'].includes(meta.type))throw fail(404,'Foto no disponible');
  const [bytes]=await(await privateFile(projectId,needId,photoId+(thumbnail==='1'&&meta.thumbnail?'_thumb':''))).download();return {bytes,type:thumbnail==='1'&&meta.thumbnail?'image/jpeg':meta.type};
 }
 return {authorize,list,detail,options,save,uploadPhoto,recoverPhoto,photo};
}
module.exports={createProjects};
