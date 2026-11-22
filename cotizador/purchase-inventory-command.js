'use strict';
const {digest}=require('./labor-guard'),Policy=require('./purchase-inventory-policy'),Plan=require('./purchase-inventory-order-plan'),{key}=require('./purchase-inventory-model'),{createReferencePort}=require('./purchase-inventory-reference-port');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code});
function create({authorize,store,guard,resolveReference,assertAdmission,queryPage,enabled=false,now=Date.now}={}){
 function ready(){if(enabled!==true)throw fail(503,'SV_PURCHASE_INVENTORY_DISABLED','El ingreso coordinado de Compras todavía no está habilitado.');if(typeof authorize!=='function'||typeof assertAdmission!=='function'||typeof resolveReference!=='function'||typeof guard?.run!=='function')throw fail(503,'SV_PURCHASE_INVENTORY_NOT_READY','Falta preparar el ingreso seguro de Compras.');}
 async function access(req,read,expected){const identity=await authorize(req);if(!identity?.uid||identity.uid!==identity.claims?.uid||identity.viewing||identity.viewAs||identity.realUid&&identity.realUid!==identity.uid||expected&&expected.uid!==identity.uid||identity.claims.svPasswordChangeRequired===true)throw fail(403,'SV_PURCHASE_AUTH','La sesión cambió.');key(identity.uid);
  const profile=await read('sv_chat_roles/'+identity.uid),permissions=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+identity.uid),override=permissions?.acciones?.ordenes?.editar;
  if(profile?.activo!==true||permissions?.indiceVersion!==2||permissions.indiceModulos?.ordenes!==true||Object.values(permissions.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:!['admin','administrativo'].includes(profile.rol))||reset?.required===true||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'SV_PURCHASE_AUTH','No tenés permiso para editar esta compra.');
  return {...identity,role:profile.rol,permissionRevision:permissions.indiceRevision??null,permissionDigest:digest(permissions),name:identity.claims.name||'Usuario'};
 }
 function input(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['id','kind','orderKey','expectedHash','expectedRevision','quantities','movements'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(value.id||'')||!Policy.kinds.includes(value.kind)||!/^[a-f0-9]{64}$/.test(value.expectedHash||'')||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<0)throw fail(400,'SV_PURCHASE_INPUT','Solicitud de compra inválida.');key(value.orderKey);
  for(const [field,kind,keys]of [['quantities','edit',['index','quantity']],['movements','receive',['index','quantity','realUnitCost']]]){
   if(value.kind===kind){if(!Array.isArray(value[field])||!value[field].length||value[field].length>100||value[field].some(row=>!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!keys.includes(k))))throw fail(400,'SV_PURCHASE_INPUT','Renglones de compra inválidos.');}
   else if(value[field]!==undefined)throw fail(400,'SV_PURCHASE_INPUT','La operación no admite esos cambios.');
  }return structuredClone(value);
 }
 async function execute(req,raw){ready();const body=input(raw),checked=await access(req,p=>store.read(p)),runner={...checked,mode:'user',financialAction:'ordenes.editar',operation:'purchase-inventory-'+body.kind,opId:body.id,input:body,transportDigest:digest(body)};
  return guard.run(runner,async scope=>{
   const live=await access(req,p=>scope.get(p),checked);if(digest(live)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','La sesión o los permisos cambiaron.');
   await assertAdmission({read:p=>scope.get(p),phase:'execute',identity:live,lease:scope.lease});
   const path='sisventas/ordenes/'+body.orderKey,order=await scope.getAsUser(path);if(!order||digest(order)!==body.expectedHash||(order._svReadRevision??0)!==body.expectedRevision)throw fail(409,'SV_PURCHASE_CONFLICT','La compra cambió. Volvé a abrirla.');
   const referencePort=createReferencePort({resolveReference}),originals=(order.items||[]).map((row,index)=>({...structuredClone(row),source:path,rowKey:String(index)})),resolved=await referencePort.resolve(originals,{read:p=>scope.get(p),query:(...args)=>scope.query(...args),sourceOrder:order,access:{uid:live.uid,role:live.role},queryPage}),inventories=Object.create(null);
   for(const ref of Object.values(resolved.references))if(!Object.hasOwn(inventories,ref.inventoryKey))inventories[ref.inventoryKey]=await scope.get('sisventas/inventario_operativo/'+ref.inventoryKey);
   const plan=Plan.build({sourceOrder:order,body,inventories,references:resolved.references,at:now(),actorName:live.name});Policy.issue(runner,scope.lease,plan,now());
   scope.beforeCommit(async({readFresh,queryFresh,queryPageFresh})=>{const fresh=await access(req,readFresh,checked);if(digest(fresh)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','La sesión o los permisos cambiaron.');await assertAdmission({read:readFresh,phase:'commit',identity:fresh,lease:scope.lease});await resolved.assertFresh({readFresh,queryFresh,queryPageFresh:queryPageFresh||queryPage});await assertAdmission({read:readFresh,phase:'commit',identity:fresh,lease:scope.lease});const finalIdentity=await access(req,readFresh,checked);if(digest(finalIdentity)!==digest(checked))throw fail(409,'SV_PURCHASE_AUTH_CHANGED','La sesión cambió antes de confirmar.');});
   await scope.update(plan.patch);return {ok:true,committed:true,operationId:body.id,orderKey:body.orderKey};
  });
 }
 return {execute};
}
module.exports={create};
