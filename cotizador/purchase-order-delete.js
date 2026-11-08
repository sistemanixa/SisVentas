'use strict';
const {digest}=require('./labor-guard'),Model=require('./purchase-order-delete-model');
const fail=(message,statusCode=409)=>Object.assign(Error(message),{code:'SV_PURCHASE_DELETE_BLOCKED',statusCode});
const key=value=>{if(typeof value!=='string'||!value||['__proto__','prototype','constructor'].includes(value)||value.length>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail('Referencia de compra inválida.',400);return value;};
const baseOrder=value=>{const copy=structuredClone(value);if(copy)delete copy.fbKey;return copy;};
function createPurchaseOrderDelete({authorize,store,guard,enabled=false}){
 const capability=()=>enabled===true&&guard?.clientAccounts===true&&guard?.clientHistory===true&&store?.operationalFenceReady===true;
 async function access(req,read,expected){const actor=await authorize(req);if(!actor?.uid||actor.uid!==actor.claims?.uid||expected&&actor.uid!==expected.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid)throw fail('La sesión cambió.',403);const profile=await read('sv_chat_roles/'+key(actor.uid)),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid),override=cfg?.acciones?.ordenes?.eliminar;
  if(profile?.activo!==true||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordenes!==true||Object.values(cfg.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:profile.rol!=='admin')||actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para eliminar esta orden.',403);
  return {actor,profile,cfg,role:profile.rol,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};
 }
 async function plan(read,body){const path='sisventas/ordenes/'+body.orderKey,original=await read(path);if(!original||original.fbKey!=null&&original.fbKey!==body.orderKey||digest(baseOrder(original))!==body.expectedHash)throw fail('La orden cambió. Volvé a abrirla antes de eliminar.');const order={...original,fbKey:body.orderKey},sale=order.ventaFbKey?await read('sisventas/ventas/'+key(order.ventaFbKey)):null,list=order.listaMaterialesId?await read('sisventas/listas_materiales/'+key(order.listaMaterialesId)):null,inventoryByKey=Object.create(null);for(const item of order.items||[]){const raw=item.productoKey||item.codigo;if(!raw)throw fail('Falta identificar un material.');const inventoryId=Model.inventoryKey(raw);if(!Object.hasOwn(inventoryByKey,inventoryId))inventoryByKey[inventoryId]=await read('sisventas/inventario_operativo/'+inventoryId);}
  const result=Model.prepareOrderDeletion({order,inventoryByKey,sale,list});return result;
 }
 async function handle(req,body){if(req.method!=='POST')throw fail('Método no permitido.',405);if(!capability())throw fail('La eliminación conjunta de Compras aún no está habilitada.',503);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','orderKey','expectedHash'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Solicitud de compra inválida.',400);key(body.orderKey);if(new URL(req.url,'http://fixture.invalid').search)throw fail('La eliminación no admite parámetros.',400);
  const checked=await access(req,path=>store.read(path)),actor=checked.actor;
  const commercialDeleteProof=await store.commercialDeleteReadiness?.capture('orderDelete');
  const result=await guard.run({uid:actor.uid,claims:actor.claims,commercialDeleteProof,role:checked.role,permissionRevision:checked.permissionRevision,permissionDigest:checked.permissionDigest,mode:'command',financialAction:'ordenes.eliminar',recoverReceipt:true,opId:body.id,transportDigest:digest(body),operation:'purchase-order-delete',input:body},async scope=>{
   if(commercialDeleteProof)await store.commercialDeleteReadiness.assertCurrent(commercialDeleteProof,scope.get);
   const current=await access(req,scope.get,actor);if(digest({profile:current.profile,cfg:current.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');
   const visible=await store.readAsUser('sisventas/ordenes/'+body.orderKey,actor);if(!visible||digest(baseOrder(visible))!==body.expectedHash)throw fail('No se pudo confirmar el acceso a la orden.');const initial=await plan(scope.get,body);
   scope.beforeCommit(async({readFresh})=>{if(commercialDeleteProof)await store.commercialDeleteReadiness.assertCurrent(commercialDeleteProof,readFresh);const fresh=await access(req,readFresh,actor);if(digest({profile:fresh.profile,cfg:fresh.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');if(digest(await plan(readFresh,body))!==digest(initial))throw fail('La compra o el stock cambió. No se guardaron cambios.');});
   await scope.update(initial.patch);return {ok:true,committed:true,orderKey:body.orderKey};
  });
  if(result?.committed!==true)throw fail('No se confirmó la eliminación. Consultá la operación antes de repetirla.',503);
  return {ok:true,committed:true,orderKey:body.orderKey};
 }
 return {handle,capability};
}
module.exports={createPurchaseOrderDelete};
