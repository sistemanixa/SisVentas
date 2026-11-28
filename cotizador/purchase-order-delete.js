'use strict';
const {digest}=require('./labor-guard'),Model=require('./purchase-order-delete-model'),{pool}=require('./payment-snapshot');
const fail=(message,statusCode=409)=>Object.assign(Error(message),{code:'SV_PURCHASE_DELETE_BLOCKED',statusCode});
const key=value=>{if(typeof value!=='string'||!value||['__proto__','prototype','constructor'].includes(value)||value.length>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail('Referencia de compra inválida.',400);return value;};
const baseOrder=value=>{const copy=structuredClone(value);if(copy)delete copy.fbKey;return copy;};
function createPurchaseOrderDelete({authorize,store,guard,review,enabled=false,operation='delete'}){
 if(!['delete','cancel'].includes(operation)||operation==='cancel'&&(!require('./purchase-draft-delete-policy').isPolicy(review)||review.operation!=='cancel'))throw Error('Operación de Compras inválida.');
 const userPolicy=()=>require('./purchase-manual-delete-review').isReview(review)||require('./purchase-draft-delete-policy').isPolicy(review);
 const configured=()=>enabled===true&&guard?.clientAccounts===true&&(guard?.clientHistory===true||userPolicy())&&review?.configured()===true;
 async function capability(){
  if(!configured())return false;
  try{await review.assertCurrent(store.read);return true;}catch{return false;}
 }
 async function access(req,read,expected){const actor=await authorize(req);if(!actor?.uid||actor.uid!==actor.claims?.uid||expected&&actor.uid!==expected.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid)throw fail('La sesión cambió.',403);const profile=await read('sv_chat_roles/'+key(actor.uid)),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid),override=cfg?.acciones?.ordenes?.eliminar;
  if(profile?.activo!==true||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordenes!==true||Object.values(cfg.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:profile.rol!=='admin')||actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail('No tenés permiso para eliminar esta orden.',403);
  return {actor,profile,cfg,role:profile.rol,permissionRevision:cfg.indiceRevision??null,permissionDigest:digest(cfg)};
 }
 async function plan(read,body){const path='sisventas/ordenes/'+body.orderKey,original=await read(path);if(!original||original.fbKey!=null&&original.fbKey!==body.orderKey||digest(baseOrder(original))!==body.expectedHash)throw fail('La orden cambió. Volvé a abrirla antes de eliminar.');const order={...original,fbKey:body.orderKey},inventoryByKey=Object.create(null),points=new Set();if(order.ventaFbKey)points.add('sisventas/ventas/'+key(order.ventaFbKey));if(order.listaMaterialesId)points.add('sisventas/listas_materiales/'+key(order.listaMaterialesId));for(const item of order.items||[]){const raw=item.productoKey||item.codigo;if(!raw)throw fail('Falta identificar un material.');points.add('sisventas/inventario_operativo/'+Model.inventoryKey(raw));}const values=new Map();await pool([...points],async path=>{values.set(path,await read(path));});for(const [path,value]of values)if(path.startsWith('sisventas/inventario_operativo/'))inventoryByKey[path.split('/').at(-1)]=value;const sale=order.ventaFbKey?values.get('sisventas/ventas/'+order.ventaFbKey):null,list=order.listaMaterialesId?values.get('sisventas/listas_materiales/'+order.listaMaterialesId):null;
  return review.plan({read,order,inventoryByKey,sale,list});
 }
 async function handle(req,body){if(req.method!=='POST')throw fail('Método no permitido.',405);if(!configured())throw fail('La eliminación conjunta de Compras aún no está habilitada.',503);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!(operation==='cancel'?['id','orderKey','expectedHash','operation']:['id','orderKey','expectedHash']).includes(k))||operation==='cancel'&&body.operation!=='cancel'||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail('Solicitud de compra inválida.',400);key(body.orderKey);if(new URL(req.url,'http://fixture.invalid').search)throw fail('La eliminación no admite parámetros.',400);
  const checked=await access(req,path=>store.read(path)),actor=checked.actor;
  review.assertTarget(body.orderKey);
  await review.assertCurrent(store.read);
  const result=await guard.run({uid:actor.uid,claims:actor.claims,role:checked.role,permissionRevision:checked.permissionRevision,permissionDigest:checked.permissionDigest,mode:userPolicy()?'user':'command',financialAction:'ordenes.eliminar',recoverReceipt:true,opId:body.id,transportDigest:digest(body),operation:operation==='cancel'?'purchase-order-cancel':'purchase-order-delete',input:body},async scope=>{
   const current=await access(req,scope.get,actor);if(digest({profile:current.profile,cfg:current.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');
   const visible=await store.readAsUser('sisventas/ordenes/'+body.orderKey,actor);if(!visible||digest(baseOrder(visible))!==body.expectedHash)throw fail('No se pudo confirmar el acceso a la orden.');const initial=await plan(scope.get,body);
   scope.beforeCommit(async({readFresh})=>{const fresh=await access(req,readFresh,actor);if(digest({profile:fresh.profile,cfg:fresh.cfg})!==digest({profile:checked.profile,cfg:checked.cfg}))throw fail('Los permisos cambiaron.');if(digest(await plan(readFresh,body))!==digest(initial))throw fail('La compra o el stock cambió. No se guardaron cambios.');});
   const patch=structuredClone(initial.patch);if(operation==='cancel'){const path='sisventas/ordenes/'+body.orderKey;patch[path]={...patch[path],anulacion:{uid:actor.uid,operacion:body.id,fecha:Date.now()}};}
   await scope.update(patch);return {ok:true,committed:true,orderKey:body.orderKey,...(operation==='cancel'?{cancelled:true}:{})};
  });
  if(result?.committed!==true||operation==='cancel'&&result.cancelled!==true)throw fail('No se confirmó la eliminación. Consultá la operación antes de repetirla.',503);
  return {ok:true,committed:true,orderKey:body.orderKey,...(operation==='cancel'?{cancelled:true}:{})};
 }
 return {handle,capability};
}
module.exports={createPurchaseOrderDelete};
