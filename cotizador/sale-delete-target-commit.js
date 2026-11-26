'use strict';
// Validates the extra Graph projection before the unchanged OT verifier sees
// its original business plan. Never changes the real wire patch or issues claims.
const Graph=require('./sale-delete-target-projections'),Model=require('./sale-delete-target-index');
const {digest,parts,child,put}=require('./labor-guard'),{pool}=require('./payment-snapshot');
const ROOT='sv_sale_delete_relations';
const graphPath=p=>p===ROOT||p.startsWith(ROOT+'/');
const fail=()=>Object.assign(Error('La proyección de vínculos de la OT cambió; no se confirmó la operación.'),{statusCode:409,code:'SV_SALE_DELETE_TARGET_COMMIT'});
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
async function prepareOTPatch({patch,actor,lease,readFresh,existsFresh,now=Date.now}={}){
 if(!plain(patch))throw fail();for(const path of Object.keys(patch))parts(path);
 const wire=structuredClone(patch),actualGraph=Object.fromEntries(Object.entries(wire).filter(([p])=>graphPath(p)));
 if(!Object.keys(actualGraph).length&&actor?.saleDeleteRelationsWriterVersion!==1)return wire;
 if(Object.hasOwn(wire,ROOT)||actor?.operation!=='ot-delete'||actor.saleDeleteRelationsWriterVersion!==1||!['user','command'].includes(actor.mode)||actor.claims?.uid!==actor.uid||actor.uid!==lease?.actorUid||actor.opId!==lease?.opId||actor.mode!==lease.mode||typeof readFresh!=='function'||typeof existsFresh!=='function'||typeof now!=='function')throw fail();
 const binding=digest({actor,lease}),wireHash=digest(patch),inputHash=actor.transportDigest||digest(actor.input);
 function live(){if(!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now()||typeof lease.fence!=='string'||!lease.fence||lease.digest!==inputHash||digest({actor,lease})!==binding||digest(patch)!==wireHash)throw fail();}
 const observed=new Map();
 const allowed=p=>p==='sv_labor_guard'||graphPath(p)||Model.roots.some(root=>p===root||p.startsWith(root+'/'));
 async function raw(path){parts(path);if(!allowed(path))throw fail();live();if(!observed.has(path)){
   const value=await readFresh(path);live();observed.set(path,structuredClone(value));
  }return structuredClone(observed.get(path));
 }
 live();const activeLease=await raw('sv_labor_guard');if(digest(activeLease)!==digest(lease))throw fail();
 Model.validateConfig(await raw(Model.CONFIG),Model.validateCoverage(await raw(Model.ROOT+'/coverage')));
 const filtered=Object.fromEntries(Object.entries(wire).filter(([p])=>!graphPath(p))),expected=structuredClone(filtered);
 async function get(path){let value=await raw(path);for(const[p,v]of Object.entries(filtered)){
   if(p===path)value=structuredClone(v);else if(path.startsWith(p+'/'))value=child(v,parts(path.slice(p.length+1)));else if(p.startsWith(path+'/'))value=put(value,parts(p.slice(path.length+1)),v);
  }return value;
 }
 const result=await Graph.augment({patch:expected,raw,get,exists:async path=>{if(path!==ROOT)throw fail();live();const present=await existsFresh(path);live();return present;}});live();
 const expectedGraph=Object.fromEntries(Object.entries(expected).filter(([p])=>graphPath(p)));
 if(result?.maintained!==true||digest(expectedGraph)!==digest(actualGraph)||digest(Object.fromEntries(Object.entries(expected).filter(([p])=>!graphPath(p))))!==digest(filtered))throw fail();
 await pool([...observed],async([path,value])=>{live();const fresh=await readFresh(path);live();if(digest(fresh)!==digest(value))throw fail();});
 live();if(digest(await readFresh('sv_labor_guard'))!==digest(lease))throw fail();live();
 return filtered;
}
module.exports={prepareOTPatch};
