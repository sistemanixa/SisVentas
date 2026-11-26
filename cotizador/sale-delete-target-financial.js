'use strict';
const M=require('./sale-financial-dependencies-model');
const {pool}=require('./payment-snapshot');
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const maxCandidates=2048;
const fail=()=>M.fail('Las referencias financieras de esta venta requieren revisión.');
function create(){return async function evidence({saleKey,read}={}){
 if(!M.key(saleKey)||typeof read!=='function')throw fail();
 const cache=new Map(),entries=new Map(),validations=new Map(),pending=new Set(),queue=[];let active=0;
 // A single request-local IO queue bounds nested reference/owner validation too.
 function pump(){while(active<6&&queue.length){const job=queue.shift();active++;Promise.resolve().then(()=>read(job.path)).then(job.resolve,job.reject).finally(()=>{active--;pump();});}}
 function fresh(path){const p=new Promise((resolve,reject)=>{queue.push({path,resolve,reject});pump();});pending.add(p);p.then(()=>pending.delete(p),()=>pending.delete(p));return p;}
 function point(path){if(!cache.has(path))cache.set(path,fresh(path));return cache.get(path);}
 function membership(value,{owners=false}={}){if(value===null)return {};if(!plain(value)||Object.entries(value).some(([id,present])=>(owners?!M.key(id):!hex(id))||present!==true))throw fail();return value;}
 const same=(a,b)=>M.digest(a)===M.digest(b);
 async function entry(id){
  if(!hex(id))throw fail();
  if(!entries.has(id)){if(entries.size>=maxCandidates)throw fail();entries.set(id,(async()=>{
   const stored=await point(M.ROOT+'/records/'+id);if(!plain(stored)||typeof stored.path!=='string'||M.digest(stored.path)!==id||!hex(stored.sourceHash))throw fail();
   const kind=M.classify(stored.path),raw=await point(stored.path),image=M.image(stored.path,raw);if(!image||stored.domain!==kind.domain||stored.sourceHash!==image.sourceHash)throw fail();
   const base={...stored};delete base.targets;delete base.unresolved;
   if(kind.domain==='ventas'){if(!same(stored,image))throw fail();}
   else if(!same(base,image)||typeof stored.unresolved!=='boolean'||Object.hasOwn(stored,'targets')&&(!Array.isArray(stored.targets)||!stored.targets.length||stored.targets.some(k=>!M.key(k))||!same(stored.targets,[...new Set(stored.targets)].sort())))throw fail();
   return {stored,raw,image};
  })());}
  return entries.get(id);
 }
 async function validate(id){
  if(!validations.has(id))validations.set(id,(async()=>{
   const item=await entry(id),{stored,image}=item;if(stored.domain==='ventas')return {...item,targets:[],unresolved:false};
   const tokens=image.tokens||[],aliases=await pool(tokens,async token=>({token,owners:membership(await point(M.ROOT+'/aliases/'+token),{owners:true})})),origins=new Map();
   for(const {token,owners}of aliases)for(const owner of Object.keys(owners)){if(!origins.has(owner))origins.set(owner,new Set());origins.get(owner).add(token);}
   await pool([...origins],async([owner,tokens])=>{const candidate=await entry(M.digest('sisventas/ventas/'+owner));if(candidate.stored.domain!=='ventas'||[...tokens].some(token=>!(candidate.image.tokens||[]).includes(token)))throw fail();});
   const targets=[...origins.keys()].sort(),unresolved=targets.length>1||targets.length===0&&(image.commission||(image.tokens||[]).length>0);
   if(!same(stored,M.normalizeRtdb({...image,targets,unresolved})))throw fail();
   await pool(tokens,async token=>{if(await point(M.ROOT+'/references/'+token+'/'+id)!==true)throw fail();});
   return {...item,targets,unresolved};
  })());
  return validations.get(id);
 }
 try{
  const salePath='sisventas/ventas/'+saleKey,targetId=M.digest(salePath),initial=await pool([M.ROOT+'/coverage',salePath,M.ROOT+'/sales/'+saleKey,M.ROOT+'/bySale/'+saleKey,M.ROOT+'/candidatesBySale/'+saleKey,M.ROOT+'/records/'+targetId],point);
  const coverage=M.validateCoverage(initial[0]),sale=initial[1],certificate=initial[2],bySale=membership(initial[3]),candidates=membership(initial[4]);
  if(!plain(sale)||!plain(certificate)||Object.keys(certificate).sort().join(',')!=='generation,sourceHash'||certificate.generation!==coverage.generation||certificate.sourceHash!==M.sourceDigest(sale))throw fail();
  const target=await entry(targetId),tokens=target.image.tokens||[],references=await pool(tokens,async token=>{
   const pair=await pool([M.ROOT+'/references/'+token,M.ROOT+'/aliases/'+token+'/'+saleKey],point),rows=membership(pair[0]);if(rows[targetId]!==true||pair[1]!==true)throw fail();return {token,rows};
  }),referenceOrigins=new Map();
  for(const {token,rows}of references)for(const id of Object.keys(rows)){if(!referenceOrigins.has(id))referenceOrigins.set(id,new Set());referenceOrigins.get(id).add(token);}
  const ids=[...new Set([...referenceOrigins.keys(),...Object.keys(candidates),...Object.keys(bySale)])].sort();if(ids.length>maxCandidates)throw fail();
  const values=await pool(ids,async id=>{const value=await validate(id);if([...(referenceOrigins.get(id)||[])].some(token=>!(value.image.tokens||[]).includes(token)))throw fail();return {id,...value};});
  const expected=values.filter(v=>v.stored.domain!=='ventas'&&v.targets.includes(saleKey)),resolved=expected.filter(v=>!v.unresolved);
  if(!same(Object.keys(candidates).sort(),expected.map(v=>v.id).sort())||!same(Object.keys(bySale).sort(),resolved.map(v=>v.id).sort()))throw fail();
  if(expected.some(value=>value.unresolved))throw M.fail('La venta tiene referencias financieras ambiguas; conciliá esos vínculos antes de eliminar.');
  if(!same(await fresh(M.ROOT+'/coverage'),coverage))throw M.fail('La cobertura financiera cambió durante la lectura.');
  return {schema:1,scope:'complete-financial-dependencies',saleKey,generation:coverage.generation,revision:coverage.revision,sources:coverage.sources,globalUnresolved:coverage.unresolved,dependencies:resolved.map(({stored})=>({path:stored.path,sourceHash:stored.sourceHash}))};
 }catch(error){await Promise.allSettled([...pending]);throw error;}
};}
module.exports={create};
