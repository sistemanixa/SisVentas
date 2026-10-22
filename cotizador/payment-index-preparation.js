'use strict';
const Index=require('./payment-membership-index');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
// A plan is not activation. This module has no database, credentials, clock,
// interval, migration endpoint or import side effects.
function plan(payments,{generation,maxPatchBytes=8*1024*1024,maxLeaves=18000}={}){
 const source=Index.normalizeRtdb(payments),built=Index.buildIndex(source,{generation,ready:false});
 const indexBytes=Buffer.byteLength(JSON.stringify(built.patch)),sourceBytes=Buffer.byteLength(JSON.stringify(source)),leaves=Object.keys(built.patch).length;
 return {sourceDigest:Index.digest(source),sourceBytes,indexBytes,leaves,requiresStaging:indexBytes>maxPatchBytes||leaves>maxLeaves,...built};
}
function verify(payments,storedIndex,{generation,maxPatchBytes=8*1024*1024,maxLeaves=18000}={}){
 const expected=plan(payments,{generation,maxPatchBytes,maxLeaves});
 if(expected.requiresStaging)throw fail(413,'El índice requiere preparación por etapas y un corte específico');
 const actual=Index.normalizeRtdb(storedIndex),root=Object.create(null);
 for(const [p,value]of Object.entries(expected.patch)){
  const relative=p.slice(Index.INDEX_ROOT.length+1).split('/');let node=root;
  for(const part of relative.slice(0,-1)){if(!Object.hasOwn(node,part))Object.defineProperty(node,part,{value:Object.create(null),enumerable:true});node=node[part];}
  Object.defineProperty(node,relative.at(-1),{value,enumerable:true});
 }
 if(Index.digest(actual)!==Index.digest(Index.normalizeRtdb(root)))throw fail(409,'La lectura de comprobación del índice no coincide con el plan completo');
 return {sourceDigest:expected.sourceDigest,sourceBytes:expected.sourceBytes,indexBytes:expected.indexBytes,leaves:expected.leaves,coverage:{...expected.coverage,ready:true}};
}
module.exports={plan,verify};
