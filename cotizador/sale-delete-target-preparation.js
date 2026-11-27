'use strict';
const M=require('./sale-delete-target-index');
const {digest,canonical}=require('./labor-guard');
const {createHash}=require('node:crypto');
const {pool}=require('./payment-snapshot');
const plans=new WeakMap(),manifests=new WeakMap(),MiB=1024*1024;
const streamedRoots=Object.freeze(['sisventas/ordenes_trabajo','sisventas/reclamos']);
const retainedRoots=M.roots.filter(root=>!streamedRoots.includes(root));
const streamBudget=Object.freeze({'sisventas/ordenes_trabajo':80*MiB,'sisventas/reclamos':32*MiB});
const fail=message=>M.fail(message);
function checkKeys(reply,root){
 if(!M.plain(reply)||typeof reply.exists!=='boolean'||!Array.isArray(reply.keys)||reply.keys.length>5000||Buffer.byteLength(JSON.stringify(reply))>MiB||!reply.exists&&reply.keys.length)throw fail('El inventario de claves requiere revisión.');
 const keys=[...reply.keys].sort();if(new Set(keys).size!==keys.length)throw fail('El inventario de claves está repetido.');
 for(const key of keys){if(typeof key!=='string')throw fail('El inventario de claves requiere revisión.');M.classify(root+'/'+key);}
 return {keys,exists:reply.exists,keyHash:digest({keys,exists:reply.exists})};
}
async function scan({ports,assertActive,retainedBytes,expected}){
 if(typeof ports?.keys!=='function'||typeof ports?.read!=='function'||typeof assertActive!=='function')throw fail('Falta el lector acotado de preparación.');
 const states=[],images=[];let streamedBytes=0;
 for(const root of streamedRoots){
  assertActive();const start=checkKeys(await ports.keys(root),root);assertActive();
  const previous=expected?.find(entry=>entry.root===root);
  if(expected&&(!previous||previous.keyHash!==start.keyHash))throw fail('Las claves cambiaron durante la preparación.');
  const rawHashes=Object.create(null),hasher=createHash('sha256');let first=true,rootBytes=0;
  hasher.update(start.exists?'{':'null');
  for(let offset=0;offset<start.keys.length;offset+=6){
   const batch=await pool(start.keys.slice(offset,offset+6),async key=>{
    assertActive();const row=await ports.read(root,key);assertActive();
    if(!M.plain(row))throw fail('Un original de preparación cambió o no está completo.');
    const bytes=Buffer.byteLength(JSON.stringify(row));rootBytes+=bytes;streamedBytes+=bytes;
    if(bytes>8*MiB||rootBytes>streamBudget[root]||streamedBytes>112*MiB||retainedBytes+streamedBytes>128*MiB)throw fail('La preparación excede el alcance permitido.');
    const raw=canonical(row),hash=createHash('sha256').update(raw).digest('hex');
    if(previous&&previous.rawHashes[key]!==hash)throw fail('Un original cambió durante la preparación.');
    return {key,raw,hash,image:expected?null:M.image(root+'/'+key,row)};
   });
   for(const item of batch){
    if(!first)hasher.update(',');hasher.update(JSON.stringify(item.key)+':');hasher.update(item.raw);first=false;
    rawHashes[item.key]=item.hash;if(item.image)images.push(item.image);delete item.raw;
   }
  }
  if(start.exists)hasher.update('}');const rootHash=hasher.digest('hex');
  assertActive();const end=checkKeys(await ports.keys(root),root);assertActive();
  if(end.keyHash!==start.keyHash||previous&&previous.rootHash!==rootHash)throw fail('Un original o sus claves cambiaron durante la preparación.');
  states.push({root,rootHash,keyHash:start.keyHash,rawHashes,bytes:rootBytes});
 }
 return {states,images};
}
async function prepare({scope,store,reader}){
 const actor=scope?.actor;
 if(actor?.mode!=='user'||actor.role!=='admin'||actor.financialAction!=='ventas.eliminar.preparar'||typeof scope.installSaleDeleteRelations!=='function'||typeof scope.assertActive!=='function')throw fail('La preparación requiere mantenimiento administrativo.');
 if(typeof reader?.phase!=='function')throw Object.assign(Error('Falta el lector acotado de preparación.'),{statusCode:503,code:'SV_SALE_DELETE_PREPARATION_READER_REQUIRED'});
 scope.assertActive();if(await store.exists('sv_sale_delete_relations')!==false||await scope.get(M.CONFIG)!==null)throw fail('El circuito ya existe; no se sustituye durante una preparación.');
 const ports=reader.phase('initial');let retainedBytes=0;
 const values=await pool(retainedRoots,async path=>{
  const value=await scope.get(path);scope.assertActive();
  if(value!==null&&!M.plain(value))throw fail('La preparación requiere fuentes completas.');
  const bytes=Buffer.byteLength(JSON.stringify(value));retainedBytes+=bytes;
  if(bytes>(path==='sisventas/gastos'?16:8)*MiB||retainedBytes>64*MiB)throw fail('La preparación excede el alcance permitido.');return value;
 });
 const sources=Object.fromEntries(retainedRoots.map((root,index)=>[root,values[index]])),hashes=Object.fromEntries(retainedRoots.map((root,index)=>[root,digest(values[index])]));
 const scanned=await scan({ports,assertActive:()=>scope.assertActive(),retainedBytes});
 for(const state of scanned.states)hashes[state.root]=state.rootHash;
 const generation='links-'+digest({uid:actor.uid,opId:scope.lease.opId}).slice(0,48),prepared=await M.prepareWithImages(sources,{generation,images:scanned.images}),plan=Object.freeze({});
 scope.assertActive();plans.set(plan,{scope,uid:actor.uid,opId:scope.lease.opId,patch:prepared.patch,hashes,reader,states:scanned.states,retainedBytes});
 await scope.installSaleDeleteRelations(plan);return {ok:true,committed:true,prepared:true,generation};
}
function consume(plan,actor,lease,scope){
 const proof=plans.get(plan);if(!proof||proof.scope!==scope||actor.mode!=='user'||actor.role!=='admin'||actor.financialAction!=='ventas.eliminar.preparar'||proof.uid!==actor.uid||proof.opId!==lease.opId)throw fail('La preparación no corresponde a este guardado.');
 plans.delete(plan);const streamedToken=Object.freeze({});manifests.set(streamedToken,{reader:proof.reader,states:proof.states,retainedBytes:proof.retainedBytes});
 return {patch:structuredClone(proof.patch),hashes:structuredClone(proof.hashes),streamedToken};
}
async function assertStreamedFresh(token,{assertActive}={}){
 const proof=manifests.get(token);if(!proof||typeof assertActive!=='function')throw fail('Falta la verificación privada de originales.');manifests.delete(token);
 assertActive();const ports=proof.reader.phase('fresh');await scan({ports,assertActive,retainedBytes:proof.retainedBytes,expected:proof.states});assertActive();
}
module.exports={prepare,consume,assertStreamedFresh};
