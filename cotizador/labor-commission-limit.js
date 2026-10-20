'use strict';
const {isDeepStrictEqual}=require('node:util');
const Index=require('./labor-index');
const {esComision,claveGrupo,porcentaje,normalizarEstadoGasto}=require('./commission-calculations');

const failure=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const corrupt=()=>failure(503,'No se pudo comprobar el grupo completo de comisiones. Revisá el índice antes de guardar.','SV_LABOR_INDEX_INVALID');
const record=value=>value==null||typeof value==='object'&&!Array.isArray(value);
const keyValid=key=>typeof key==='string'&&key&&Buffer.byteLength(key)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(key);
const groupOf=(key,value)=>value&&esComision(value)?claveGrupo({...value,fbKey:key}):null;
const linkedPath=value=>typeof value?.legacyKey==='string'&&/^ctaemp\/[^/.#$\[\]\x00-\x1f\x7f]+\/[^/.#$\[\]\x00-\x1f\x7f]+$/.test(value.legacyKey)?'sisventas/'+value.legacyKey:null;
async function readPair(raw,get,path){
 const results=await Promise.allSettled([raw,get].map(read=>Promise.resolve().then(()=>read(path))));
 const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 return results.map(result=>result.value);
}

// Await every request already started, including when one fails. No reader is
// left running after the guard releases the lease.
async function pool(items,work){
 let next=0,error;
 await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{
  while(!error&&next<items.length){const item=items[next++];try{await work(item);}catch(caught){error=error||caught;}}
 }));
 if(error)throw error;
}

// raw reads the state protected by the lease; get includes the staged patch.
// This validator never mutates either state, the business records or the index.
async function validateCommissionLimit({raw,get,changes=[],patch={}}){
 if(typeof raw!=='function'||typeof get!=='function'||!Array.isArray(changes)||!patch||typeof patch!=='object'||Array.isArray(patch))throw failure(400,'Validación de comisiones inválida');
 const pairs=new Map(),movements=new Map(),buckets=new Map(),groups=new Set(),affected=new Set();
 function addPair(key,before,after){
  if(!keyValid(key)||!record(before)||!record(after))throw corrupt();
  const pair={key,before,after};pairs.set(key,Promise.resolve(pair));return pair;
 }
 for(const change of changes){
  if(change?.domain!=='gastos')continue;
  if(pairs.has(change.key))throw failure(400,'Gasto repetido en la validación');
  addPair(change.key,change.before,change.after);affected.add(change.key);
 }
 function pairFor(key){
  if(!keyValid(key))throw corrupt();
  if(!pairs.has(key))pairs.set(key,(async()=>{
   const [before,after]=await readPair(raw,get,'sisventas/gastos/'+key);
   if(!record(before)||!record(after))throw corrupt();
   return {key,before,after};
  })());
  return pairs.get(key);
 }
 function bucket(index,value){
  const path=Index.bucketPath('gastos',index,value);
  if(!buckets.has(path))buckets.set(path,(async()=>{
   const result=await raw(path);
   if(result==null)return new Set();
   if(!record(result)||Object.entries(result).some(([key,present])=>!keyValid(key)||present!==true))throw corrupt();
   return new Set(Object.keys(result));
  })());
  return buckets.get(path);
 }
 function movement(path){
  if(!movements.has(path))movements.set(path,readPair(raw,get,path));
  return movements.get(path);
 }
 const touchedMoves=new Set();
 for(const path of Object.keys(patch)){
  if(path==='sisventas'||path==='sisventas/ctaemp')throw failure(400,'La cuenta del empleado debe modificarse por una ruta puntual.','SV_LABOR_CTA_SCOPE_REQUIRED');
  if(!path.startsWith('sisventas/ctaemp/'))continue;
  const parts=path.split('/');
  if(!keyValid(parts[2])||parts[3]!==undefined&&!keyValid(parts[3]))throw failure(400,'Ruta de cuenta del empleado inválida');
  if(parts.length>=4){touchedMoves.add(parts.slice(0,4).join('/'));continue;}
  // Existing payment paths may replace one employee's account. This is the
  // widest permitted read; never request the complete ctaemp collection.
  const [before,after]=await movement(path);
  if(!record(before)||!record(after))throw corrupt();
  for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
   if(!keyValid(key))throw corrupt();
   if(!isDeepStrictEqual(before?.[key],after?.[key]))touchedMoves.add(path+'/'+key);
  }
 }
 for(const path of touchedMoves){
  const legacyKey=path.slice('sisventas/'.length),members=await bucket('legacyKey',legacyKey);
  await pool([...members],async key=>{
   const pair=await pairFor(key);
   if(!pair.before||pair.before.legacyKey!==legacyKey)throw corrupt();
   affected.add(key);
  });
 }
 for(const key of affected){
  const pair=await pairFor(key);
  for(const value of [pair.before,pair.after]){const group=groupOf(key,value);if(group!==null)groups.add(group);}
 }
 const summaries=[];
 for(const group of groups){
  const members=await bucket('commissionGroup',group),keys=new Set(members);
  // Old membership must be present; new or moved commissions are deliberately
  // absent from the old index until the same financial commit updates it.
  for(const key of affected){
   const pair=await pairFor(key);
   if(groupOf(key,pair.before)===group&&!members.has(key))throw corrupt();
   if(groupOf(key,pair.after)===group)keys.add(key);
  }
  const amounts=new Map();
  await pool([...keys],async key=>{
   const pair=await pairFor(key);
   if(members.has(key)&&groupOf(key,pair.before)!==group)throw corrupt();
   const values=[];
   for(const [position,value]of [pair.before,pair.after].entries()){
    if(groupOf(key,value)!==group||normalizarEstadoGasto(value)==='rechazado'){values.push(0);continue;}
    const path=linkedPath(value),move=path?(await movement(path))[position]:null;
    values.push(porcentaje(value,move));
   }
   amounts.set(key,values);
  });
  let before=0,after=0;
  for(const key of keys){const value=amounts.get(key);before+=value[0];after+=value[1];}
  summaries.push({group,before,after});
 }
 if(summaries.some(value=>value.after>value.before)){
  const max=Number(await get('sisventas/config/maxComisionPct'))||10;
  if(summaries.some(value=>value.after>value.before&&value.after>max+0.001))throw failure(409,'El total de comisiones de la venta supera el porcentaje máximo permitido.','SV_LABOR_COMMISSION_LIMIT');
 }
 return {checked:groups.size};
}

module.exports={validateCommissionLimit};
