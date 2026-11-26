'use strict';
const M=require('./sale-delete-target-index');
const D=require('./sale-delete-target-index-delta');
const F=require('./sale-financial-dependencies-model');
const {put,parts}=require('./labor-guard');
const {pool}=require('./payment-snapshot');
function affects(path){return M.roots.some(root=>path===root||path.startsWith(root+'/')||root.startsWith(path+'/'));}
async function augment({patch,raw,get,exists}){
 if(Object.keys(patch).some(path=>path==='sv_sale_delete_relations'||path.startsWith('sv_sale_delete_relations/')||'sv_sale_delete_relations'.startsWith(path+'/')))throw M.fail('Los vínculos sólo se actualizan desde sus originales.');
 const paths=new Set();for(const path of Object.keys(patch))if(affects(path)){const original=M.originalPath(path);if(original)paths.add(original);}
 if(!paths.size)return {maintained:false};
 const config=await raw(M.CONFIG);
 if(config===null){if(typeof exists!=='function'||await exists('sv_sale_delete_relations')!==false)throw M.fail('El circuito de vínculos está incompleto.');return {maintained:false};}
 // Cache only this augmentation's metadata promises, never original bodies or
 // another request. Every consumer receives a clone: the financial delta can
 // mutate its working images without changing another read's original.
 const metadata=new Map(),originals=new Map();
 const read=async path=>{if(!metadata.has(path))metadata.set(path,Promise.resolve().then(()=>raw(path)));return structuredClone(await metadata.get(path));};
 const financialRecord=path=>M.financialPath(F.ROOT+'/records/'+F.digest(path));
 const initial=[M.ROOT+'/coverage',M.FINANCIAL_ROOT+'/coverage',...Array.from(paths,M.recordPath),...Array.from(paths).filter(path=>M.financialRoots.has(M.classify(path).root)).map(financialRecord),...paths];
 await pool([...new Set(initial)],async path=>{if(paths.has(path))originals.set(path,await raw(path));else await read(path);});
 const coverage=M.validateCoverage(await read(M.ROOT+'/coverage'));M.validateConfig(config,coverage);
 const changes=[];
 for(const path of paths){
  const before=originals.get(path);let after=before;
  // Project the final wire patch, including source revisions added by the
  // other coordinated projectors after the caller staged its own changes.
  for(const [entry,value]of Object.entries(patch))if(entry===path)after=structuredClone(value);else if(entry.startsWith(path+'/'))after=put(after,parts(entry.slice(path.length+1)),value);
  if(F.digest(before)!==F.digest(after))changes.push({path,before,after});
 }
 const buckets=new Set(),references=new Set();
 for(const change of changes){
  if(!M.financialRoots.has(M.classify(change.path).root))continue;
  const kind=F.classify(change.path),before=F.image(change.path,change.before),after=F.image(change.path,change.after);
  if(kind.domain==='ventas')for(const image of [before,after])for(const token of image?.tokens||[]){const path=M.financialPath(F.ROOT+'/references/'+token);buckets.add(path);references.add(path);}
  else for(const token of after?.tokens||[])buckets.add(M.financialPath(F.ROOT+'/aliases/'+token));
 }
 await pool([...buckets],path=>read(path));
 const affected=new Set();
 for(const path of references)for(const id of Object.keys(await read(path)||{}))if(/^[a-f0-9]{64}$/.test(id))affected.add(M.financialPath(F.ROOT+'/records/'+id));
 await pool([...affected],path=>read(path));
 // The unchanged delta validates every real image and produces the exact same
 // patch. No empty bucket or financial authority is inferred from equal aliases.
 const derived=await D.delta({changes,read});Object.assign(patch,derived);
 return {maintained:true,generation:coverage.generation,revision:derived[M.ROOT+'/coverage'].revision};
}
module.exports={affects,augment};
