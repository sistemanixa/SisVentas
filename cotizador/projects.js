'use strict';
const crypto=require('node:crypto'),Model=require('./projects-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const commercial=roles.filter(r=>r!=='tecnico');
function createProjects({auth,db,enabled=false,now=Date.now,uuid=crypto.randomUUID}){
 const read=async p=>(await db.ref(p).get()).val();
 async function authorize(req){
  const token=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!token)throw fail(401,'Sesión requerida');
  let user;try{user=await auth.verifyIdToken(token[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  Model.key(user.uid);const identity=await read('sv_chat_roles/'+user.uid);if(identity?.activo!==true||!roles.includes(identity.rol))throw fail(403,'Usuario sin acceso');
  if(!enabled)throw fail(503,'Proyectos todavía no está habilitado en el servidor');
  const stored=await read('sv_permisos/'+identity.rol),cfg=stored||{},blocked=Object.values(cfg.bloqueados||{}),mod=m=>stored?!blocked.includes(m):['clientes','presupuesto'].includes(m)?commercial.includes(identity.rol):true;
  if(!mod('proyectos'))throw fail(403,'Proyectos está bloqueado para tu rol');
  const action=(name,defaults)=>typeof cfg.acciones?.proyectos?.[name]==='boolean'?cfg.acciones.proyectos[name]:defaults.includes(identity.rol);
  const ownName=await read('sv_chat_directorio/'+user.uid+'/nombre');
  return {uid:user.uid,name:String(ownName||'Usuario').slice(0,100),role:identity.rol,enabled:true,createAllowed:action('crear',commercial),editAllowed:action('editar',roles),quoteAllowed:mod('presupuesto')&&action('presupuestar',commercial),clientAllowed:mod('clientes')};
 }
 async function directory(){
  const [data,identities]=await Promise.all([read('sv_chat_directorio'),read('sv_chat_roles')]);
  return Object.entries(data||{}).filter(([uid,p])=>p.activo!==false&&identities?.[uid]?.activo===true&&roles.includes(identities[uid].rol)).map(([uid,p])=>({uid,name:String(p.nombre||'Usuario').slice(0,100),role:identities[uid].rol}));
 }
 function budget(id,p){return {id,number:String(p.numero||p.id||id).slice(0,80),title:String(p.tituloSolucion||p.cliente||'Presupuesto').slice(0,160),clientId:String(p.clienteFbKey||p.clienteKey||p.clienteId||''),total:p.total!=null&&Number.isFinite(Number(p.total))?Number(p.total):null,currency:p.moneda==='USD'?'USD':'ARS',status:String(p.estado||'borrador').slice(0,40),items:(Array.isArray(p.items)?p.items:Object.values(p.items||{})).slice(0,200).map(i=>({description:String(i.desc||i.descripcion||'').slice(0,200),qty:Number(i.qty)||0,unitPrice:Number(i.punit)||0}))};}
 async function quotes(actor){if(!actor.quoteAllowed)return [];return Object.entries(await read('sisventas/presupuestos')||{}).filter(([,p])=>!p.eliminado).map(([id,p])=>budget(id,p));}
 async function list(actor){
  const data=await read('sv_proyectos')||{},q=await quotes(actor);
  return {canCreate:actor.createAllowed,projects:Object.values(data).filter(p=>Model.view(p,actor)).map(p=>Model.project(p,actor,q)).sort((a,b)=>b.updatedAt-a.updatedAt)};
 }
 async function options(actor,projectId){
  let allowed=actor.createAllowed;
  if(projectId){Model.key(projectId);const p=await read('sv_proyectos/'+projectId);if(!p||!Model.view(p,actor))throw fail(404,'Proyecto no disponible');allowed=Model.edit(p,actor);}
  if(!allowed)throw fail(403,'Solo lectura');
  const [people,clients,budgets]=await Promise.all([directory(),actor.clientAllowed?read('sisventas/clientes'):Promise.resolve({}),quotes(actor)]);
  return {people,clients:Object.entries(clients||{}).filter(([,c])=>c.activo!==false&&!c.eliminado).map(([id,c])=>({id,name:String(c.nombre||c.empresa||'Cliente').slice(0,160),address:String(c.dir||c.direccion||'').slice(0,240)})),budgets};
 }
 async function save(actor,body){
  const create=body.type==='create',id=create?uuid():Model.key(body.projectId);const directoryData=await directory();
  const stamp=now(),operation=uuid();let quote;
  if(body.type==='budget-link'){
   if(!actor.quoteAllowed)throw fail(403,'Sin permiso para presupuestos');const key=Model.key(body.data?.sourceId),record=await read('sisventas/presupuestos/'+key);if(!record||record.eliminado)throw fail(404,'Presupuesto no disponible');quote=budget(key,record);
  }
  let error,listener;const ref=db.ref('sv_proyectos/'+id);
  try{
  // Mantener la suscripción evita que la transacción arranque con caché null.
  // No reutilizar una copia anterior como fallback: recrearía registros ausentes.
  if(!create)await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
  const result=await ref.transaction(current=>{
   error=null;try{if(create&&current)throw fail(409,'El proyecto ya existe');return Model.apply(current,body,actor,{directory:directoryData,quote,now:stamp,id:create?id:operation});}catch(e){error=e;return;}
  },undefined,false);
  if(error)throw error;if(!result.committed)throw fail(409,'No se pudo confirmar el proyecto. Actualizá y reintentá.');
  return {project:Model.project(result.snapshot.val(),actor,await quotes(actor))};
  }finally{if(listener)ref.off('value',listener);}
 }
 return {authorize,list,options,save};
}
module.exports={createProjects};
