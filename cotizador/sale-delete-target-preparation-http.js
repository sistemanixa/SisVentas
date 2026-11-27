'use strict';
const {digest}=require('./labor-guard');
const Preparation=require('./sale-delete-target-preparation');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode,code:'SV_SALE_DELETE_PREPARATION'});
const PATH='/comerciales/ventas/eliminacion/preparar';
function create({authorize,guard,store,enabled=false}){
 if(typeof authorize!=='function'||typeof guard?.run!=='function'||typeof store?.read!=='function')throw TypeError('Falta el circuito de mantenimiento.');
 async function access(req,read){
  const actor=await authorize(req),[profile,permissions]=await Promise.all([read('sv_chat_roles/'+actor.uid),read('sv_permisos/admin')]);
  if(actor.claims?.uid!==actor.uid||actor.viewing||profile?.activo!==true||profile.rol!=='admin'||permissions?.indiceVersion!==2||permissions.indiceModulos?.venta!==true||permissions.indiceModulos?.configuracion!==true||permissions.acciones?.mantenimiento?.migrar===false||permissions.acciones?.ventas?.eliminar===false||Object.values(permissions.bloqueados||{}).some(value=>['venta','configuracion'].includes(value)))throw fail(403,'Se requiere administrador con permiso de mantenimiento y ventas.');
  return {actor,profile,permissions};
 }
 async function handle(req,body){
  if(new URL(req.url,'http://local.invalid').pathname!==PATH||new URL(req.url,'http://local.invalid').search)throw fail(404,'Ruta inexistente.');
  if(req.method!=='POST')throw fail(405,'Método no permitido.');
  if(!enabled||guard.saleDeleteRelations!==true)throw fail(503,'El mantenimiento de vínculos no está habilitado.');
  if(!body||Object.keys(body).join(',')!=='id'||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id))throw fail(400,'Solicitud de mantenimiento inválida.');
  const initial=await access(req,path=>store.read(path)),uid=initial.actor.uid;
  const verify=async read=>{const fresh=await access(req,read);if(fresh.actor.uid!==uid||digest({profile:fresh.profile,permissions:fresh.permissions})!==digest({profile:initial.profile,permissions:initial.permissions}))throw fail(409,'Los permisos cambiaron durante la preparación.');};
  let reader,result;
  try{result=await guard.run({uid,claims:initial.actor.claims,mode:'user',role:'admin',permissionRevision:initial.permissions.indiceRevision,permissionDigest:digest(initial.permissions),financialAction:'ventas.eliminar.preparar',operation:'sale-delete-target-preparation',opId:body.id,transportDigest:digest(body),input:body},async scope=>{
   await verify(scope.get);
   if(typeof store.createSaleDeletePreparationReader!=='function')throw fail(503,'La preparación por registro no está disponible.');
   reader=store.createSaleDeletePreparationReader();const prepared=await Preparation.prepare({scope,store,reader});
   scope.beforeCommit(async({readFresh})=>verify(readFresh));return prepared;
  });}finally{reader?.dispose();}
  return {statusCode:200,body:{ok:true,committed:result.committed===true,operationId:body.id,prepared:true}};
 }
 return {handle,path:PATH};
}
module.exports={create,PATH};
