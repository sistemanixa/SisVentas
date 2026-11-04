'use strict';
const {digest}=require('./labor-guard');
const Relations=require('./sale-delete-relations');
const Payments=require('./payment-membership-index');
const ROOT='sv_sale_delete_relations/v1';
const fail=message=>Object.assign(Error(message),{code:'SV_SALE_DELETE_COVERAGE',statusCode:409});
const domains=['ventas','pagos','ordenes_trabajo','presupuestos','reclamos'];
function prepare(collections,{generation,revision=1}={}){
 if(!/^[A-Za-z0-9_-]{8,160}$/.test(generation||'')||!Number.isSafeInteger(revision)||revision<1)throw fail('Generación inválida.');
 for(const domain of domains)if(!Object.hasOwn(collections,domain)||collections[domain]===undefined)throw fail('Falta la fuente completa '+domain+'.');
 const sources=Object.fromEntries(domains.map(domain=>[domain,digest(collections[domain]||{})])),patch={},base=ROOT+'/'+generation;
 for(const [saleKey,sale]of Object.entries(collections.ventas||{})){
  Payments.recordKey(saleKey);let links,blocked;
  try{links=Relations.resolve(collections,saleKey);}catch(error){if(error.code!=='SV_SALE_DELETE_RELATION_REVIEW')throw error;blocked=error.message;}
  const records={['sisventas/ventas/'+saleKey]:digest(sale)};
  if(links)for(const domain of ['pagos','ordenes_trabajo','presupuestos'])for(const [id,row]of Object.entries(links[domain])){Payments.recordKey(id);records['sisventas/'+domain+'/'+id]=digest(row);}
  patch[base+'/sales/'+saleKey]={generation,revision,records,...(blocked?{blocked}:{links:Object.fromEntries(['pagos','ordenes_trabajo','presupuestos'].map(domain=>[domain,Object.keys(links[domain])]))})};
 }
 const payment=Payments.buildIndex(collections.pagos||{},{generation,ready:true});
 Object.assign(patch,payment.patch);
 patch[ROOT+'/coverage']={schema:1,generation,revision,ready:true,sources,sales:Object.keys(collections.ventas||{}).length,paymentCoverage:digest(payment.coverage)};
 return {patch,coverage:patch[ROOT+'/coverage']};
}
async function discover(read,saleKey,{generation,revision}={}){
 Payments.recordKey(saleKey);
 const coverage=await read(ROOT+'/coverage');
 if(coverage?.schema!==1||coverage.ready!==true||coverage.generation!==generation||coverage.revision!==revision)throw fail('La cobertura de relaciones no está vigente.');
 const entry=await read(ROOT+'/'+generation+'/sales/'+saleKey);
 if(entry?.generation!==generation||entry.revision!==revision)throw fail('Falta cobertura de esta venta.');
 if(entry.blocked)throw fail(entry.blocked);
 const records={};
 for(const [path,expected]of Object.entries(entry.records)){const row=await read(path);if(digest(row)!==expected)throw fail('Cambió un original; actualizá la cobertura.');records[path]=row;}
 const sale={...records['sisventas/ventas/'+saleKey],fbKey:saleKey};
 const paymentCoverage=Payments.validateCoverage(await read(Payments.COVERAGE_PATH));
 if(digest(paymentCoverage)!==coverage.paymentCoverage)throw fail('La pertenencia de pagos cambió.');
 const candidates=new Set();for(const path of Payments.queryPaths(sale))for(const id of Object.keys(await read(path)||{}))candidates.add(id);
 const linked=[];
 for(const id of candidates){const path='sisventas/pagos/'+Payments.recordKey(id),row=records[path]||await read(path);Payments.validateReverse(id,row,await read(Payments.reversePath(id)));if(Payments.belongsToSale(row,sale))linked.push(id);}
 if(digest(linked.sort())!==digest([...entry.links.pagos].sort()))throw fail('La cobertura de pagos no coincide.');
 if(digest(await read(ROOT+'/coverage'))!==digest(coverage)||digest(await read(Payments.COVERAGE_PATH))!==digest(paymentCoverage))throw fail('La generación cambió durante la lectura.');
 return {generation,revision,links:entry.links,records,coverageDigest:digest(coverage)};
}
module.exports={ROOT,prepare,discover};
