'use strict';
const Reference=require('./office-stock-reference'),Directed=require('./office-stock-directed-coverage'),IO=require('./office-stock-reference-io'),Explicit=require('./office-stock-explicit-reference'),CanonicalLocator=require('./office-stock-canonical-locator'),{loadSnapshot}=require('./office-stock-link-command');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
const ordered=map=>[...map].sort(([a],[b])=>a<b?-1:a>b?1:0);
async function assertFresh(readSet,read,query,queryPage){
 if(readSet.some(entry=>entry.kind==='query'&&typeof query!=='function'||entry.kind==='range'&&typeof queryPage!=='function'))throw fail('SV_STOCK_REFERENCE_CONFLICT','Falta revalidar la consulta de referencias.');
 const phase=typeof queryPage==='function'?IO.createReferencePhase({queryPage}):null,point=IO.boundedRead(read);
 await IO.mapOrdered(readSet,async entry=>{const current=entry.kind==='range'?await phase.queryPage(entry.path,entry.options):entry.kind==='query'?await IO.read(()=>query(entry.path,entry.field,entry.value)):await point(entry.path);if(Reference.digest(current)!==entry.hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La referencia de stock cambió antes de confirmar.');});
}
function createReferenceResolver({enabled=false,loadCoverage,queryPage:factoryQuery,mappedAdmission=null}={}){
 return async function resolveReference(original,ports){
  if(typeof ports?.legacy!=='function')throw fail('SV_STOCK_REFERENCE_LEGACY','Falta el recorrido original del dominio.');
  if(enabled!==true)return ports.legacy(original?.record??original);
  if(!original||Object.keys(original).some(key=>!['purpose','path','selector','record','expectedOriginalHash'].includes(key))||!['stock','purchase','ot'].includes(original.purpose)||typeof ports.read!=='function'||typeof ports.identifyOriginal!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Falta verificar el original de servidor.');
  const source=original.path?.match(/^sisventas\/(inventario_operativo|ordenes|listas_materiales|ordenes_trabajo)\/([A-Za-z0-9_-]{1,128})$/),domains={stock:['inventario_operativo'],purchase:['ordenes','listas_materiales'],ot:['ordenes_trabajo']};
  if(!source||!Reference.key(source[2])||!domains[original.purpose].includes(source[1])||original.selector!==undefined&&!(Reference.key(original.selector)||Number.isInteger(original.selector)&&original.selector>=0))throw fail('SV_STOCK_REFERENCE_INPUT','Original fuera del dominio autorizado.');
  const points=IO.memoRead(ports.read,{onRead:async(path,value)=>ports.track?.(path,value)}),cache=points.values,queries=new Map(),identityReads=new Set(),read=points.read,query=async(path,field,value)=>{if(typeof ports.query!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta el lector de historia.');const id=Reference.digest({path,field,value});if(!queries.has(id)){const result=await IO.read(()=>ports.query(path,field,value));queries.set(id,{kind:'query',path,field,value,hash:Reference.digest(result),result:structuredClone(result)});await ports.trackQuery?.(path,field,value,structuredClone(result));}return structuredClone(queries.get(id).result);};
  const stored=await read(original.path);if(!stored||original.expectedOriginalHash&&Reference.digest(stored)!==original.expectedOriginalHash||original.record!==undefined&&Reference.digest(original.record)!==Reference.digest(stored))throw fail('SV_STOCK_REFERENCE_CONFLICT','El original cambió o ya no existe.');
  const identityRead=IO.memoRead(read,{onRead:path=>{identityReads.add(path);}}).read,locateCanonical=mappedAdmission!==null?CanonicalLocator.create({original,stored,read:identityRead,mappedAdmission}):null;
  const identity=await ports.identifyOriginal(structuredClone(stored),original.selector,{read:identityRead,query,...(locateCanonical?{locateCanonical}:{})});
  const history=identity?.history;if(!identity||!Reference.key(identity.inventoryKey)||identity.productKey!=null&&!Reference.key(identity.productKey)||!['confirmed','absent'].includes(history?.kind)||history.sourceHash!==Reference.digest(stored)||!Array.isArray(history.verifiedReads)||!history.verifiedReads.length||history.verifiedReads.some(path=>!identityReads.has(path))||history.kind==='confirmed'&&!Reference.key(identity.receiptIdentityKey)||history.kind==='absent'&&identity.receiptIdentityKey!=null)throw fail('SV_STOCK_REFERENCE_IDENTITY','No se pudo verificar la evidencia histórica del original.');
  const lookupKeys=mappedAdmission!==null?[]:[...new Set([identity.inventoryKey,identity.productKey,...(identity.aliases||[])].filter(value=>value!==undefined&&value!==null))];if(lookupKeys.length>32||lookupKeys.some(key=>!Reference.key(key)))throw fail('SV_STOCK_REFERENCE_IDENTITY','Referencias históricas ambiguas.');
  let mappings;
  if(mappedAdmission!==null){const inverse=await read('sisventas/stock_vinculos/porInventario/'+identity.inventoryKey);if(inverse)mappings=[inverse];else{const forward=identity.productKey?await read('sisventas/stock_vinculos/porProducto/'+identity.productKey):null;mappings=forward?[forward]:[];}}
  else{const lookupPaths=lookupKeys.flatMap(key=>['sisventas/stock_vinculos/porInventario/'+key,'sisventas/stock_vinculos/porProducto/'+key]);mappings=(await IO.mapOrdered(lookupPaths,path=>read(path))).filter(Boolean);}
  const readSet=()=>[...ordered(cache).map(([path,value])=>({path,hash:Reference.digest(value)})),...ordered(queries).map(([,value])=>{const {result,...entry}=value;return entry;})];
  const ranges=new Map(),rawQuery=ports.referencePhase?.queryPage??ports.queryPage??factoryQuery,onQuery=async(path,options,result)=>{const id=Reference.digest({path,options}),hash=Reference.digest(result);if(ranges.has(id)&&ranges.get(id).hash!==hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La consulta cambió durante la lectura.');ranges.set(id,{kind:'range',path,options:structuredClone(options),hash});await ports.trackQueryPage?.(path,structuredClone(options),structuredClone(result));};
  if(!mappings.length){
   if(mappedAdmission!==null){
    if(!Reference.key(identity.productKey)||identity.inventoryKey!==identity.productKey||history.kind==='confirmed'&&identity.receiptIdentityKey!==identity.productKey)throw fail('SV_STOCK_REFERENCE_ORPHAN','El original sin asociación necesita revisar sus referencias físicas.');
    const strict=await Explicit.resolveUnmapped({mappedAdmission,productKey:identity.productKey,read,queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery});
    if(strict.resolution==='legacy-exact')return{...strict.reference,cohort:strict.cohort,readSet:readSet()};
    const legacy=await ports.legacy(stored);
    if(legacy?.inventoryKey!==strict.reference.inventoryKey||legacy?.productKey!==strict.reference.productKey||legacy.receiptIdentityKey!=null&&legacy.receiptIdentityKey!==strict.reference.receiptIdentityKey)throw fail('SV_STOCK_REFERENCE_ORPHAN','El recorrido anterior no coincide con el original canónico verificado.');
    return{...legacy,...strict.reference,cohort:strict.cohort,readSet:[...readSet(),...ordered(ranges).map(([,entry])=>entry)]};
   }
   const legacy=await ports.legacy(stored);return{...legacy,mappingRevision:0,mapped:false,readSet:readSet()};
  }
  if(mappings.some(record=>Reference.digest(record)!==Reference.digest(mappings[0])))throw fail('SV_STOCK_REFERENCE_AMBIGUOUS','Los alias históricos remiten a vínculos distintos.');
  const mapped=mappings[0],ledgerPath='sisventas/inventario_operativo/'+mapped.inventoryKey;if(!Reference.key(mapped.productKey)||!Reference.key(mapped.inventoryKey)||!history.verifiedReads.includes(ledgerPath)||history.kind==='confirmed'&&mapped.receiptIdentityKey!==identity.receiptIdentityKey)throw fail('SV_STOCK_REFERENCE_IDENTITY','El vínculo no conserva la identidad histórica verificada.');
  if(mappedAdmission!==null&&(mapped.inventoryKey!==identity.inventoryKey||history.kind==='absent'&&mapped.productKey!==identity.productKey))throw fail('SV_STOCK_REFERENCE_IDENTITY','La asociación explícita no corresponde al original verificado.');
  if(mappedAdmission!==null){const explicit=await Explicit.resolveMapped({mappedAdmission,record:mapped,read});return{...explicit.reference,cohort:explicit.cohort,readSet:readSet()};}
  if(typeof rawQuery!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta cobertura dirigida del vínculo.');
  const coverage=loadCoverage??Directed.createDirectedCoverage({queryPage:rawQuery});
  const snapshot=await loadSnapshot({read,loadCoverage:coverage,queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery,productKey:mapped.productKey,inventoryKey:mapped.inventoryKey,access:ports.access??null}),reference=Reference.resolve(snapshot,mapped.inventoryKey);
  return{...reference,readSet:[...readSet(),...ordered(ranges).map(([,entry])=>entry)]};
 };
}
module.exports={createReferenceResolver,assertFresh};

// Stock starts from the canonical product, not from a historical OT/purchase
// row. Resolve the forward mapping before touching a physical ledger branch.
function createStockReferenceResolver({enabled=false,loadCoverage,queryPage:factoryQuery,assertBarrier,mappedAdmission=null}={}){
 const barrier=async(read,phase)=>{if(typeof assertBarrier!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta verificar la barrera de referencias de Stock.');await assertBarrier({read,phase});};
 return{assertFresh:async(readSet,read,query,queryPage)=>{if(enabled===true)await barrier(read,'stock-reference-fresh');return assertFresh(readSet,read,query,queryPage);},lookupInventory:async(inventoryKey,ports)=>{
  if(enabled!==true)return null;
  if(!Reference.key(inventoryKey)||typeof ports?.read!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Registro físico inválido.');
  const read=IO.boundedRead(ports.read);
  await barrier(read,'stock-list-reference');
  if(mappedAdmission!==null){if(!Explicit.isMappedAdmission(mappedAdmission))throw fail('SV_STOCK_MAPPED_NOT_READY','Falta admisión verificada de servidor.');await mappedAdmission.admit({read});}
  const inversePath='sisventas/stock_vinculos/porInventario/'+inventoryKey,inverse=await read(inversePath);
  if(inverse===null)return null;
  if(!inverse||inverse.inventoryKey!==inventoryKey||!Reference.key(inverse.productKey)||!Reference.key(inverse.receiptIdentityKey)||!Number.isSafeInteger(inverse.revision)||inverse.revision<1)throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación inversa es inválida.');
  const forwardPath='sisventas/stock_vinculos/porProducto/'+inverse.productKey,forward=await read(forwardPath),product=await read('sisventas/productos/'+inverse.productKey);
  if(Reference.digest(forward)!==Reference.digest(inverse)||Reference.digest(await read(inversePath))!==Reference.digest(inverse)||Reference.digest(await read(forwardPath))!==Reference.digest(forward))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación y su inversa cambiaron.');
  // Advisory lookup only: no coverage proof or write readSet is issued.
  if(Reference.productStatus(product)!=='active')throw fail('SV_STOCK_REFERENCE_PRODUCT','El producto está inactivo.');
  await barrier(read,'stock-list-reference-fresh');
  return{productKey:inverse.productKey,product,reference:{productKey:inverse.productKey,inventoryKey,receiptIdentityKey:inverse.receiptIdentityKey,mappingRevision:inverse.revision,mapped:true}};
 },resolve:async({productKey,product},ports)=>{
  if(typeof ports?.legacy!=='function')throw fail('SV_STOCK_REFERENCE_LEGACY','Falta el recorrido original de Stock.');
  if(enabled!==true)return ports.legacy(ports.read);
  if(!Reference.key(productKey)||typeof ports.read!=='function')throw fail('SV_STOCK_REFERENCE_INPUT','Producto de Stock inválido.');
  const points=IO.memoRead(ports.read),cache=points.values,ranges=new Map(),read=points.read;
  await barrier(read,'stock-reference');
  const actual=await read('sisventas/productos/'+productKey);if(!actual||Reference.digest(actual)!==Reference.digest(product))throw fail('SV_STOCK_REFERENCE_CONFLICT','El producto cambió antes de resolver Stock.');
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey),readSet=()=>[...ordered(cache).map(([path,value])=>({path,hash:Reference.digest(value)})),...ordered(ranges).map(([,entry])=>entry)];
  const rawQuery=ports.referencePhase?.queryPage??ports.queryPage??factoryQuery,onQuery=async(path,options,result)=>{const id=Reference.digest({path,options}),hash=Reference.digest(result);if(ranges.has(id)&&ranges.get(id).hash!==hash)throw fail('SV_STOCK_REFERENCE_CONFLICT','La consulta cambió durante la lectura de Stock.');ranges.set(id,{kind:'range',path,options:structuredClone(options),hash});};
  if(!forward){
   if(mappedAdmission!==null){const strict=await Explicit.resolveUnmapped({mappedAdmission,productKey,read,queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery,allowInactiveExact:true});if(strict.resolution==='legacy-exact')return{inventoryKey:productKey,inventory:strict.inventory,reference:strict.reference,cohort:strict.cohort,readSet:readSet()};const legacy=await ports.legacy(read);if(legacy.inventoryKey!==productKey)throw fail('SV_STOCK_REFERENCE_ORPHAN','El inventario histórico necesita una asociación explícita.');return{...legacy,reference:strict.reference,cohort:strict.cohort,readSet:readSet()};}
   const aliases=[...new Set([productKey,actual.id,actual.codigo,actual.cod].filter(value=>value!==null&&value!==undefined&&String(value)!=='').map(value=>String(value).replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)).filter(Reference.key))];
   for(const key of aliases)if(await read('sisventas/stock_vinculos/porInventario/'+key))throw fail('SV_STOCK_REFERENCE_MAPPING','Existe una asociación inversa sin vínculo canónico.');
   const legacy=await ports.legacy(read);return{...legacy,reference:{productKey,inventoryKey:legacy.inventoryKey,receiptIdentityKey:null,mappingRevision:0,mapped:false},readSet:readSet()};
  }
  if(forward.productKey!==productKey||!Reference.key(forward.inventoryKey))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación de Stock es inválida.');
  if(mappedAdmission!==null){const explicit=await Explicit.resolveMapped({mappedAdmission,record:forward,read,allowInactiveExact:true});return{inventoryKey:explicit.reference.inventoryKey,inventory:explicit.inventory,reference:explicit.reference,cohort:explicit.cohort,readSet:readSet()};}
  if(typeof rawQuery!=='function')throw fail('SV_STOCK_REFERENCE_COVERAGE','Falta cobertura dirigida de Stock.');
  const snapshot=await loadSnapshot({read,loadCoverage:loadCoverage??Directed.createDirectedCoverage({queryPage:rawQuery}),queryPage:rawQuery,referencePhase:ports.referencePhase,onQuery,productKey,inventoryKey:forward.inventoryKey}),reference=Reference.resolve(snapshot,forward.inventoryKey);
  return{inventoryKey:reference.inventoryKey,inventory:snapshot.inventory[reference.inventoryKey],reference,readSet:readSet()};
 }};
}
module.exports.createStockReferenceResolver=createStockReferenceResolver;
