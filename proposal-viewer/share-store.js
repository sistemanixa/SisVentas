'use strict';
// Private, create-only GCS persistence for public proposal snapshots. This module
// has no credentials, HTTP handler, production bucket name, timers, or delete API.
const Public=require('../cotizador/proposal-share-model');
const HASH=/^[a-f0-9]{64}$/,UID=/^[A-Za-z0-9_-]{1,128}$/,MAX_BYTES=512*1024,MARKER_BYTES=2048,MAX_TTL=168*3600000;
const MISSING=Symbol('missing');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,keys)=>object(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const user=v=>typeof v==='string'&&UID.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const fail=(statusCode=503)=>Object.assign(Error(statusCode===413?'La presentación supera el tamaño permitido.':'No se pudo comprobar el enlace de presentación.'),{statusCode,code:'PROPOSAL_SHARE_STORAGE'});
const status=error=>Number(error?.code||error?.statusCode);
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function createGCSShareStore({bucket,now=Date.now}={}){
 if(!bucket||typeof bucket.file!=='function'||typeof now!=='function')throw Error('Injected private bucket required');
 function clock(){const at=now();if(!Number.isSafeInteger(at)||at<0)throw fail();return at;}
 function names(hash){if(typeof hash!=='string'||!HASH.test(hash))throw fail(400);return {snapshot:'snapshots/'+hash+'.json',marker:'revoked/'+hash+'.json'};}
 function validateSnapshot(record){
  if(!own(record,['schema','createdBy','createdAt','expiresAt','revokedAt','proposals'])||record.schema!==1||!user(record.createdBy)||!Number.isSafeInteger(record.createdAt)||record.createdAt<0||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=record.createdAt||record.expiresAt-record.createdAt>MAX_TTL||record.revokedAt!==null||!Array.isArray(record.proposals)||!record.proposals.length||record.proposals.length>12)throw fail();
  const proposals=record.proposals.map(Public.publicProposal),safe={schema:1,createdBy:record.createdBy,createdAt:record.createdAt,expiresAt:record.expiresAt,revokedAt:null,proposals};
  // Store only the model's exact public schema. Unknown/private nested fields
  // are rejected, rather than silently persisted alongside the visible DTO.
  if(canonical(safe)!==canonical(record))throw fail();
  const bytes=Buffer.from(JSON.stringify(safe),'utf8');if(bytes.length>MAX_BYTES)throw fail(413);return {safe,bytes};
 }
 function validateMarker(marker){if(!own(marker,['schema','createdBy','revokedAt','revokedBy'])||marker.schema!==1||!user(marker.createdBy)||!user(marker.revokedBy)||!Number.isSafeInteger(marker.revokedAt)||marker.revokedAt<0)throw fail();return marker;}
 async function get(name,limit){
  let stream;
  try{
   stream=bucket.file(name).createReadStream({validation:'crc32c'});let size=0;const parts=[];
   for await(const part of stream){const bytes=Buffer.from(part);size+=bytes.length;if(size>limit){stream.destroy?.();throw fail(413);}parts.push(bytes);}
   const value=JSON.parse(Buffer.concat(parts).toString('utf8'));return value;
  }catch(error){stream?.destroy?.();if(status(error)===404)return MISSING;if(error?.code==='PROPOSAL_SHARE_STORAGE')throw error;throw fail();}
 }
 async function marker(name){const result=await get(name,MARKER_BYTES);return result===MISSING?null:validateMarker(result);}
 async function put(name,bytes){
  try{await bucket.file(name).save(bytes,{resumable:false,validation:'crc32c',preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:'application/json; charset=utf-8',cacheControl:'private, no-store, max-age=0'}});return true;}
  catch(error){if(status(error)===412)return false;throw fail();}
 }
 function revokedMeta(value){return {schema:1,createdBy:value.createdBy,revokedAt:value.revokedAt};}
 async function create(hash,record){
  const paths=names(hash),{safe,bytes}=validateSnapshot(record),at=clock();if(safe.createdAt>at||safe.expiresAt<=at)throw fail(410);
  // A tombstone wins even if the corresponding snapshot was externally lost.
  if(await marker(paths.marker))return false;
  return put(paths.snapshot,bytes);
 }
 async function read(hash){
  const paths=names(hash),before=await marker(paths.marker);if(before)return revokedMeta(before);
  const value=await get(paths.snapshot,MAX_BYTES);if(value===MISSING)return null;
  const {safe}=validateSnapshot(value),after=await marker(paths.marker);
  if(after)return revokedMeta(after);
  const at=clock();if(safe.createdAt>at||safe.expiresAt<=at)return null;
  return safe;
 }
 async function revoke(hash,{createdBy,at,by}={}){
  const paths=names(hash);if(!user(createdBy)||!user(by)||!Number.isSafeInteger(at)||at<0||at>clock())throw fail(400);
  const before=await marker(paths.marker);if(before)return before.createdBy===createdBy;
  const original=await get(paths.snapshot,MAX_BYTES);if(original===MISSING)return false;
  const {safe}=validateSnapshot(original);if(safe.createdBy!==createdBy)return false;
  const tombstone={schema:1,createdBy,revokedAt:at,revokedBy:by},bytes=Buffer.from(JSON.stringify(tombstone),'utf8');
  if(await put(paths.marker,bytes))return true;
  // A concurrent revoker may have won. Never overwrite their author or time.
  const winner=await marker(paths.marker);return !!winner&&winner.createdBy===createdBy;
 }
 return Object.freeze({create,read,revoke});
}
module.exports=Object.freeze({createGCSShareStore,MAX_BYTES});
