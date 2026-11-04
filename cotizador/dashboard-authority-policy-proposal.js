'use strict';
// Semantic policy projection only. Keep all unknown fields; do not mutate originals.
const {digest}=require('./labor-guard');
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
module.exports=Object.freeze({TELEMETRY,profile,projection,hash,profileHash});
