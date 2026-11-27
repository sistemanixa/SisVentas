'use strict';
const M=require('./sale-delete-target-index');
const F=require('./sale-financial-dependencies-model');
const Financial=require('./sale-delete-target-financial');
const Relations=require('./sale-delete-relations');
const Live=require('./sale-delete-live-financial-evidence');
const {pool}=require('./payment-snapshot');
const providers=new WeakSet(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function create({store,maxRecords=2048}={}){
 if(typeof store?.exists!=='function'||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>2048)throw TypeError('Falta el almacenamiento del circuito de vínculos.');
 const financial=Financial.create();
 const evidence=async({saleKey,read})=>{
  if(typeof read!=='function')throw M.fail('Falta la lectura de originales.');
  await Live.assertAbsent({read,exists:path=>store.exists(path)});
  const observed=new Map(),recordPromises=new Map(),buckets=new Map(),collections=Object.fromEntries(M.domains.map(domain=>[domain,{}]));
  const checkedRead=async path=>{const value=await read(path);observed.set(path,F.digest(value));return value;};
  const coverage=M.validateCoverage(await checkedRead(M.ROOT+'/coverage'));
  const config=M.validateConfig(await checkedRead(M.CONFIG),coverage);
  async function load(path){
   M.classify(path);
   if(!recordPromises.has(path)){
    if(recordPromises.size>=maxRecords)throw M.fail('La venta tiene demasiados vínculos para eliminarla en una operación.');
    recordPromises.set(path,(async()=>{
     const [row,metadata]=await Promise.all([checkedRead(path),checkedRead(M.recordPath(path))]);
     const image=M.validateRecord(path,row,metadata);if(!image)throw M.fail('Un vínculo apunta a un original inexistente.');
     if(collections[image.domain]&&image.domain!=='ctaemp')collections[image.domain][image.key]=row;
     return {row,image};
    })());
   }
   return recordPromises.get(path);
  }
  async function bucket(path){
   if(!buckets.has(path))buckets.set(path,(async()=>{
    const rows=await checkedRead(path);
    if(rows===null)return {};
    if(!M.plain(rows)||Object.values(rows).some(value=>value!==true))throw M.fail('El índice de vínculos requiere revisión.');
    return rows;
   })());
   return buckets.get(path);
  }
  async function candidates(paths){
   const unique=[...new Set(paths)],values=await pool(unique,bucket),origins=new Map();
   values.forEach((rows,index)=>{for(const id of Object.keys(rows)){if(!origins.has(id))origins.set(id,new Set());origins.get(id).add(unique[index].slice((M.ROOT+'/refs/').length));}});
   if(origins.size>maxRecords)throw M.fail('La venta tiene demasiados referencias para eliminarla en una operación.');
   await pool([...origins],async([id,tokens])=>{
    if(!hex(id))throw M.fail('Referencia de vínculo inválida.');
    const metadata=await checkedRead(M.ROOT+'/records/'+id);M.validateImage(metadata);
    if(F.digest(metadata.path)!==id)throw M.fail('Referencia de vínculo ajena.');
    if([...tokens].some(token=>!metadata.tokens?.includes(token)))throw M.fail('El vínculo no corresponde a su referencia inversa.');
    await load(metadata.path);
   });
  }
  const sale=(await load('sisventas/ventas/'+saleKey)).row;
  await candidates(M.bucketPathsForSale({...sale,fbKey:saleKey}));
  async function owners(){
   const images=await Promise.all(recordPromises.values()),paths=images.flatMap(value=>M.saleOwnerBucketPaths(value.image));
   const unique=[...new Set(paths)],values=await pool(unique,bucket),origins=new Map();
   values.forEach((rows,index)=>{for(const key of Object.keys(rows)){if(!origins.has(key))origins.set(key,new Set());origins.get(key).add(unique[index].slice((M.ROOT+'/saleAliases/').length));}});
   if(origins.size>maxRecords)throw M.fail('Las referencias comerciales requieren revisión.');
   await pool([...origins],async([key,tokens])=>{const value=await load('sisventas/ventas/'+key);if([...tokens].some(token=>!value.image.aliases?.includes(token)))throw M.fail('El alias no corresponde a la venta original.');});
  }
  await owners();
  const related=Relations.resolve(collections,saleKey);
  await candidates(M.bucketPathsForOTs(related.ordenes_trabajo));
  // Newly discovered claims/activity may carry aliases of another sale. Retain
  // those originals so the existing matcher keeps its ambiguity checks.
  await owners();
  const financialResult=await financial({saleKey,read:async path=>{
   if(path===F.ROOT||path.startsWith(F.ROOT+'/'))return checkedRead(M.financialPath(path));
   return (await load(path)).row;
  }});
  const finalCoverage=M.validateCoverage(await checkedRead(M.ROOT+'/coverage'));
  const finalConfig=M.validateConfig(await checkedRead(M.CONFIG),finalCoverage);
  if(F.digest(finalCoverage)!==F.digest(coverage)||F.digest(finalConfig)!==F.digest(config))throw M.fail('Los vínculos cambiaron durante la consulta.');
  return {financial:financialResult,collections,snapshot:{coverage,config,reads:Object.fromEntries([...observed].sort(([a],[b])=>a<b?-1:a>b?1:0))}};
 };
 providers.add(evidence);return Object.freeze(evidence);
}
module.exports={create,isProvider:value=>providers.has(value)};
