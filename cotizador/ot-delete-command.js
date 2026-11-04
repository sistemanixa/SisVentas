'use strict';
const Policy=require('./ot-delete-policy'),{digest}=require('./labor-guard');
const fail=message=>Object.assign(Error(message),{code:'SV_OT_DELETE_BLOCKED',statusCode:409});
const key=value=>{if(typeof value!=='string'||!value||value.length>768||['__proto__','prototype','constructor'].includes(value)||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail('Referencia inválida.');return value;};
function createOTDeleteCommand({guard,store,verifyActor,enabled=false}){
 async function access(read,actor){
  if(typeof verifyActor!=='function')throw fail('Falta verificación fresca de identidad.');
  await verifyActor(actor);
  if(!actor?.uid||actor.claims?.uid!==actor.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims.svPasswordChangeRequired)throw fail('Volvé a tu cuenta administrativa.');
  const profile=await read('sv_chat_roles/'+key(actor.uid)),permissions=profile?.rol?await read('sv_permisos/'+key(profile.rol)):null,reset=await read('sv_access_resets/'+actor.uid),override=permissions?.acciones?.ot?.eliminar;
  if(profile?.activo!==true||permissions?.indiceVersion!==2||permissions.indiceModulos?.ordentrabajo!==true||(typeof override==='boolean'?!override:profile.rol!=='admin')||Object.values(permissions.bloqueados||{}).includes('ordentrabajo')||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('Se requiere permiso explícito para eliminar OT.');
  return {profile,permissions};
 }
 async function evidence(read,otKey,expectedHash){
  const original=await read('sisventas/ordenes_trabajo/'+otKey),sources={};
  if(!original||original.fbKey!=null&&original.fbKey!==otKey)throw fail('La OT cambió o su identidad requiere revisión.');
  const baseline={...original};delete baseline.fbKey;if(digest(baseline)!==expectedHash)throw fail('La OT cambió. Volvé a abrirla antes de eliminar.');
  for(const domain of Policy.domains){const value=await read('sisventas/'+domain);sources[domain]=value===null?{}:value;}
  Policy.plan(otKey,original,sources);return {original,sources};
 }
 async function execute(actor,body){
  if(!enabled)throw fail('La eliminación protegida de OT todavía no está habilitada.');
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(field=>!['id','otKey','expectedHash'].includes(field))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Solicitud de eliminación OT inválida.');
  const otKey=key(body?.otKey);key(body?.id);
  if(!guard?.clientHistory||!guard.affects?.('sisventas/ordenes_trabajo/'+otKey)||store?.otDeleteFenceReady!==true)throw fail('Falta el cierre de escritores OT y fuentes vinculadas. No se eliminó la OT.');
  const captured=await access(path=>store.read(path),actor);
  return guard.run({uid:actor.uid,claims:actor.claims,mode:'user',role:captured.profile.rol,permissionRevision:captured.permissions.indiceRevision,permissionDigest:digest(captured.permissions),opId:body.id,transportDigest:digest(body),operation:'ot-delete',input:body},async scope=>{
   if(digest(await access(scope.get,actor))!==digest(captured))throw fail('Los permisos cambiaron.');
   const initial=await evidence(scope.get,otKey,body.expectedHash);
   async function visible(){if(typeof store.readAsUser!=='function'||digest(await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,actor))!==digest(initial.original))throw fail('No se pudo confirmar el acceso al original completo de la OT.');}
   await visible();
   scope.beforeCommit(async({readFresh})=>{if(digest(await access(readFresh,actor))!==digest(captured))throw fail('Los permisos cambiaron.');if(digest(await evidence(readFresh,otKey,body.expectedHash))!==digest(initial))throw fail('Los vínculos o la OT cambiaron.');await visible();});
   await scope.update({['sisventas/ordenes_trabajo/'+otKey]:null});
   return {ok:true,otKey};
  });
 }
 return {execute,capability:()=>enabled&&guard?.clientHistory===true&&store?.otDeleteFenceReady===true};
}
module.exports={createOTDeleteCommand};
