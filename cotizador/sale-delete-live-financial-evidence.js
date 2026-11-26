'use strict';
const M=require('./sale-financial-dependencies-model');
const Provider=require('./sale-financial-dependencies-provider');
const {pool}=require('./payment-snapshot');
const providers=new WeakSet();
const roots=Object.freeze(['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation']);
const parents=Object.freeze(['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies']);
const maxRootBytes=8*1024*1024,maxExpenseRootBytes=16*1024*1024,maxTotalBytes=64*1024*1024;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const absenceFailure=()=>Object.assign(Error('La lectura financiera en originales requiere ausencia verificada de History y del índice financiero.'),{statusCode:503,code:'SV_SALE_DELETE_LIVE_ABSENCE_REQUIRED'});
async function assertAbsent({read,exists}={}){
 if(typeof read!=='function'||typeof exists!=='function')throw absenceFailure();
 // Drain all checks on error. null returned by a failed read is never invented.
 const results=await Promise.allSettled([...parents.map(path=>Promise.resolve().then(()=>exists(path))),Promise.resolve().then(()=>read('sv_client_history_config'))]);
 if(results.some(result=>result.status!=='fulfilled')||results.slice(0,3).some(result=>result.value!==false)||results[3].value!==null)throw absenceFailure();
}
function virtualTree(patch){
 const tree=Object.create(null),prefix=M.ROOT+'/';
 for(const [path,value]of Object.entries(patch)){
  if(!path.startsWith(prefix))throw M.fail('La proyección financiera produjo una ruta ajena.');
  const keys=path.slice(prefix.length).split('/');let node=tree;
  for(const key of keys.slice(0,-1)){if(!Object.hasOwn(node,key))node[key]=Object.create(null);node=node[key];}
  const last=keys.at(-1);if(value===null)delete node[last];else Object.defineProperty(node,last,{value:structuredClone(value),enumerable:true,writable:true,configurable:true});
 }
 return path=>{
  if(path!==M.ROOT&&!path.startsWith(prefix))throw M.fail('Ruta financiera virtual inválida.');
  let value=tree;for(const key of path===M.ROOT?[]:path.slice(prefix.length).split('/')){if(!value||!Object.hasOwn(value,key))return null;value=value[key];}
  return structuredClone(value);
 };
}
function create({store}={}){
 if(typeof store?.exists!=='function')throw TypeError('Falta el puerto real de existencia de namespaces.');
 const provider=Provider.create();
 const evidence=async({saleKey,read,operationId}={})=>{
  if(!M.key(saleKey)||typeof read!=='function'||typeof operationId!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(operationId))throw M.fail('Falta la identidad de operación financiera.');
  await assertAbsent({read,exists:path=>store.exists(path)});
  let totalBytes=0;
  const originals=await pool(roots,async path=>{
   const value=await read(path);
   if(value!==null&&!plain(value))throw M.fail('Fuente financiera completa inválida: '+path+'.');
   let encoded;try{encoded=JSON.stringify(value);}catch(_){throw M.fail('Fuente financiera completa no serializable.');}
   const bytes=Buffer.byteLength(encoded);totalBytes+=bytes;
   const rootBudget=path==='sisventas/gastos'?maxExpenseRootBytes:maxRootBytes;
   if(bytes>rootBudget||totalBytes>maxTotalBytes)throw Object.assign(Error('Las fuentes financieras superan el alcance permitido para esta operación.'),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});
   // Employee accounts are collections of individual original movements; do
   // not let Model.prepare's empty-container iteration mask false/0/arrays.
   if(path==='sisventas/ctaemp'&&value!==null&&Object.values(value).some(account=>!plain(account)))throw M.fail('La cuenta financiera requiere originales completos.');
   return structuredClone(value);
  });
  const sources=Object.fromEntries(roots.map((path,index)=>[path.split('/').at(-1),originals[index]]));
  const generation='live-'+M.digest({saleKey,operationId});
  const prepared=await M.prepare(sources,{generation}),virtualRead=virtualTree(prepared.patch);
  const sourceRead=path=>{
   const index=roots.findIndex(root=>path===root||path.startsWith(root+'/'));
   if(index<0)throw M.fail('El proveedor solicitó una fuente ajena.');
   let value=originals[index];
   for(const key of path===roots[index]?[]:path.slice(roots[index].length+1).split('/')){if(!value||!Object.hasOwn(value,key))return null;value=value[key];}
   return structuredClone(value);
  };
  const result=await provider({saleKey,read:path=>path===M.ROOT||path.startsWith(M.ROOT+'/')?virtualRead(path):sourceRead(path)});
  return {...result,originalSourceHashes:Object.fromEntries(roots.map((path,index)=>[path,M.digest(originals[index])])),coverageSnapshot:structuredClone(prepared.coverage)};
 };
 providers.add(evidence);return Object.freeze(evidence);
}
module.exports={create,isProvider:value=>providers.has(value),assertAbsent};
