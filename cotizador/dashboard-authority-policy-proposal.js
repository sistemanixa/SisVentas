'use strict';
// Semantic policy projection only. Keep all unknown fields; do not mutate originals.
const {digest}=require('./labor-guard');
const Own=require('./commercial-ownership');
const TELEMETRY=Object.freeze(['ultimoAcceso','ultimoAccesoEn']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function profile(value){
 if(!object(value))return structuredClone(value);
 return Object.fromEntries(Object.entries(value).filter(([field])=>!TELEMETRY.includes(field)).map(([field,v])=>[field,structuredClone(v)]));
}
function projection({users,identities,permissions}){
 return {users:object(users)?Object.fromEntries(Object.entries(users).map(([id,value])=>[id,profile(value)])):structuredClone(users),identities:structuredClone(identities),permissions:structuredClone(permissions)};
}
const hash=authority=>digest(projection(authority));
const profileHash=value=>digest(profile(value));
// Exactly the effective legacy ownership lookup: UID membership and normalized aliases.
// Roles affect Own.profiles eligibility, but are not themselves an ownership key.
function ownershipProjection({users,identities}){
 return Own.profiles(users,identities).map(p=>({uid:p.uid,aliases:[...new Set(p.aliases)].sort()})).sort((a,b)=>a.uid<b.uid?-1:a.uid>b.uid?1:0);
}
const ownershipHash=authority=>digest(ownershipProjection(authority));
module.exports=Object.freeze({TELEMETRY,profile,projection,hash,profileHash,ownershipProjection,ownershipHash});
