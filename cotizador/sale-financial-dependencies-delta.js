'use strict';
const M=require('./sale-financial-dependencies-model');
const modulus=1n<<256n;
const accumulator=(before,hash,sign)=>((BigInt('0x'+before)+BigInt(sign)*BigInt('0x'+hash)+modulus)%modulus).toString(16).padStart(64,'0');
async function delta({changes,read}){
 const coverage=M.validateCoverage(await read(M.ROOT+'/coverage')),patch={},affected=new Set(),seen=new Set();
 const get=async path=>Object.hasOwn(patch,path)?structuredClone(patch[path]):await read(path);
 const bucket=async path=>{const base={...await read(path)};for(const [entry,value]of Object.entries(patch))if(entry.startsWith(path+'/')&&!entry.slice(path.length+1).includes('/')){const id=entry.slice(path.length+1);if(value===null)delete base[id];else base[id]=value;}return base;};
 for(const change of changes){
  if(seen.has(change.path))throw M.fail('Original repetido.');seen.add(change.path);const kind=M.classify(change.path),id=M.digest(change.path),path=M.ROOT+'/records/'+id,old=await read(path),before=M.image(change.path,change.before),after=M.image(change.path,change.after);
  if((old?.sourceHash??null)!==(before?.sourceHash??null))throw M.fail('El original y su cobertura financiera cambiaron.');
  if(old)for(const token of old.tokens||[])patch[M.ROOT+'/references/'+token+'/'+id]=null;
  if(kind.domain==='ventas'){
   for(const value of [before,after])if(value)for(const token of value.tokens||[]){for(const source of Object.keys(await bucket(M.ROOT+'/references/'+token)))affected.add(source);patch[M.ROOT+'/aliases/'+token+'/'+kind.saleKey]=value===after?true:null;}
   patch[M.ROOT+'/sales/'+kind.saleKey]=after?{generation:coverage.generation,sourceHash:after.sourceHash}:null;
  }else{
   coverage.counts[kind.domain]+=Number(after!==null)-Number(before!==null);
   if(!Number.isSafeInteger(coverage.counts[kind.domain])||coverage.counts[kind.domain]<0)throw M.fail('Contador financiero inválido.');
   affected.add(id);if(old)coverage.sources[kind.domain]=accumulator(coverage.sources[kind.domain],M.digest(old),-1);
  }
  patch[path]=after;if(after)for(const token of after.tokens||[])patch[M.ROOT+'/references/'+token+'/'+id]=true;
 }
 for(const id of affected){
  const path=M.ROOT+'/records/'+id,old=await read(path),next=await get(path);if(next?.domain==='ventas'||old?.domain==='ventas')continue;
  if(old){for(const saleKey of old.targets||[])patch[M.ROOT+'/bySale/'+saleKey+'/'+id]=null;if(old.unresolved)coverage.unresolved--;}
  if(next){const targets=new Set();for(const token of next.tokens||[])for(const [saleKey,present]of Object.entries(await bucket(M.ROOT+'/aliases/'+token))){if(present!==true||!M.key(saleKey))throw M.fail('Alias financiero inválido.');targets.add(saleKey);}
   const unresolved=targets.size>1||targets.size===0&&(next.commission||(next.tokens||[]).length>0);next.targets=[...targets].sort();next.unresolved=unresolved;patch[path]=M.normalizeRtdb(next);
   if(unresolved)coverage.unresolved++;else for(const saleKey of targets)patch[M.ROOT+'/bySale/'+saleKey+'/'+id]=true;
  }
  const domain=next?.domain||old?.domain;if(!seen.has(next?.path||old?.path)&&old)coverage.sources[domain]=accumulator(coverage.sources[domain],M.digest(old),-1);
  if(next)coverage.sources[domain]=accumulator(coverage.sources[domain],M.digest(M.normalizeRtdb(next)),1);
 }
 coverage.revision++;if(!Number.isSafeInteger(coverage.revision)||coverage.unresolved<0)throw M.fail('Revisión financiera inválida.');patch[M.ROOT+'/coverage']=coverage;return patch;
}
module.exports={delta};
