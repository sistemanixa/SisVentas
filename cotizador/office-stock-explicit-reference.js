'use strict';
const Activation=require('./stock-link-activation-contract'),Reference=require('./office-stock-reference'),Directed=require('./office-stock-directed-coverage'),IO=require('./office-stock-reference-io');
const ACTIVATION='sv_stock_reference_config/activation',INVARIANTS=Object.freeze({schema:1,kind:'stock-explicit-association-v1',namespace:'sisventas/stock_vinculos',creation:'complete-directed-server-command',pair:'exact-eight-fields',immutable:['productKey','inventoryKey','receiptIdentityKey'],commitPaths:['forward','inverse','domainReceipt','genericReceipt','guardNull'],writers:'signed-stock-purchase-ot-ui-cohort-only',history:'original-row-and-receipt-identity-preserved',legacy:'existing-canonical-ledger-only-no-reinterpretation'}),INVARIANT_DIGEST=Reference.digest(INVARIANTS),STOCK_REFERENCES=Object.freeze({schema:1,mode:'immutable-explicit-reference',invariantDigest:INVARIANT_DIGEST});
const authorities=new WeakSet(),admissions=new WeakMap(),fields=['productKey','inventoryKey','receiptIdentityKey','revision','operationId','uid','reason','ts'],hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>0;
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
function createMappedAdmission({enabled=false,expectedPins,expectedContract,expectedRulesDigest,publicKey,now=Date.now}={}){
 expectedPins=expectedPins?Activation.pins(expectedPins):null;
 expectedContract=expectedContract?structuredClone(expectedContract):null;
 const authority=Object.freeze({admit:async({read})=>{
  if(enabled!==true||typeof read!=='function')throw fail('SV_STOCK_MAPPED_NOT_READY','El uso explícito del vínculo no está habilitado.');
  const document=await IO.boundedRead(read)(ACTIVATION);
  if(!expectedContract||Reference.digest(expectedContract)!==expectedPins?.contractDigest||Reference.digest(expectedContract.stockReferences)!==Reference.digest(STOCK_REFERENCES)||!Activation.verify(document,{expectedPins,expectedRulesDigest,publicKey,now:now()}))throw fail('SV_STOCK_MAPPED_COHORT','No se acreditó la cohorte y el contrato inmutable del vínculo.');
  const capability=Object.freeze({});admissions.set(capability,{authority,generation:document.generation,activationDigest:Reference.digest(document),rulesDigest:document.rulesDigest,contractDigest:document.contractDigest});return capability;
 }});authorities.add(authority);return authority;
}
function validPairRecord(record){return record&&typeof record==='object'&&!Array.isArray(record)&&Object.keys(record).sort().join(',')===fields.slice().sort().join(',')&&[record.productKey,record.inventoryKey,record.receiptIdentityKey].every(Reference.key)&&Reference.key(record.operationId)&&record.operationId.length>=8&&integer(record.revision)&&integer(record.ts)&&typeof record.uid==='string'&&record.uid.length>0&&record.uid.length<=128&&typeof record.reason==='string'&&record.reason.trim().length>0&&record.reason.length<=240;}
async function resolveMapped({mappedAdmission,record,read,allowInactiveExact=false}){
 if(!authorities.has(mappedAdmission))throw fail('SV_STOCK_MAPPED_NOT_READY','Falta admisión verificada de servidor.');
 const capability=await mappedAdmission.admit({read}),proof=admissions.get(capability);if(proof?.authority!==mappedAdmission)throw fail('SV_STOCK_MAPPED_COHORT','La admisión del vínculo es inválida.');
 if(!validPairRecord(record))throw fail('SV_STOCK_REFERENCE_MAPPING','Asociación explícita inválida.');
 const {productKey,inventoryKey,receiptIdentityKey,revision,operationId,uid}=record,paths=['sisventas/stock_vinculos/porProducto/'+productKey,'sisventas/stock_vinculos/porInventario/'+inventoryKey,'sisventas/productos/'+productKey,'sisventas/inventario_operativo/'+inventoryKey,'sisventas/stock_vinculos/operaciones/'+operationId,'sv_labor_receipts/'+operationId],point=IO.boundedRead(read),[forward,inverse,product,inventory,own,receipt]=await IO.mapOrdered(paths,path=>point(path));
 if(Reference.digest(forward)!==Reference.digest(record)||Reference.digest(inverse)!==Reference.digest(record))throw fail('SV_STOCK_REFERENCE_MAPPING','La asociación explícita y su inversa no coinciden.');
 const status=Reference.productStatus(product);
 if(status==='inactive'&&(allowInactiveExact!==true||inventoryKey!==productKey))throw fail('SV_STOCK_REFERENCE_INACTIVE','El producto inactivo no admite este uso del vínculo.');
 if(!inventory||typeof inventory!=='object'||Array.isArray(inventory))throw fail('SV_STOCK_REFERENCE_MISSING','No existe el registro físico asociado.');
 if([inventory.productoKey,inventory.productKey].filter(value=>value!==null&&value!==undefined&&value!=='').some(owner=>owner!==productKey))throw fail('SV_STOCK_REFERENCE_OWNED','El inventario corresponde a otro producto.');
 const result={ok:true,committed:true,operationId,productKey,inventoryKey,receiptIdentityKey,revision};
 if(own?.uid!==uid||own.operationId!==operationId||!hex(own.commandDigest)||Reference.digest(own.result)!==Reference.digest(result)||receipt?.actorUid!==uid||!hex(receipt.digest)||typeof receipt.fence!=='string'||!receipt.fence||!integer(receipt.confirmedAt)||Reference.digest(receipt.result)!==Reference.digest(result))throw fail('SV_STOCK_REFERENCE_ORIGIN','Falta acreditar el recibo original de la asociación.');
 return{product,inventory,reference:Object.freeze({productKey,inventoryKey,receiptIdentityKey,mappingRevision:revision,status,mapped:true}),cohort:{generation:proof.generation,activationDigest:proof.activationDigest,rulesDigest:proof.rulesDigest,contractDigest:proof.contractDigest}};
}
async function resolveUnmapped({mappedAdmission,productKey,read,queryPage,referencePhase,onQuery,allowInactiveExact=false}){
 if(!authorities.has(mappedAdmission))throw fail('SV_STOCK_MAPPED_NOT_READY','Falta admisión verificada de servidor.');
 const capability=await mappedAdmission.admit({read}),proof=admissions.get(capability);
 if(proof?.authority!==mappedAdmission||!Reference.key(productKey))throw fail('SV_STOCK_MAPPED_NOT_READY','No se pudo verificar el original canónico sin asociación.');
 const product=await read('sisventas/productos/'+productKey),status=Reference.productStatus(product);
 if(status==='inactive'&&allowInactiveExact!==true)throw fail('SV_STOCK_REFERENCE_INACTIVE','El producto inactivo no admite este uso del vínculo.');
 if(await read('sisventas/stock_vinculos/porProducto/'+productKey)!==null||await read('sisventas/stock_vinculos/porInventario/'+productKey)!==null)throw fail('SV_STOCK_REFERENCE_MAPPING','La ausencia de asociación cambió.');
 const existing=await read('sisventas/inventario_operativo/'+productKey);
 if(existing!==null){
  if(!existing||typeof existing!=='object'||Array.isArray(existing)||[existing.productoKey,existing.productKey].filter(value=>value!==null&&value!==undefined&&value!=='').some(owner=>owner!==productKey))throw fail('SV_STOCK_REFERENCE_OWNED','El inventario canónico requiere revisar su propietario.');
  return{product,inventory:existing,resolution:'legacy-exact',reference:{productKey,inventoryKey:productKey,receiptIdentityKey:productKey,mappingRevision:0,status,mapped:false},cohort:{generation:proof.generation,activationDigest:proof.activationDigest,rulesDigest:proof.rulesDigest,contractDigest:proof.contractDigest}};
 }
 if(typeof queryPage!=='function')throw fail('SV_STOCK_MAPPED_NOT_READY','Falta demostrar la ausencia de inventarios históricos.');
 const coverage=await Directed.createDirectedCoverage({queryPage,allowAbsent:true})({read,queryPage,referencePhase,onQuery,productKey,inventoryKey:productKey});
 for(const key of coverage.inventoryKeys)if(await read('sisventas/stock_vinculos/porInventario/'+key)!==null)throw fail('SV_STOCK_REFERENCE_MAPPING','Existe una asociación inversa sin original canónico.');
 const inventory=await read('sisventas/inventario_operativo/'+productKey);
 if(inventory&&[inventory.productoKey,inventory.productKey].filter(value=>value!==null&&value!==undefined&&value!=='').some(owner=>owner!==productKey))throw fail('SV_STOCK_REFERENCE_OWNED','El inventario pertenece a otro producto.');
 if(coverage.receiptIdentityKey!==productKey)throw fail('SV_STOCK_REFERENCE_IDENTITY','La identidad histórica necesita una asociación explícita.');
 return{product,inventory,resolution:'discovered-absence',reference:{productKey,inventoryKey:productKey,receiptIdentityKey:productKey,mappingRevision:0,status,mapped:false},cohort:{generation:proof.generation,activationDigest:proof.activationDigest,rulesDigest:proof.rulesDigest,contractDigest:proof.contractDigest}};
}
module.exports={ACTIVATION,INVARIANTS,INVARIANT_DIGEST,STOCK_REFERENCES,createMappedAdmission,resolveMapped,resolveUnmapped,isMappedAdmission:authority=>authorities.has(authority)};
