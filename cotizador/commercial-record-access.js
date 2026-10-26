'use strict';
// Internal replacement for an original-record read when that original is no
// longer readable by the browser. Authority is checked before a record leaves
// this module, and every authority/source input can be revalidated before commit.
const Ownership=require('./commercial-ownership'),Reads=require('./domain-read-policy'),View=require('./commercial-view-protocol');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code});
const normalize=value=>String(value||'').trim().normalize('NFC').toLocaleLowerCase('es');
function linkedKey(value){if(!value||!['string','number','boolean'].includes(typeof value))return null;const id=String(value);try{View.domainKey('presupuestos',id);return id;}catch(_){return null;}}
async function createRequest(actor,read){
 if(!actor?.uid||actor.claims?.uid!==actor.uid||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||typeof read!=='function')throw fail(403,'SV_COMMERCIAL_AUTH','La sesión no coincide con la cuenta.');
 const values=new Map();async function source(path){if(!values.has(path))values.set(path,structuredClone(await read(path)));return structuredClone(values.get(path));}
 const profile=await source('sv_chat_roles/'+actor.uid),role=profile?.rol;if(profile?.activo!==true||actor.role&&actor.role!==role||actor.claims.svPasswordChangeRequired===true)throw fail(403,'SV_COMMERCIAL_AUTH_CHANGED','La sesión comercial cambió.');
 const reset=await source('sv_access_resets/'+actor.uid);if(reset?.required===true||reset?.version!==undefined&&reset.version!==actor.claims.svAccessVersion)throw fail(403,'SV_COMMERCIAL_AUTH_CHANGED','Actualizá tu acceso y volvé a ingresar.');
 const cfg=await source('sv_permisos/'+role),permissions={[role]:cfg};
 async function get(domain,id){
  const paths=View.domainKey(domain,id),canRead=Reads.allows(domain,role,m=>Ownership.moduleAllowed(role,m,permissions),name=>{const [group,action]=name.split('.'),value=cfg?.acciones?.[group]?.[action];return typeof value==='boolean'?value:role==='admin';});
  if(!canRead)throw fail(403,'SV_COMMERCIAL_PERMISSION','No tenés acceso a esta ficha comercial.');
  const raw=await source(paths.raw);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail(404,'SV_COMMERCIAL_MISSING','Ficha comercial no disponible.');
  if(role!=='admin'){
   let current=raw,currentDomain=domain;
   if(!Object.hasOwn(raw,'responsableUid')&&domain==='ventas'){const key=linkedKey(raw.presupuestoFbKey);if(key){const budget=await source('sisventas/presupuestos/'+key);if(budget){current=budget;currentDomain='presupuestos';}}}
   let people=[];if(!Object.hasOwn(current,'responsableUid')){const [users,identities]=await Promise.all([source('sv_usuarios'),source('sv_chat_roles')]);people=Ownership.profiles(users,identities);}
   if(Ownership.owner(current,currentDomain,people)!==actor.uid)throw fail(403,'SV_COMMERCIAL_OWNER','La ficha no está asignada a tu cuenta.');
  }
  return structuredClone(raw);
 }
 async function fresh(readFresh){for(const [path,value]of values)if(View.digest(await readFresh(path))!==View.digest(value))throw fail(409,'SV_COMMERCIAL_AUTH_CHANGED','La ficha o su autorización cambió. Volvé a revisar la operación.');}
 return {get,fresh,profile,cfg,role,sources:()=>new Map([...values].map(([path,value])=>[path,View.digest(value)]))};
}
module.exports={createRequest,linkedKey};