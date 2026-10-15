'use strict';
const assert=require('node:assert/strict');
const {createUserAccess}=require('../../cotizador/user-access');
const {build}=require('../../scripts/prepare-password-access.cjs');
function fixture(options = {}) {
  let time = 1800000000000, serial = 0;
  const data = {sv_chat_roles: {admin: {rol:'admin',activo:true},worker: {rol:'tecnico',activo:true},other: {rol:'administrativo',activo:true}},
    sv_usuarios: {p: {uid:'worker',rol:'tecnico',activo:true,mail:'worker@example.test'}}, sv_permisos:{admin:{}}};
  const get = p => p.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data) ?? null;
  const set = (p,v) => {const keys=p.split('/').filter(Boolean),last=keys.pop();let o=data;for(const k of keys)o=o[k]??={};o[last]=structuredClone(v);};
  const db = {getRulesJSON:async()=>build({rules:{items:{'.read':'auth != null'}}}),ref(p) {let queryField,queryValue;return {get:async()=>({val:()=> queryField ? Object.fromEntries(Object.entries(get(p)||{}).filter(([,v])=>v[queryField]===queryValue)):structuredClone(get(p))}),
    set:async v=>set(p,v),update:async v=>set(p,{...get(p),...v}),push(){return db.ref(p+'/event'+(++serial));},
    orderByChild(f){queryField=f;return this;},equalTo(v){queryValue=v;return this;},
    transaction:async callback=>{const next=callback(structuredClone(get(p)));if(next===undefined)return {committed:false};set(p,next);return {committed:true,snapshot:{val:()=>structuredClone(next)}};}};}};
  const users={worker:{uid:'worker',email:'worker@example.test',disabled:false,customClaims:{unrelated:true}}};
  const passwords={},updates=[],emails=[],tokens={admin:{uid:'admin',auth_time:time/1000},other:{uid:'other',auth_time:time/1000},old:{uid:'worker',firebase:{sign_in_provider:'password'}}};
  const auth={verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(!tokens[token])throw Error('invalid');return {...tokens[token]};},getUser:async uid=>structuredClone(users[uid]),
    updateUser:async(uid,values)=>{updates.push({uid,fields:Object.keys(values)});if(options.failPassword && values.password)throw Error('SENSITIVE RAW ERROR');if(values.password)passwords[uid]=values.password;else Object.assign(users[uid],values);},
    revokeRefreshTokens:async()=>{},setCustomUserClaims:async(uid,claims)=>{users[uid].customClaims=claims;}};
  const service=createUserAccess({auth,db,sendResetEmail:async mail=>{emails.push(mail);},enabled:options.enabled!==false,now:()=>time});
  return {service,auth,db,data,users,passwords,updates,emails,tokens,get,set,advance:()=>{time+=61000;tokens.admin.auth_time=time/1000;},request:token=>({headers:{authorization:'Bearer '+token}})};
}
module.exports={fixture};
