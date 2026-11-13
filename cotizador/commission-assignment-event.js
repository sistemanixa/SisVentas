'use strict';
// Native RTDB ReferenceEventData.data is the original and delta is the merge.
// Classification never trusts a persisted opt-out flag or current sale state.
const {digest}=require('./labor-guard');
const object=v=>!!v&&typeof v==='object',record=v=>object(v)&&!Array.isArray(v),same=(a,b)=>digest(a)===digest(b),own=(v,k)=>Object.hasOwn(v||{},k);
function merge(before,delta,depth=0){if(depth>40)throw Error('Evento demasiado profundo');if(!object(before)||!object(delta))return delta;const after={};for(const k of new Set([...Object.keys(before),...Object.keys(delta)])){if(['__proto__','constructor','prototype'].includes(k))throw Error('Clave de evento inválida');if(own(delta,k)){if(delta[k]!==null)Object.defineProperty(after,k,{value:merge(before[k],delta[k],depth+1),enumerable:true,writable:true});}else if(before[k]!==null)Object.defineProperty(after,k,{value:before[k],enumerable:true,writable:true});}return after;}
function auditRows(value){if(value==null)return[];if(!object(value))return null;const keys=Object.keys(value);if(keys.some(k=>!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>100000))return null;const length=Array.isArray(value)?value.length:keys.length?Math.max(...keys.map(Number))+1:0;if(length>100001)return null;return Array.from({length},(_,i)=>own(value,String(i))?value[i]:null);}
function isAssignmentOnly(payload){
 try{
  if(!record(payload)||!own(payload,'data')||!own(payload,'delta')||!record(payload.data)||!record(payload.delta))return false;
  const before=payload.data,after=merge(before,payload.delta),fields=['comisionadoPrincipalFbKey','comisionadoPrincipal','audit'];
  if(!record(after)||!fields.slice(0,2).some(k=>!same(before[k],after[k])))return false;
  for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(!fields.includes(k)&&!same(before[k],after[k]))return false;
  if(typeof after.comisionadoPrincipalFbKey!=='string'||!after.comisionadoPrincipalFbKey||typeof after.comisionadoPrincipal!=='string'||!after.comisionadoPrincipal.trim())return false;
  const old=auditRows(before.audit),next=auditRows(after.audit);if(!old||!next||next.length!==old.length+1||!same(next.slice(0,-1),old))return false;
  const e=next.at(-1),keys=['tipo','actorUid','usuario','fecha','accion','empleadoFbKey','empleadoNombre'];
  return same(Object.keys(e).sort(),keys.sort())&&e.tipo==='comisionado_principal_asignado'&&typeof e.actorUid==='string'&&e.actorUid.length>0&&typeof e.usuario==='string'&&e.usuario.trim().length>0&&typeof e.fecha==='string'&&Number.isFinite(Date.parse(e.fecha))&&e.accion==='Comisionado principal asignado'&&e.empleadoFbKey===after.comisionadoPrincipalFbKey&&e.empleadoNombre===after.comisionadoPrincipal;
 }catch{return false;}
}
module.exports={isAssignmentOnly,merge};
