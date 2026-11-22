'use strict';
const Reference=require('./office-stock-reference'),IO=require('./office-stock-reference-io');
const path='sisventas/productos',normalize=value=>String(value??'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
const fail=(code,message)=>Object.assign(Error(message),{statusCode:409,code});
function prefixEnd(prefix){return prefix.slice(0,-1)+String.fromCharCode(prefix.charCodeAt(prefix.length-1)+1);}
function numericAliases(target){
 const count=(target.match(/_/g)||[]).length;if(count>2)return[];
 let candidates=[''];for(const char of target)candidates=candidates.flatMap(prefix=>char==='_'?[prefix+'.',prefix+'+']:[prefix+char]);
 return[...new Set(candidates.map(value=>Number(value)).filter(value=>Number.isFinite(value)&&normalize(value)===target))];
}
function queryPlan(targets,limit,fields=['$key','id','codigo','cod']){
 targets=[...new Set(targets)].sort();
 const prefixes=[...new Set(targets.filter(value=>value.includes('_')||value.length===120).map(value=>value.split('_')[0]))].sort(),minimal=prefixes.filter((value,index)=>!prefixes.slice(0,index).some(prior=>value.startsWith(prior))),queries=[];
 for(const field of fields){
  for(const prefix of minimal)queries.push({orderBy:field,...(prefix||field!=='$key'?{startAt:prefix}:{}),...(prefix?{endAt:prefixEnd(prefix)}:{}),limitToFirst:limit+1});
  for(const target of targets)if(!minimal.some(prefix=>target.startsWith(prefix)))queries.push({orderBy:field,equalTo:target,limitToFirst:limit+1});
  if(field==='$key')continue;
  if(!minimal.includes(''))queries.push({orderBy:field,startAt:'\uffff',limitToFirst:limit+1});
  for(const value of [...new Set(targets.flatMap(numericAliases))])queries.push({orderBy:field,equalTo:value,limitToFirst:limit+1});
  for(const value of [false,true])if(targets.includes(String(value)))queries.push({orderBy:field,equalTo:value,limitToFirst:limit+1});
 }
 return queries;
}
async function collect({productKey,inventoryKey,limit=64},ports){
 if(!Reference.key(productKey)||!Reference.key(inventoryKey)||!Number.isInteger(limit)||limit<1||limit>128||typeof ports?.read!=='function'||typeof ports.queryPage!=='function')throw fail('SV_STOCK_COVERAGE_INPUT','Falta el puerto autoritativo de cobertura.');
 const productPath=path+'/'+productKey,product=await ports.read(productPath);if(!product||typeof product!=='object'||Array.isArray(product))throw fail('SV_STOCK_COVERAGE_PRODUCT','Producto no disponible.');
 const inventoryPath='sisventas/inventario_operativo/'+inventoryKey,inventory=await ports.read(inventoryPath);
 const targets=[...new Set([productKey,inventoryKey,product.id,product.codigo,product.cod,inventory?.codigo,inventory?.cod,inventory?.id].filter(value=>value!==null&&value!==undefined&&String(value)!=='').map(normalize))],owners=new Set(),queries=[],points=new Map([[productPath,Reference.digest(product)],[inventoryPath,Reference.digest(inventory)]]);
 const results=await IO.mapOrdered(queryPlan(targets,limit),async options=>{
  const pointPath=options.orderBy==='$key'&&Object.hasOwn(options,'equalTo')?path+'/'+options.equalTo:null;
  let result;if(pointPath){const value=pointPath===productPath?product:await ports.read(pointPath);points.set(pointPath,Reference.digest(value));result=value===null?null:{[options.equalTo]:value};}else result=await ports.queryPage(path,options);
  if(result!==null&&(typeof result!=='object'))throw fail('SV_STOCK_COVERAGE_RESULT','Respuesta de cobertura inválida.');
  const entries=Object.entries(result||{}).filter(([,value])=>value!==null);if(entries.length>limit)throw fail('SV_STOCK_COVERAGE_LIMIT','La consulta excede la cobertura acotada. No se eligió un candidato.');
  return{options,result,entries,pointPath};
 });
 for(const {options,result,entries,pointPath}of results){
  if(!pointPath)queries.push({path,options:structuredClone(options),hash:Reference.digest(result)});
  for(const [key,record]of entries){if(!Reference.key(key))throw fail('SV_STOCK_COVERAGE_RESULT','Clave de catálogo inválida.');const value=options.orderBy==='$key'?key:record?.[options.orderBy];if(value===undefined||value===null)continue;let normalized;try{normalized=normalize(value);}catch(_){throw fail('SV_STOCK_COVERAGE_RESULT','Alias de catálogo no interpretable.');}if(targets.includes(normalized))owners.add(key);if([...owners].some(owner=>owner!==productKey))throw fail('SV_STOCK_COVERAGE_COLLISION','El alias normalizado pertenece también a otro producto.');}
 }
 if(!owners.has(productKey))throw fail('SV_STOCK_COVERAGE_INCOMPLETE','No se pudo probar el propietario del catálogo.');
 return{catalog:true,productKey,aliases:targets,owners:[...owners],readSet:[...points].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,hash])=>({path,hash})),querySet:queries};
}
async function assertFresh(proof,ports){for(const item of proof.readSet)if(Reference.digest(await ports.read(item.path))!==item.hash)throw fail('SV_STOCK_COVERAGE_CHANGED','El catálogo cambió.');for(const item of proof.querySet)if(Reference.digest(await ports.queryPage(item.path,item.options))!==item.hash)throw fail('SV_STOCK_COVERAGE_CHANGED','La membresía de alias cambió.');}
module.exports={collect,assertFresh,normalize,queryPlan,numericAliases};
