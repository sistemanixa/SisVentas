'use strict';
const {digest}=require('./labor-guard'),Policy=require('./purchase-inventory-policy'),{key}=require('./purchase-inventory-model'),{createReferencePort}=require('./purchase-inventory-reference-port');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code});
function create({authorize,store,guard,resolveReference,assertAdmission,queryPage,enabled=false,now=Date.now}={}){
 async function access(req,read,expected){const identity=await authorize(req);if(!identity?.uid||identity.uid!==identity.claims?.uid||identity.viewing||identity.viewAs||identity.realUid&&identity.realUid!==identity.uid||expected&&expected.uid!==identity.uid||identity.claims.svPasswordChangeRequired===true)throw fail(403,'SV_PURCHASE_AUTH','La sesión cambió.');key(identity.uid);
  const profile=await read('sv_chat_roles/'+identity.uid),permissions=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+identity.uid),override=permissions?.acciones?.ordenes?.eliminar;
  if(profile?.activo!==true||permissions?.indiceVersion!==2||permissions.indiceModulos?.ordenes!==true||Object.values(permissions.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:profile.rol!=='admin')||reset?.required===true||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'SV_PURCHASE_AUTH','No tenés permiso para eliminar esta compra.');
  return {...identity,role:profile.rol,permissionRevision:permissions.indiceRevision??null,permissionDigest:digest(permissions)};
 }
 async function execute(req,raw){
  if(enabled!==true||typeof authorize!=='function'||typeof store?.read!=='function'||typeof guard?.run!=='function'||typeof resolveReference!=='function'||typeof assertAdmission!=='function')throw fail(503,'SV_PURCHASE_DELETE_NOT_READY','El borrado coordinado no está habilitado.');
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==3||!['id','orderKey','expectedHash'].every(k=>Object.hasOwn(raw,k))||!/^[A-Za-z0-9_-]{8,160}$/.test(raw.id||'')||!/^[a-f0-9]{64}$/.test(raw.expectedHash||''))throw fail(400,'SV_PURCHASE_DELETE_INPUT','Solicitud de borrado inválida.');key(raw.orderKey);
  const body=structuredClone(raw),checked=await access(req,p=>store.read(p)),runner={...checked,mode:'user',financialAction:'ordenes.eliminar',operation:'purchase-typed-delete',opId:body.id,input:body,transportDigest:digest(body),recoverReceipt:true};
  return guard.run(runner,async scope=>{
   const live=await access(req,p=>scope.get(p),checked);if(digest(live)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','La sesión o los permisos cambiaron.');
   await assertAdmission({read:p=>scope.get(p),phase:'execute',identity:live,lease:scope.lease});
   const path='sisventas/ordenes/'+body.orderKey,order=await scope.getAsUser(path);if(!order||digest(order)!==body.expectedHash)throw fail(409,'SV_PURCHASE_CONFLICT','La compra cambió. Volvé a abrirla.');
   const port=createReferencePort({resolveReference}),originals=(order.items||[]).map((row,index)=>({...structuredClone(row),source:path,rowKey:String(index)})),resolved=await port.resolve(originals,{read:p=>scope.get(p),query:(...args)=>scope.query(...args),sourceOrder:order,access:{uid:live.uid,role:live.role},queryPage}),inventories=Object.create(null);
   for(const ref of Object.values(resolved.references))if(!Object.hasOwn(inventories,ref.inventoryKey))inventories[ref.inventoryKey]=await scope.get('sisventas/inventario_operativo/'+ref.inventoryKey);
   const plan=Policy.issueDeletion(runner,scope.lease,{sourceOrder:order,body,inventories,references:resolved.references,at:now()},now());
   scope.beforeCommit(async({readFresh,queryFresh,queryPageFresh})=>{const fresh=await access(req,readFresh,checked);if(digest(fresh)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','Los permisos cambiaron antes de confirmar.');await assertAdmission({read:readFresh,phase:'commit',identity:fresh,lease:scope.lease});await resolved.assertFresh({readFresh,queryFresh,queryPageFresh:queryPageFresh||queryPage});await assertAdmission({read:readFresh,phase:'commit',identity:fresh,lease:scope.lease});const final=await access(req,readFresh,checked);if(digest(final)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','La sesión cambió antes de confirmar.');});
   await scope.update(plan.patch);return{ok:true,committed:true,operationId:body.id,orderKey:body.orderKey};
  });
 }
 return Object.freeze({execute});
}
module.exports={create};
