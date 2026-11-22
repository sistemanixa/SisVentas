'use strict';
// Internal dependency injection only. No HTTP/body callback, no mapping authority.
const {digest}=require('./labor-guard'),{key,reference}=require('./purchase-inventory-model');
function createReferencePort({resolveReference}={}){
 if(typeof resolveReference!=='function')throw TypeError('Falta resolver autoritativo interno.');
 async function resolve(items,{read,query}={}){
  if(!Array.isArray(items)||typeof read!=='function'||typeof query!=='function')throw TypeError('Faltan originales y consultas acotadas.');
  const references=Object.create(null),requests=[],resolutions=[],seen=new Map();
  for(const item of items){const identity=key(item.productoKey||item.codigo),request=structuredClone(item);
   if(typeof request.source!=='string'||!/^sisventas\/(ordenes|listas_materiales)\/[^/]+$/.test(request.source)||typeof request.rowKey!=='string'||!request.rowKey)throw Error('Falta procedencia del renglón original de servidor.');
   if(seen.has(identity)){const previous=seen.get(identity);if(previous.productoKey!==request.productoKey||previous.codigo!==request.codigo||previous.cod!==request.cod)throw Error('Aliases contradictorios en la compra.');}seen.set(identity,request);requests.push(request);
   const resolved=structuredClone(reference(await resolveReference(structuredClone(request),{read,query})));resolutions.push(resolved);
   if(references[identity]&&['productKey','inventoryKey','receiptIdentityKey'].some(field=>references[identity][field]!==resolved[field]))throw Error('El material tiene vínculos contradictorios.');
   if(!references[identity])references[identity]=resolved;
  }
  const expected=digest(resolutions);
  return {references,resolutions:structuredClone(resolutions),assertFresh:async({readFresh,queryFresh})=>{
   const fresh=[];for(const request of requests)fresh.push(reference(await resolveReference(structuredClone(request),{read:readFresh,query:queryFresh})));
   if(digest(fresh)!==expected)throw Object.assign(Error('El vínculo de inventario cambió. Actualizá la compra.'),{code:'SV_PURCHASE_REFERENCE_CHANGED',statusCode:409});
  }};
 }
 return {resolve};
}
module.exports={createReferencePort};
