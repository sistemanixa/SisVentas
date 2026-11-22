'use strict';
const {digest}=require('./labor-guard'),Model=require('./purchase-order-delete-model');
const {createReferencePort}=require('./purchase-inventory-reference-port'),Sources=require('./purchase-inventory-linked-sources');
const fail=(message,statusCode=409)=>Object.assign(Error(message),{code:'SV_PURCHASE_DELETE_BLOCKED',statusCode});
const key=value=>{if(typeof value!=='string'||!value||['__proto__','prototype','constructor'].includes(value)||value.length>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail('Referencia de compra inválida.',400);return value;};
const baseOrder=value=>{const copy=structuredClone(value);if(copy)delete copy.fbKey;return copy;};
function createPurchaseOrderDelete({authorize,store,guard,resolveReference,assertAdmission,queryPage,referenceEnabled=false,enabled=false}){
 const capability=()=>enabled===true&&guard?.clientAccounts===true&&guard?.clientHistory===true&&store?.operationalFenceReady===true&&(!referenceEnabled||typeof resolveReference==='function'&&typeof assertAdmission==='function');
 async function access(req,read,expected){const actor=await authorize(req);if(!actor?.uid||actor.uid!==actor.claims?.uid||expected&&actor.uid!==expected.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid)throw fail('La sesión cambió.',403);const profile=await read('sv_chat_roles/'+key(actor.uid)),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid),override=cfg?.acciones?.ordenes?.eliminar;
  if(profile?.activo!==true||profile.rol!=='admin'||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordenes!==true||Object.values(cfg.bloqueados||{}).includes('ordenes')||override===false||actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para eliminar esta orden.',403);
  return {actor,profile,cfg,role:profile.rol,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};
 }
 async function plan(read,body,{query,queryPage:phaseQueryPage,access:identity}={}){
  const path='sisventas/ordenes/'+body.orderKey,original=await read(path);if(!original||original.fbKey!=null&&original.fbKey!==body.orderKey||digest(baseOrder(original))!==body.expectedHash)throw fail('La orden cambió. Volvé a abrirla antes de eliminar.');const order={...original,fbKey:body.orderKey},sale=order.ventaFbKey?await read('sisventas/ventas/'+key(order.ventaFbKey)):null,list=order.listaMaterialesId?await read('sisventas/listas_materiales/'+key(order.listaMaterialesId)):null,inventoryByKey=Object.create(null);
  let resolution,sources;if(referenceEnabled){
   if(order.listaOrigenId||list?.sources?.length||list?.origen==='conjunta')throw fail('La compra conjunta requiere el plan de todas sus fuentes.');
   if(order.ventaFbKey&&order.listaMaterialesId&&(sale?.listaMaterialesId!==order.listaMaterialesId||list?.ventaFbKey!==order.ventaFbKey))throw fail('La venta y la lista ya no tienen el mismo vínculo.');
   if(typeof assertAdmission!=='function'||typeof resolveReference!=='function')throw fail('Falta preparar la referencia segura de Compras.',503);
   await assertAdmission({read,phase:'delete',identity});
   resolution=await createReferencePort({resolveReference}).resolve((original.items||[]).map((item,index)=>({...item,source:path,rowKey:String(index)})),{sourceOrder:original,read,query,queryPage:phaseQueryPage,access:{uid:identity.actor.uid,role:identity.role}});
   if(order.ventaFbKey||order.listaMaterialesId)sources=await Sources.load({order,orderKey:body.orderKey,read,guard});
  }
  for(const item of order.items||[]){const raw=item.productoKey||item.codigo;if(!raw)throw fail('Falta identificar un material.');const inventoryId=resolution?resolution.references[raw].inventoryKey:Model.inventoryKey(raw);if(!Object.hasOwn(inventoryByKey,inventoryId))inventoryByKey[inventoryId]=await read('sisventas/inventario_operativo/'+inventoryId);}
  const result=Model.prepareOrderDeletion({order,inventoryByKey,sale,list,references:resolution?.references});
  // Keep all other orders/configuration/range results in this private comparison.
  if(resolution)result.referenceProof=resolution.resolutions;
  if(sources)result.linkedSources={dependencyHash:sources.dependencyHash,otherOrders:sources.otherOrders,sale:sources.sale,list:sources.list};
  return {result,sources};
 }
 async function handle(req,body){if(req.method!=='POST')throw fail('Método no permitido.',405);if(!capability())throw fail('La eliminación conjunta de Compras aún no está habilitada.',503);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','orderKey','expectedHash'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Solicitud de compra inválida.',400);key(body.orderKey);if(new URL(req.url,'http://fixture.invalid').search)throw fail('La eliminación no admite parámetros.',400);
  const checked=await access(req,path=>store.read(path)),actor=checked.actor;
  const result=await guard.run({uid:actor.uid,claims:actor.claims,role:checked.role,permissionRevision:checked.permissionRevision,permissionDigest:checked.permissionDigest,mode:'command',financialAction:'ordenes.eliminar',recoverReceipt:true,opId:body.id,transportDigest:digest(body),operation:'purchase-order-delete',input:body},async scope=>{
   const current=await access(req,scope.get,actor);if(digest({profile:current.profile,cfg:current.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');
   const visible=await store.readAsUser('sisventas/ordenes/'+body.orderKey,actor);if(!visible||digest(baseOrder(visible))!==body.expectedHash)throw fail('No se pudo confirmar el acceso a la orden.');const initial=await plan(scope.get,body,{query:scope.query,queryPage,access:current});
   scope.beforeCommit(async({readFresh,queryFresh,queryPageFresh})=>{const fresh=await access(req,readFresh,actor);if(digest({profile:fresh.profile,cfg:fresh.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');if(initial.sources)await initial.sources.assertFresh(readFresh);const final=await plan(readFresh,body,{query:queryFresh,queryPage:queryPageFresh||queryPage,access:fresh});if(digest(final.result)!==digest(initial.result))throw fail('La compra o el stock cambió. No se guardaron cambios.');if(referenceEnabled)await assertAdmission({read:readFresh,phase:'delete-commit',identity:fresh});const finalAuth=await access(req,readFresh,actor);if(digest(finalAuth)!==digest(checked))throw fail('La sesión cambió antes de confirmar.');});
   await scope.update(initial.result.patch);return {ok:true,committed:true,orderKey:body.orderKey};
  });
  if(result?.committed!==true)throw fail('No se confirmó la eliminación. Consultá la operación antes de repetirla.',503);
  return {ok:true,committed:true,orderKey:body.orderKey};
 }
 return {handle,capability};
}
module.exports={createPurchaseOrderDelete};
