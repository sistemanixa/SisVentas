'use strict';
const {digest}=require('./labor-guard'),Model=require('./purchase-order-delete-model'),Money=require('./commercial-models/commercial-money');
const authorities=new WeakSet();
const configPaths=Object.freeze(['sv_labor_config','sv_operational_read_config','sv_commercial_pages_config','sv_client_accounts_config']);
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_MANUAL_REVIEW_REQUIRED',statusCode:409});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function configsHash(configs){
 const rows=configPaths.map(p=>configs[p]);
 if(rows.some(v=>v?.schema!==1||v.ready!==true)||rows[0].writerSchema!==2||![undefined,false].includes(rows[0].sdkAdmissionPaused)||rows[2].nativeCollectionsReady!==true||rows[2].nativeCollectionsSchema!==1)throw fail('La coordinación de Compras no está lista.');
 return digest(rows);
}
function analyze({orders,orderKey,protectedOrderKey,inventoryByKey,legacyExclusions={}}){
 if(!key(orderKey)||!key(protectedOrderKey)||orderKey===protectedOrderKey||!orders||Array.isArray(orders)||typeof orders!=='object'||Object.keys(orders).length>256||Buffer.byteLength(JSON.stringify(orders))>2*1024*1024)throw fail('Hace falta una captura completa y acotada de las órdenes.');
 const target=orders[orderKey],protectedOrder=orders[protectedOrderKey];
 if(!target||target.origen!=='manual'||target.estado!=='borrador'||!Array.isArray(target.items)||!target.items.length||target.ventaId||target.ventaFbKey||target.listaMaterialesId||target.legacyKey||target.recepcionPendiente||target.cancelacionPendiente||target.generacionPendiente||target.recepciones!=null&&(!Array.isArray(target.recepciones)||target.recepciones.length))throw fail('Sólo se admite un borrador manual independiente sin recepciones.');
 if(!protectedOrder||protectedOrder.estado!=='recibida'||!Array.isArray(protectedOrder.items))throw fail('Falta la compra recibida que debe conservarse.');
 const products=new Map(),quantity=v=>{if(v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0)throw fail('Hay cantidades pendientes que requieren revisión.');return Number(v);};
 for(const i of target.items){const raw=i.productoKey||i.codigo;if(!key(raw)||quantity(i.cantidadRecibida??0)!==0||quantity(i.cantidadOrdenada??i.cantidad)<=0)throw fail('El borrador no tiene materiales pendientes válidos.');const p=Model.inventoryKey(raw);if(products.has(p)&&products.get(p).raw!==raw)throw fail('Las identidades del producto son ambiguas.');products.set(p,{raw,code:i.codigo,pending:0,after:0,protected:0});}
 if(!legacyExclusions||typeof legacyExclusions!=='object'||Array.isArray(legacyExclusions)||Object.keys(legacyExclusions).some(k=>!key(k)||!orders[k]||k===orderKey||k===protectedOrderKey))throw fail('Las excepciones históricas requieren revisión individual.');
 for(const [k,order]of Object.entries(orders)){
  if(Object.hasOwn(legacyExclusions,k)){
   const evidence=legacyExclusions[k];
   if(!order||order.items!=null||order.productoKey||order.codigo||order.ventaFbKey||order.listaMaterialesId||order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente||!evidence||Object.keys(evidence).sort().join(',')!=='description,sourceHash'||typeof evidence.description!=='string'||!evidence.description.trim()||order.descripcion!==evidence.description||digest(order)!==evidence.sourceHash)throw fail('La orden histórica cambió o no coincide con su revisión.');
   continue;
  }
  if(!key(k)||!order||typeof order!=='object'||!Array.isArray(order.items))throw fail('La captura de órdenes está incompleta.');
  for(const item of order.items){const raw=item?.productoKey||item?.codigo;if(!raw)throw fail('Hay un material sin identidad en la captura.');const p=Model.inventoryKey(raw),v=products.get(p)||[...products.values()].find(x=>x.code&&x.code===item.codigo);if(!v)continue;
   if(v.raw!==raw||order.recepcionPendiente||order.cancelacionPendiente||order.generacionPendiente||!['borrador','enviada','recepcion_parcial','recibida','cancelada'].includes(order.estado))throw fail('Hay identidades o movimientos pendientes de completar.');
   const ordered=quantity(item.cantidadOrdenada??item.cantidad),received=quantity(item.cantidadRecibida??0);if(received>ordered||order.estado==='recibida'&&received!==ordered)throw fail('Una recepción no coincide con la orden original.');
   if(k===protectedOrderKey)v.protected=Money.quantitySum([v.protected,received]);
   if(order.estado!=='cancelada'){const pending=Money.quantitySum([ordered,-received]);v.pending=Money.quantitySum([v.pending,pending]);if(k!==orderKey)v.after=Money.quantitySum([v.after,pending]);}
  }
 }
 const result=Model.prepareOrderDeletion({order:{...target,fbKey:orderKey},inventoryByKey});
 for(const [p,v]of products){const before=inventoryByKey[p],after=result.patch['sisventas/inventario_operativo/'+p];if(v.protected<=0||!before||quantity(before.enCompra)!==v.pending||!after||after.enCompra!==v.after)throw fail('En compra no coincide con las órdenes vigentes. No se cambió el stock.');const unchanged={...after,enCompra:before.enCompra};if(digest(unchanged)!==digest(before))throw fail('La operación cambiaría stock físico o reservas.');}
 if(Object.keys(result.patch).length!==products.size+1)throw fail('La operación excede el borrador revisado.');
 return {...result,reconciliation:[...products].map(([productKey,v])=>({productKey,before:v.pending,after:v.after})),sourceHash:digest(orders),protectedHash:digest(protectedOrder)};
}
function prepare({orders,orderKey,protectedOrderKey,inventoryByKey,configs,expiresAt,legacyExclusions={}}){
 const plan=analyze({orders,orderKey,protectedOrderKey,inventoryByKey,legacyExclusions});if(!Number.isSafeInteger(expiresAt))throw fail('Falta la vigencia de la revisión.');
 const review={schema:1,kind:'manual-pending-reconciliation',orderKey,protectedOrderKey,configsHash:configsHash(configs),sourceHash:plan.sourceHash,inventoryHash:digest(inventoryByKey),planHash:digest(plan),expiresAt,legacyExclusions:structuredClone(legacyExclusions)};
 return {review,reviewJson:JSON.stringify(review),reviewSha256:digest(review),reconciliation:plan.reconciliation,activationAuthorized:false};
}
function create({env=process.env,runtime,now=Date.now}){
 let reviewed;try{const text=env.PURCHASE_MANUAL_DELETE_REVIEW_JSON||'null';if(text.length>16384)throw fail('Revisión demasiado grande.');const r=JSON.parse(text),fields=['schema','kind','orderKey','protectedOrderKey','configsHash','sourceHash','inventoryHash','planHash','expiresAt','legacyExclusions'];if(env.PURCHASE_MANUAL_DELETE_READY==='true'&&r&&Object.keys(r).length===fields.length&&fields.every(k=>Object.hasOwn(r,k))&&r.schema===1&&r.kind==='manual-pending-reconciliation'&&key(r.orderKey)&&key(r.protectedOrderKey)&&r.orderKey!==r.protectedOrderKey&&r.legacyExclusions&&typeof r.legacyExclusions==='object'&&!Array.isArray(r.legacyExclusions)&&['configsHash','sourceHash','inventoryHash','planHash'].every(k=>/^[a-f0-9]{64}$/.test(r[k]))&&Number.isSafeInteger(r.expiresAt)&&digest(r)===env.PURCHASE_MANUAL_DELETE_REVIEW_SHA256)reviewed=r;}catch{/* closed */}
 const configured=()=>{const s=runtime();return!!reviewed&&now()<reviewed.expiresAt&&s.coordinated===true&&s.readOnly===false&&s.commercialPages===true&&s.clientAccounts===true&&s.operationalSummaries===true;};
 const assertTarget=k=>{if(!reviewed||k!==reviewed.orderKey)throw fail('La orden no está incluida en esta revisión.');};
 async function assertCurrent(read){if(!configured())throw fail('La revisión de esta compra no está habilitada o venció.');const configs=Object.fromEntries(await Promise.all(configPaths.map(async p=>[p,await read(p)])));if(configsHash(configs)!==reviewed.configsHash)throw fail('La configuración revisada cambió.');}
 async function plan({read,order,inventoryByKey}){await assertCurrent(read);assertTarget(order.fbKey);const orders=await read('sisventas/ordenes');if(digest(orders)!==reviewed.sourceHash||digest(orders?.[order.fbKey])!==digest((({fbKey,...r})=>r)(order))||digest(inventoryByKey)!==reviewed.inventoryHash)throw fail('Las órdenes o el inventario cambiaron. Hay que repetir la revisión.');const result=analyze({orders,orderKey:reviewed.orderKey,protectedOrderKey:reviewed.protectedOrderKey,inventoryByKey,legacyExclusions:reviewed.legacyExclusions});if(digest(result)!==reviewed.planHash)throw fail('La conciliación cambió.');return result;}
 const api=Object.freeze({configured,assertCurrent,assertTarget,plan});authorities.add(api);return api;
}
module.exports={analyze,prepare,create,configPaths,isReview:r=>authorities.has(r)};
