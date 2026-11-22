'use strict';
// Internal dependency injection only. No HTTP/body callback, no mapping authority.
const {digest}=require('./labor-guard'),{key,reference}=require('./purchase-inventory-model');
const History=require('./purchase-inventory-history');
function createReferencePort({resolveReference}={}){
 if(typeof resolveReference!=='function')throw TypeError('Falta resolver autoritativo interno.');
 async function resolve(items,{read,query,sourceOrder,access,queryPage}={}){
  if(!Array.isArray(items)||typeof read!=='function'||typeof query!=='function')throw TypeError('Faltan originales y consultas acotadas.');
  const references=Object.create(null),requests=[],resolutions=[],seen=new Map();
  for(const item of items){const identity=key(item.productoKey||item.codigo),request=structuredClone(item);
   if(typeof request.source!=='string'||!/^sisventas\/(ordenes|listas_materiales)\/[^/]+$/.test(request.source)||typeof request.rowKey!=='string'||!request.rowKey)throw Error('Falta procedencia del renglón original de servidor.');
   if(seen.has(identity)){const previous=seen.get(identity);if(previous.productoKey!==request.productoKey||previous.codigo!==request.codigo||previous.cod!==request.cod)throw Error('Aliases contradictorios en la compra.');}seen.set(identity,request);requests.push(request);
   if(!sourceOrder||!Array.isArray(sourceOrder.items)||!/^\d+$/.test(request.rowKey)||digest(sourceOrder.items[Number(request.rowKey)])!==digest(Object.fromEntries(Object.entries(request).filter(([name])=>!['source','rowKey'].includes(name)))))throw Error('El renglón no coincide con el documento original.');
   const resolved=structuredClone(reference(await call(request,read,query,queryPage)));resolutions.push(resolved);
   if(references[identity]&&['productKey','inventoryKey','receiptIdentityKey'].some(field=>references[identity][field]!==resolved[field]))throw Error('El material tiene vínculos contradictorios.');
   if(!references[identity])references[identity]=resolved;
  }
  const expected=digest(resolutions);
  async function call(request,phaseRead,phaseQuery,phaseQueryPage){const selector=Number(request.rowKey),sourcePath=request.source;return resolveReference({purpose:'purchase',path:sourcePath,selector,record:structuredClone(sourceOrder),expectedOriginalHash:digest(sourceOrder)},{read:phaseRead,query:phaseQuery,queryPage:phaseQueryPage,access,identifyOriginal:(stored,index,ports)=>History.identifyOriginal(stored,index,{...ports,sourcePath}),legacy:stored=>History.legacy(stored,selector,{read:phaseRead,query:phaseQuery,sourcePath})});}
  return {references,resolutions:structuredClone(resolutions),assertFresh:async({readFresh,queryFresh,queryPageFresh})=>{
   const fresh=[];for(const request of requests)fresh.push(reference(await call(request,readFresh,queryFresh,queryPageFresh)));
   if(digest(fresh)!==expected)throw Object.assign(Error('El vínculo de inventario cambió. Actualizá la compra.'),{code:'SV_PURCHASE_REFERENCE_CHANGED',statusCode:409});
  }};
 }
 return {resolve};
}
module.exports={createReferencePort};
