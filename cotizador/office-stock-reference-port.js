'use strict';
const Reference=require('./office-stock-reference'),{loadSnapshot}=require('./office-stock-link-command');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
async function assertFresh(readSet,read){for(const entry of readSet)if(Reference.digest(await read(entry.path))!==entry.hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La referencia de stock cambió antes de confirmar.');}
function createReferenceResolver({enabled=false,loadCoverage}={}){
 return async function resolveReference(original,ports){
  if(typeof ports?.legacy!=='function')throw fail('SV_STOCK_REFERENCE_LEGACY','Falta el recorrido original del dominio.');
  if(enabled!==true)return ports.legacy(original?.record??original);
  if(!original||Object.keys(original).some(key=>!['purpose','path','selector','record','expectedOriginalHash'].includes(key))||!['stock','purchase','ot'].includes(original.purpose)||typeof ports.read!=='function'||typeof ports.identifyOriginal!=='function'||typeof loadCoverage!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Falta verificar el original de servidor.');
  const source=original.path?.match(/^sisventas\/(inventario_operativo|ordenes|listas_materiales|ordenes_trabajo)\/([A-Za-z0-9_-]{1,128})$/),domains={stock:['inventario_operativo'],purchase:['ordenes','listas_materiales'],ot:['ordenes_trabajo']};
  if(!source||!Reference.key(source[2])||!domains[original.purpose].includes(source[1])||original.selector!==undefined&&!(Reference.key(original.selector)||Number.isInteger(original.selector)&&original.selector>=0))throw fail('SV_STOCK_REFERENCE_INPUT','Original fuera del dominio autorizado.');
  const cache=new Map(),read=async path=>{if(!cache.has(path)){const value=await ports.read(path);cache.set(path,structuredClone(value));await ports.track?.(path,structuredClone(value));}return structuredClone(cache.get(path));};
  const stored=await read(original.path);if(!stored||original.expectedOriginalHash&&Reference.digest(stored)!==original.expectedOriginalHash||original.record!==undefined&&Reference.digest(original.record)!==Reference.digest(stored))throw fail('SV_STOCK_REFERENCE_CONFLICT','El original cambió o ya no existe.');
  const identity=await ports.identifyOriginal(structuredClone(stored),original.selector);if(!identity||!Reference.key(identity.inventoryKey)||!Reference.key(identity.receiptIdentityKey)||identity.productKey!=null&&!Reference.key(identity.productKey))throw fail('SV_STOCK_REFERENCE_IDENTITY','No se pudo verificar la identidad histórica del original.');
  const evidence={},lookup=await loadCoverage({phase:'consumer-lookup',source:original.path,identity:structuredClone(identity),read:async path=>{if(typeof path!=='string'||!/^sv_stock_reference_(?:index|config)(?:\/|$)/.test(path)||path.includes('..'))throw fail('SV_STOCK_REFERENCE_COVERAGE','Cobertura fuera de contrato.');const value=await read(path);evidence[path]=value;return value;}});
  if(!lookup||lookup.schema!==1||!Reference.key(lookup.generation)||['catalog','inventory','links','owners','receiptIdentity'].some(key=>lookup.coverage?.[key]!==true)||!Object.keys(evidence).length)throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta verificar la ausencia o presencia del vínculo.');
  const lookupKeys=[...new Set([identity.inventoryKey,identity.productKey,...(identity.aliases||[])].filter(value=>value!==undefined&&value!==null))];if(lookupKeys.length>32||lookupKeys.some(key=>!Reference.key(key)))throw fail('SV_STOCK_REFERENCE_IDENTITY','Referencias históricas ambiguas.');
  const mappings=[];for(const key of lookupKeys){const inverse=await read('sisventas/stock_vinculos/porInventario/'+key);if(inverse)mappings.push(inverse);const forward=await read('sisventas/stock_vinculos/porProducto/'+key);if(forward)mappings.push(forward);}
  const readSet=()=>[...cache].map(([path,value])=>({path,hash:Reference.digest(value)}));
  if(!mappings.length){const legacy=await ports.legacy(stored);return{...legacy,mappingRevision:0,mapped:false,readSet:readSet()};}
  if(mappings.some(record=>Reference.digest(record)!==Reference.digest(mappings[0])))throw fail('SV_STOCK_REFERENCE_AMBIGUOUS','Los alias históricos remiten a vínculos distintos.');
  const mapped=mappings[0];if(!Reference.key(mapped.productKey)||!Reference.key(mapped.inventoryKey)||mapped.receiptIdentityKey!==identity.receiptIdentityKey)throw fail('SV_STOCK_REFERENCE_IDENTITY','El vínculo no conserva la identidad histórica verificada.');
  const snapshot=await loadSnapshot({read,loadCoverage,productKey:mapped.productKey,inventoryKey:mapped.inventoryKey,access:ports.access??null}),reference=Reference.resolve(snapshot,mapped.inventoryKey);
  return{...reference,readSet:readSet()};
 };
}
module.exports={createReferenceResolver,assertFresh};
