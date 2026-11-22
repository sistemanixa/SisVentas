'use strict';
const State=require('./ot-material-state');
const crypto=require('node:crypto'),Reference=require('./office-stock-reference'),Catalog=require('./office-stock-catalog-coverage');
const loaders=new WeakSet(),fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code}),copy=value=>structuredClone(value);
function validReceipt(receipt){return receipt&&typeof receipt==='object'&&!Array.isArray(receipt)&&[receipt.ot,receipt.venta].every(Reference.key)&&Number.isSafeInteger(receipt.revision)&&receipt.revision>=1&&(receipt.fila===undefined||Reference.key(receipt.fila))&&typeof receipt.instalada==='number'&&Number.isFinite(receipt.instalada)&&receipt.instalada>=0&&['deReserva','deGeneral','enReserva'].every(name=>receipt[name]===undefined||typeof receipt[name]==='number'&&Number.isFinite(receipt[name])&&receipt[name]>=0);}
function receiptIdentity(inventory,inventoryKey,originals={}){
 const receipts=inventory.rendicionesOT??{};if(!receipts||typeof receipts!=='object'||Array.isArray(receipts)||Object.keys(receipts).length>256)throw fail('SV_STOCK_HISTORY_LIMIT','La historia requiere conciliación acotada.');
 const audits=[];for(const field of ['confirmacionesOT','regularizacionesOT']){const groups=inventory[field]??{};if(typeof groups!=='object'||Array.isArray(groups))throw fail('SV_STOCK_HISTORY_INVALID','Auditoría histórica inválida.');for(const rows of Object.values(groups)){if(!rows||typeof rows!=='object')throw fail('SV_STOCK_HISTORY_INVALID','Auditoría histórica inválida.');for(const audit of Object.values(rows))if(audit!==null){if(audits.length>=512)throw fail('SV_STOCK_HISTORY_LIMIT','Demasiada historia para verificar.');audits.push(audit);}}}
 if(!Object.keys(receipts).length){if(audits.length)throw fail('SV_STOCK_HISTORY_ORPHAN','Hay auditorías sin recibo verificable.');return inventoryKey;}
 if(audits.some(audit=>!audit||!Object.hasOwn(receipts,audit.receipt)))throw fail('SV_STOCK_HISTORY_ORPHAN','Hay auditorías sin recibo verificable.');
 const identities=new Set();for(const [id,receipt]of Object.entries(receipts)){if(!validReceipt(receipt)||!/^[a-f0-9]{64}$/.test(id))throw fail('SV_STOCK_HISTORY_UNPROVEN','El recibo histórico requiere su original verificado.');const matches=audits.filter(audit=>audit.receipt===id);if(!matches.length){if(!Reference.key(originals[id]))throw fail('SV_STOCK_HISTORY_UNPROVEN','Falta el original de identidad del recibo histórico.');identities.add(originals[id]);}for(const audit of matches){if(![audit.producto,audit.ot,audit.fila,audit.venta].every(Reference.key)||audit.ot!==receipt.ot||audit.venta!==receipt.venta||receipt.fila!==undefined&&receipt.fila!==audit.fila||!Number.isSafeInteger(audit.revision)||audit.revision<1||audit.revision>receipt.revision)throw fail('SV_STOCK_HISTORY_UNPROVEN','La auditoría no corresponde al recibo.');const hash=crypto.createHash('sha256').update(JSON.stringify([audit.ot,audit.fila,audit.producto,audit.venta])).digest('hex');if(hash!==id&&originals[id]!==audit.producto)throw fail('SV_STOCK_HISTORY_UNPROVEN','No se pudo demostrar la identidad histórica del recibo.');identities.add(audit.producto);}}
 if(identities.size!==1)throw fail('SV_STOCK_HISTORY_AMBIGUOUS','Los recibos usan distintas identidades históricas.');return[...identities][0];
}
async function loadReceiptIdentity(inventory,inventoryKey,{read,productKey,aliases}){
 try{return receiptIdentity(inventory,inventoryKey);}catch(error){if(error.code!=='SV_STOCK_HISTORY_UNPROVEN')throw error;}
 const originals={},loaded=new Map();
 for(const [id,entry]of Object.entries(inventory.rendicionesOT||{})){
  if(!/^[a-f0-9]{64}$/.test(id)||!validReceipt(entry))throw fail('SV_STOCK_HISTORY_UNPROVEN','Recibo histórico no verificable.');
  if(!loaded.has(entry.ot)){if(loaded.size>=32)throw fail('SV_STOCK_HISTORY_LIMIT','Demasiadas OT históricas para verificar.');loaded.set(entry.ot,await read('sisventas/ordenes_trabajo/'+entry.ot));}
  const ot=loaded.get(entry.ot);if(!ot||ot.materiales!=null&&!Array.isArray(ot.materiales))throw fail('SV_STOCK_HISTORY_UNPROVEN','Falta la OT original del recibo.');
  // Never merge/reindex source rows with Rows.view while proving a hash.
  // items-only history needs its explicit, unchanged source-index marker.
  const fromItems=!ot.materiales?.length,rows=fromItems?ot.items:ot.materiales;
  if(!Array.isArray(rows)||rows.length>256)throw fail('SV_STOCK_HISTORY_UNPROVEN','Falta la fila original del recibo.');
  const matches=[];
  for(const [index,row]of rows.entries()){
   if(!row||typeof row!=='object'||fromItems&&row.origenMaterialHistorico!=='items:'+index)continue;
   const allocation=row.destinoVenta==='nueva'?row.ventaDestinoFbKey:ot.ventaFbKey;
   if(allocation!==entry.venta||row.stockRegistro!==id||row.stockRevision!==entry.revision||row.instalada!==entry.instalada||typeof row.instalada!=='number'||!Number.isFinite(row.instalada)||row.instalada<0)continue;
   const candidates=[...new Set([row.productoKey,row.productKey,inventory.productoKey,inventory.productKey,inventoryKey,productKey,...aliases].filter(Reference.key))];
   for(const candidate of candidates){const modern=crypto.createHash('sha256').update(JSON.stringify([entry.ot,String(index),candidate,allocation])).digest('hex'),legacy=State.legacyReceiptIdentity({otKey:entry.ot,rowKey:String(index),productKey:candidate,row});if((id===modern||id===legacy)&&State.receiptBoundToRow({otKey:entry.ot,rowKey:String(index),productKey:candidate,allocation,row,receipt:id,entry}))matches.push({index,identity:candidate});}
  }
  if(matches.length!==1)throw fail('SV_STOCK_HISTORY_UNPROVEN','El recibo no identifica una fila e identidad originales únicas.');
  originals[id]=matches[0].identity;
 }
 return receiptIdentity(inventory,inventoryKey,originals);
}
function createDirectedCoverage({queryPage,limit=64}){
 if(typeof queryPage!=='function'||!Number.isInteger(limit)||limit<1||limit>128)throw Error('Falta lector acotado de referencias.');
 const loader=async function loadCoverage({read,productKey,inventoryKey,queryPage:phaseQuery}){
  if(!Reference.key(productKey)||!Reference.key(inventoryKey)||typeof read!=='function')throw fail('SV_STOCK_COVERAGE_INPUT','Referencias inválidas.');
  const queries=[],queried=async(path,options)=>{const result=await(phaseQuery||queryPage)(path,options);if(result!==null&&typeof result!=='object')throw fail('SV_STOCK_COVERAGE_RESULT','Consulta inválida.');if(Object.values(result||{}).filter(value=>value!==null).length>limit)throw fail('SV_STOCK_COVERAGE_LIMIT','La consulta excede el límite completo.');queries.push({path,options:copy(options),hash:Reference.digest(result)});return result;};
  const catalog=await Catalog.collect({productKey,inventoryKey,limit},{read,queryPage:queried}),found=new Set([inventoryKey]);
  for(const options of Catalog.queryPlan(catalog.aliases,limit,['$key','codigo','cod','id','productoKey','productKey'])){const result=await queried('sisventas/inventario_operativo',options);for(const [key,record]of Object.entries(result||{})){if(record===null)continue;if(!Reference.key(key))throw fail('SV_STOCK_COVERAGE_RESULT','Clave física inválida.');const value=options.orderBy==='$key'?key:record?.[options.orderBy];if(value!==null&&value!==undefined&&catalog.aliases.includes(Catalog.normalize(value)))found.add(key);}}
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey);if(forward){if(!Reference.key(forward.inventoryKey))throw fail('SV_STOCK_REFERENCE_MAPPING','Asociación inválida.');found.add(forward.inventoryKey);}
  for(const root of ['porProducto','porInventario'])for(const [field,value]of [['productKey',productKey],['inventoryKey',inventoryKey]]){const rows=await queried('sisventas/stock_vinculos/'+root,{orderBy:field,equalTo:value,limitToFirst:limit+1});for(const [key,record]of Object.entries(rows||{})){if(!record||!Reference.key(record.inventoryKey)||!Reference.key(record.productKey)||key!==(root==='porProducto'?record.productKey:record.inventoryKey))throw fail('SV_STOCK_REFERENCE_MAPPING','Asociación inválida.');if(record.productKey!==productKey)throw fail('SV_STOCK_REFERENCE_OWNED','El registro está vinculado a otro producto.');const inverse=await read('sisventas/stock_vinculos/'+(root==='porProducto'?'porInventario/'+record.inventoryKey:'porProducto/'+record.productKey));if(Reference.digest(inverse)!==Reference.digest(record))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación inversa no coincide.');found.add(record.inventoryKey);}}
  if(found.size>64)throw fail('SV_STOCK_COVERAGE_LIMIT','Demasiados inventarios candidatos.');
  const ownersByInventory={},existing=[];for(const key of found){const inventory=await read('sisventas/inventario_operativo/'+key);if(inventory===null)continue;if(!inventory||typeof inventory!=='object'||Array.isArray(inventory))throw fail('SV_STOCK_COVERAGE_RESULT','Inventario inválido.');existing.push([key,inventory]);ownersByInventory[key]=[...new Set([inventory.productoKey,inventory.productKey].filter(value=>value!==null&&value!==undefined&&value!==''))];}
  if(existing.length!==1||existing[0][0]!==inventoryKey)throw fail('SV_STOCK_REFERENCE_AMBIGUOUS','La referencia no identifica un inventario único.');
  const historical=await loadReceiptIdentity(existing[0][1],inventoryKey,{read,productKey,aliases:catalog.aliases});return{schema:1,generation:'directed-v1',inventoryKeys:[...found],ownersByInventory,aliasOwners:catalog.owners,receiptIdentityKey:historical,coverage:{catalog:true,inventory:true,links:true,owners:true,receiptIdentity:true},queries};
 };loaders.add(loader);return loader;
}
module.exports={createDirectedCoverage,isDirectedCoverage:loader=>loaders.has(loader),receiptIdentity};
