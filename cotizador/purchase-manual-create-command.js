'use strict';
// Internal OFF command. Neither prospective resolver nor numbering is client input.
const {digest}=require('./labor-guard'),Policy=require('./purchase-inventory-policy'),{key,reference}=require('./purchase-inventory-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode,code:'SV_PURCHASE_MANUAL_CREATE'});
function create({authorize,store,guard,assertAdmission,creationReferencePort,resolveOrderNumber,queryPage,enabled=false,now=Date.now}={}){
 function ready(){if(enabled!==true)throw fail(503,'El alta coordinada de Compras sigue desactivada.');if([authorize,assertAdmission,creationReferencePort?.resolve,creationReferencePort?.assertFresh,resolveOrderNumber,guard?.run].some(value=>typeof value!=='function'))throw fail(503,'Falta el resolver prospectivo o la numeración del servidor.');}
 async function access(req,read,expected){const identity=await authorize(req);if(!identity?.uid||identity.claims?.uid!==identity.uid||identity.viewing||identity.viewAs||identity.realUid&&identity.realUid!==identity.uid||expected&&expected.uid!==identity.uid||identity.claims.svPasswordChangeRequired===true)throw fail(403,'La sesión cambió.');key(identity.uid);
  const profile=await read('sv_chat_roles/'+identity.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+identity.uid),override=cfg?.acciones?.ordenes?.editar;
  if(profile?.activo!==true||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordenes!==true||Object.values(cfg.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:!['admin','administrativo'].includes(profile.rol))||reset?.required===true||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'No tenés permiso para crear esta compra.');
  return {...identity,role:profile.rol,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg),name:identity.claims.name||'Usuario'};
 }
 async function execute(req,raw){ready();if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['id','providerKey','currency','date','items'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(raw.id||'')||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>100)throw fail(400,'Declaración de compra inválida.');
  const body=structuredClone(raw),{id,...declaration}=body,checked=await access(req,path=>store.read(path)),orderKey='manual_'+digest({uid:checked.uid,id}).slice(0,40),input={id,kind:'register',orderKey,expectedHash:digest(null),declaration},runner={...checked,mode:'user',financialAction:'ordenes.editar',operation:'purchase-manual-create',opId:id,transportDigest:digest(input),input};
  return guard.run(runner,async scope=>{
   const identity=await access(req,scope.get,checked);if(digest(identity)!==digest(checked))throw fail(409,'Los permisos o la sesión cambiaron.');const at=now();
   async function load(read,query,phaseQueryPage){await assertAdmission({read,identity,lease:scope.lease,phase:'create'});const orderPath='sisventas/ordenes/'+orderKey,originalOrder=await read(orderPath),operationReceipt=await read('sv_labor_receipts/'+id),providerRaw=await read('sisventas/proveedores/'+key(declaration.providerKey));
    if(originalOrder!==null||operationReceipt!==null)throw fail(409,'La orden o el recibo ya existe. Consultá la operación.');
    const provider=providerRaw&&{...providerRaw,fbKey:declaration.providerKey},products=Object.create(null),rawProducts=Object.create(null),references=Object.create(null),inventories=Object.create(null),resolutions=Object.create(null),evidences=[];
    for(const item of declaration.items){const productKey=key(item?.productKey);if(Object.hasOwn(products,productKey))continue;const rawProduct=await read('sisventas/productos/'+productKey);if(!rawProduct)throw fail(409,'Falta el producto original.');const product={...rawProduct,fbKey:productKey};products[productKey]=product;
     // This is a prospective catalog source, never a fabricated original Order.
     const resolved=await creationReferencePort.resolve({productKey},{actor:runner,lease:scope.lease,read,queryPage:phaseQueryPage}),ref=reference(resolved?.reference);if(ref.productKey!==productKey||digest(resolved.product)!==digest(rawProduct))throw fail(409,'La referencia prospectiva no coincide con el producto original.');rawProducts[productKey]=structuredClone(rawProduct);references[productKey]=structuredClone(ref);resolutions[productKey]={product:structuredClone(resolved.product),inventory:structuredClone(resolved.inventory),reference:structuredClone(ref),readSet:structuredClone(resolved.readSet)};evidences.push(resolved);if(!Object.hasOwn(inventories,ref.inventoryKey)){inventories[ref.inventoryKey]=await read('sisventas/inventario_operativo/'+ref.inventoryKey);if(digest(inventories[ref.inventoryKey])!==digest(resolved.inventory))throw fail(409,'El inventario prospectivo cambió.');}
    }
    const numero=await resolveOrderNumber({read,query,queryPage:phaseQueryPage,orderKey,id,actor:identity,at});return {model:{body:declaration,context:{orderKey,numero,id,at,actor:{uid:identity.uid,name:identity.name}},originalOrder,operationReceipt,products,provider,inventories,references,rawProducts,rawProvider:providerRaw},resolutions,evidences};
   }
   const sources=await load(scope.get,scope.query,queryPage),plan=Policy.issueCreation(runner,scope.lease,sources.model);
   scope.beforeCommit(async({readFresh,queryFresh,queryPageFresh})=>{const fresh=await access(req,readFresh,checked);if(digest(fresh)!==digest(checked))throw fail(409,'Los permisos cambiaron.');for(const evidence of sources.evidences)await creationReferencePort.assertFresh(evidence,{actor:runner,lease:scope.lease,readFresh,queryPageFresh:queryPageFresh||queryPage});const current=await load(readFresh,queryFresh,queryPageFresh||queryPage);if(digest({model:current.model,resolutions:current.resolutions})!==digest({model:sources.model,resolutions:sources.resolutions}))throw fail(409,'Los originales, la numeración o la referencia cambiaron.');await assertAdmission({read:readFresh,identity:fresh,lease:scope.lease,phase:'create-commit'});if(digest(await access(req,readFresh,checked))!==digest(checked))throw fail(409,'La sesión cambió antes de confirmar.');});
   await scope.update(plan.patch);return plan.result;
  });
 }
 return {execute};
}
module.exports={create};
