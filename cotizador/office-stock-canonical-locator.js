'use strict';
// Read-only helper scoped to one actual OT source row. It is not a history
// classification or write capability and never falls back to a code match.
const Reference=require('./office-stock-reference'),Explicit=require('./office-stock-explicit-reference');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
function create({original,stored,read,mappedAdmission}){
 let pending;
 return()=>pending??=(async()=>{
  if(!Explicit.isMappedAdmission(mappedAdmission))throw fail('SV_STOCK_MAPPED_NOT_READY','Falta la admisión firmada del localizador.');
  if(original?.purpose!=='ot'||!/^sisventas\/ordenes_trabajo\/[A-Za-z0-9_-]{1,128}$/.test(original.path||''))return null;
  const match=typeof original.selector==='string'&&/^items_(0|[1-9][0-9]*)$/.exec(original.selector),field=Number.isInteger(original.selector)?'materiales':match?'items':null,index=field==='materiales'?original.selector:match?Number(match[1]):-1;
  if(!field||!Number.isSafeInteger(index)||index<0||!Array.isArray(stored?.[field]))return null;
  if(Reference.digest(await read(original.path))!==Reference.digest(stored))throw fail('SV_STOCK_REFERENCE_CONFLICT','El original del localizador cambió.');
  const row=stored[field][index];if(!row||typeof row!=='object'||Array.isArray(row))throw fail('SV_STOCK_REFERENCE_IDENTITY','No se identificó la fila original.');
  const keys=['productoKey','productKey'].map(name=>row[name]).filter(value=>value!==null&&value!==undefined&&value!=='');
  if(!keys.length)return null;
  if(keys.some(value=>!Reference.key(value))||new Set(keys).size!==1)throw fail('SV_STOCK_REFERENCE_IDENTITY','El original tiene referencias canónicas contradictorias.');
  const productKey=keys[0];await mappedAdmission.admit({read});
  const product=await read('sisventas/productos/'+productKey);if(product===null)return null;
  if(Reference.productStatus(product)!=='active'||product.fbKey!==undefined&&product.fbKey!==productKey)throw fail('SV_STOCK_REFERENCE_PRODUCT','El producto original no admite el localizador canónico.');
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey);let resolved;
  if(forward){if(forward.productKey!==productKey)throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación no pertenece al producto original.');resolved=await Explicit.resolveMapped({mappedAdmission,record:forward,read});}
  else{
   if(await read('sisventas/stock_vinculos/porInventario/'+productKey)!==null)throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación inversa requiere revisar su original.');
   if(await read('sisventas/inventario_operativo/'+productKey)===null)return null;
   resolved=await Explicit.resolveUnmapped({mappedAdmission,productKey,read});
  }
  for(const [field,expected]of [['inventoryKey',resolved.reference.inventoryKey],['receiptIdentityKey',resolved.reference.receiptIdentityKey]])if(row[field]!==null&&row[field]!==undefined&&row[field]!==''&&(!Reference.key(row[field])||row[field]!==expected))throw fail('SV_STOCK_REFERENCE_IDENTITY','El original contradice la identidad física o histórica verificada.');
  return{reference:structuredClone(resolved.reference),product:structuredClone(resolved.product),inventory:structuredClone(resolved.inventory),ledgerPath:'sisventas/inventario_operativo/'+resolved.reference.inventoryKey,sourceHash:Reference.digest(stored),selector:original.selector};
 })();
}
module.exports={create};
