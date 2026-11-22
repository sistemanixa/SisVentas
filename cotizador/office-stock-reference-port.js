'use strict';
const Reference=require('./office-stock-reference'),Directed=require('./office-stock-directed-coverage'),IO=require('./office-stock-reference-io'),{loadSnapshot}=require('./office-stock-link-command');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
const ordered=map=>[...map].sort(([a],[b])=>a<b?-1:a>b?1:0);
async function assertFresh(readSet,read,query,queryPage){
 if(readSet.some(entry=>entry.kind==='query'&&typeof query!=='function'||entry.kind==='range'&&typeof queryPage!=='function'))throw fail('SV_STOCK_REFERENCE_CONFLICT','Falta revalidar la consulta de referencias.');
 const phase=typeof queryPage==='function'?IO.createReferencePhase({queryPage}):null;
 await IO.mapOrdered(readSet,async entry=>{const current=entry.kind==='range'?await phase.queryPage(entry.path,entry.options):entry.kind==='query'?await IO.read(()=>query(entry.path,entry.field,entry.value)):await IO.read(()=>read(entry.path));if(Reference.digest(current)!==entry.hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La referencia de stock cambió antes de confirmar.');});
}
function createReferenceResolver({enabled=false,loadCoverage,queryPage:factoryQuery}={}){
 return async function resolveReference(original,ports){
  if(typeof ports?.legacy!=='function')throw fail('SV_STOCK_REFERENCE_LEGACY','Falta el recorrido original del dominio.');
  if(enabled!==true)return ports.legacy(original?.record??original);
  if(!original||Object.keys(original).some(key=>!['purpose','path','selector','record','expectedOriginalHash'].includes(key))||!['stock','purchase','ot'].includes(original.purpose)||typeof ports.read!=='function'||typeof ports.identifyOriginal!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Falta verificar el original de servidor.');
  const source=original.path?.match(/^sisventas\/(inventario_operativo|ordenes|listas_materiales|ordenes_trabajo)\/([A-Za-z0-9_-]{1,128})$/),domains={stock:['inventario_operativo'],purchase:['ordenes','listas_materiales'],ot:['ordenes_trabajo']};
  if(!source||!Reference.key(source[2])||!domains[original.purpose].includes(source[1])||original.selector!==undefined&&!(Reference.key(original.selector)||Number.isInteger(original.selector)&&original.selector>=0))throw fail('SV_STOCK_REFERENCE_INPUT','Original fuera del dominio autorizado.');
  const cache=new Map(),queries=new Map(),identityReads=new Set(),read=async path=>{if(!cache.has(path)){const value=await ports.read(path);cache.set(path,structuredClone(value));await ports.track?.(path,structuredClone(value));}return structuredClone(cache.get(path));},query=async(path,field,value)=>{if(typeof ports.query!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta el lector de historia.');const id=Reference.digest({path,field,value});if(!queries.has(id)){const result=await ports.query(path,field,value);queries.set(id,{kind:'query',path,field,value,hash:Reference.digest(result),result:structuredClone(result)});await ports.trackQuery?.(path,field,value,structuredClone(result));}return structuredClone(queries.get(id).result);};
  const stored=await read(original.path);if(!stored||original.expectedOriginalHash&&Reference.digest(stored)!==original.expectedOriginalHash||original.record!==undefined&&Reference.digest(original.record)!==Reference.digest(stored))throw fail('SV_STOCK_REFERENCE_CONFLICT','El original cambió o ya no existe.');
  const identity=await ports.identifyOriginal(structuredClone(stored),original.selector,{read:async path=>{identityReads.add(path);return read(path);},query});
  const history=identity?.history;if(!identity||!Reference.key(identity.inventoryKey)||identity.productKey!=null&&!Reference.key(identity.productKey)||!['confirmed','absent'].includes(history?.kind)||history.sourceHash!==Reference.digest(stored)||!Array.isArray(history.verifiedReads)||!history.verifiedReads.length||history.verifiedReads.some(path=>!identityReads.has(path))||history.kind==='confirmed'&&!Reference.key(identity.receiptIdentityKey)||history.kind==='absent'&&identity.receiptIdentityKey!=null)throw fail('SV_STOCK_REFERENCE_IDENTITY','No se pudo verificar la evidencia histórica del original.');
  const lookupKeys=[...new Set([identity.inventoryKey,identity.productKey,...(identity.aliases||[])].filter(value=>value!==undefined&&value!==null))];if(lookupKeys.length>32||lookupKeys.some(key=>!Reference.key(key)))throw fail('SV_STOCK_REFERENCE_IDENTITY','Referencias históricas ambiguas.');
  const mappings=[];for(const key of lookupKeys){const inverse=await read('sisventas/stock_vinculos/porInventario/'+key);if(inverse)mappings.push(inverse);const forward=await read('sisventas/stock_vinculos/porProducto/'+key);if(forward)mappings.push(forward);}
  const readSet=()=>[...ordered(cache).map(([path,value])=>({path,hash:Reference.digest(value)})),...ordered(queries).map(([,value])=>{const {result,...entry}=value;return entry;})];
  if(!mappings.length){const legacy=await ports.legacy(stored);return{...legacy,mappingRevision:0,mapped:false,readSet:readSet()};}
  if(mappings.some(record=>Reference.digest(record)!==Reference.digest(mappings[0])))throw fail('SV_STOCK_REFERENCE_AMBIGUOUS','Los alias históricos remiten a vínculos distintos.');
  const mapped=mappings[0],ledgerPath='sisventas/inventario_operativo/'+mapped.inventoryKey;if(!Reference.key(mapped.productKey)||!Reference.key(mapped.inventoryKey)||!history.verifiedReads.includes(ledgerPath)||history.kind==='confirmed'&&mapped.receiptIdentityKey!==identity.receiptIdentityKey)throw fail('SV_STOCK_REFERENCE_IDENTITY','El vínculo no conserva la identidad histórica verificada.');
  const ranges=new Map(),rawQuery=ports.referencePhase?.queryPage??ports.queryPage??factoryQuery;
  if(typeof rawQuery!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta cobertura dirigida del vínculo.');
  const onQuery=async(path,options,result)=>{const id=Reference.digest({path,options}),hash=Reference.digest(result);if(ranges.has(id)&&ranges.get(id).hash!==hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La consulta cambió durante la lectura.');ranges.set(id,{kind:'range',path,options:structuredClone(options),hash});await ports.trackQueryPage?.(path,structuredClone(options),structuredClone(result));};
  const coverage=loadCoverage??Directed.createDirectedCoverage({queryPage:rawQuery});
  const snapshot=await loadSnapshot({read,loadCoverage:coverage,queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery,productKey:mapped.productKey,inventoryKey:mapped.inventoryKey,access:ports.access??null}),reference=Reference.resolve(snapshot,mapped.inventoryKey);
  return{...reference,readSet:[...readSet(),...ordered(ranges).map(([,entry])=>entry)]};
 };
}
module.exports={createReferenceResolver,assertFresh};

// Stock starts from the canonical product, not from a historical OT/purchase
// row. Resolve the forward mapping before touching a physical ledger branch.
function createStockReferenceResolver({enabled=false,loadCoverage,queryPage:factoryQuery,assertBarrier}={}){
 const barrier=async(read,phase)=>{if(typeof assertBarrier!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta verificar la barrera de referencias de Stock.');await assertBarrier({read,phase});};
 return{assertFresh:async(readSet,read,query,queryPage)=>{if(enabled===true)await barrier(read,'stock-reference-fresh');return assertFresh(readSet,read,query,queryPage);},lookupInventory:async(inventoryKey,ports)=>{
  if(enabled!==true)return null;
  if(!Reference.key(inventoryKey)||typeof ports?.read!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Registro físico inválido.');
  await barrier(ports.read,'stock-list-reference');
  const inversePath='sisventas/stock_vinculos/porInventario/'+inventoryKey,inverse=await ports.read(inversePath);
  if(inverse===null)return null;
  if(!inverse||inverse.inventoryKey!==inventoryKey||!Reference.key(inverse.productKey)||!Reference.key(inverse.receiptIdentityKey)||!Number.isSafeInteger(inverse.revision)||inverse.revision<1)throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación inversa es inválida.');
  const forwardPath='sisventas/stock_vinculos/porProducto/'+inverse.productKey,forward=await ports.read(forwardPath),product=await ports.read('sisventas/productos/'+inverse.productKey);
  if(Reference.digest(forward)!==Reference.digest(inverse)||Reference.digest(await ports.read(inversePath))!==Reference.digest(inverse)||Reference.digest(await ports.read(forwardPath))!==Reference.digest(forward))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación y su inversa cambiaron.');
  // Advisory lookup only: no coverage proof or write readSet is issued.
  if(Reference.productStatus(product)!=='active')throw fail('SV_STOCK_REFERENCE_PRODUCT','El producto está inactivo.');
  await barrier(ports.read,'stock-list-reference-fresh');
  return{productKey:inverse.productKey,product,reference:{productKey:inverse.productKey,inventoryKey,receiptIdentityKey:inverse.receiptIdentityKey,mappingRevision:inverse.revision,mapped:true}};
 },resolve:async({productKey,product},ports)=>{
  if(typeof ports?.legacy!=='function')throw fail('SV_STOCK_REFERENCE_LEGACY','Falta el recorrido original de Stock.');
  if(enabled!==true)return ports.legacy(ports.read);
  if(!Reference.key(productKey)||typeof ports.read!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Producto de Stock inválido.');
  await barrier(ports.read,'stock-reference');
  const cache=new Map(),ranges=new Map(),read=async path=>{if(!cache.has(path))cache.set(path,structuredClone(await ports.read(path)));return structuredClone(cache.get(path));};
  const actual=await read('sisventas/productos/'+productKey);if(!actual||Reference.digest(actual)!==Reference.digest(product))throw fail('SV_STOCK_REFERENCE_CONFLICT','El producto cambió antes de resolver Stock.');
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey),readSet=()=>[...ordered(cache).map(([path,value])=>({path,hash:Reference.digest(value)})),...ordered(ranges).map(([,entry])=>entry)];
  if(!forward){
   const aliases=[...new Set([productKey,actual.id,actual.codigo,actual.cod].filter(value=>value!==null&&value!==undefined&&String(value)!=='').map(value=>String(value).replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)).filter(Reference.key))];
   for(const key of aliases)if(await read('sisventas/stock_vinculos/porInventario/'+key))throw fail('SV_STOCK_REFERENCE_MAPPING','Existe una asociación inversa sin vínculo canónico.');
   const legacy=await ports.legacy(read);return{...legacy,reference:{productKey,inventoryKey:legacy.inventoryKey,receiptIdentityKey:null,mappingRevision:0,mapped:false},readSet:readSet()};
  }
  if(forward.productKey!==productKey||!Reference.key(forward.inventoryKey))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación de Stock es inválida.');
  const rawQuery=ports.referencePhase?.queryPage??ports.queryPage??factoryQuery;if(typeof rawQuery!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta cobertura dirigida de Stock.');
  const onQuery=async(path,options,result)=>{const id=Reference.digest({path,options}),hash=Reference.digest(result);if(ranges.has(id)&&ranges.get(id).hash!==hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La consulta cambió durante la lectura de Stock.');ranges.set(id,{kind:'range',path,options:structuredClone(options),hash});};
  const snapshot=await loadSnapshot({read,loadCoverage:loadCoverage??Directed.createDirectedCoverage({queryPage:rawQuery}),queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery,productKey,inventoryKey:forward.inventoryKey}),reference=Reference.resolve(snapshot,forward.inventoryKey);
  return{inventoryKey:reference.inventoryKey,inventory:snapshot.inventory[reference.inventoryKey],reference,readSet:readSet()};
 }};
}
module.exports.createStockReferenceResolver=createStockReferenceResolver;
