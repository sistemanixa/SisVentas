'use strict';
const M=require('./sale-delete-target-index');
const D=require('./sale-delete-target-index-delta');
const F=require('./sale-financial-dependencies-model');
const {put,parts}=require('./labor-guard');
function affects(path){return M.roots.some(root=>path===root||path.startsWith(root+'/')||root.startsWith(path+'/'));}
async function augment({patch,raw,get,exists}){
 if(Object.keys(patch).some(path=>path==='sv_sale_delete_relations'||path.startsWith('sv_sale_delete_relations/')||'sv_sale_delete_relations'.startsWith(path+'/')))throw M.fail('Los vínculos sólo se actualizan desde sus originales.');
 const paths=new Set();for(const path of Object.keys(patch))if(affects(path)){const original=M.originalPath(path);if(original)paths.add(original);}
 if(!paths.size)return {maintained:false};
 const config=await raw(M.CONFIG);
 if(config===null){if(typeof exists!=='function'||await exists('sv_sale_delete_relations')!==false)throw M.fail('El circuito de vínculos está incompleto.');return {maintained:false};}
 const coverage=M.validateCoverage(await raw(M.ROOT+'/coverage'));M.validateConfig(config,coverage);
 const changes=[];
 for(const path of paths){
  const before=await raw(path);let after=before;
  // Project the final wire patch, including source revisions added by the
  // other coordinated projectors after the caller staged its own changes.
  for(const [entry,value]of Object.entries(patch))if(entry===path)after=structuredClone(value);else if(entry.startsWith(path+'/'))after=put(after,parts(entry.slice(path.length+1)),value);
  if(F.digest(before)!==F.digest(after))changes.push({path,before,after});
 }
 const derived=await D.delta({changes,read:raw});Object.assign(patch,derived);
 return {maintained:true,generation:coverage.generation,revision:derived[M.ROOT+'/coverage'].revision};
}
module.exports={affects,augment};
