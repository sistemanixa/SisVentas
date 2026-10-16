'use strict';
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const internal=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'],roles=[...internal,'compras_paraguay','distribuidora'];
const ownFields=['uid','nombre','login','mail','email','rol','activo','empleadoFbKey','empleadoId','empFbKey','ultimoAcceso','ultimoAccesoEn','ts'];
const directoryFields=['uid','nombre','rol','activo','empleadoFbKey'];
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/^administrador$/,'admin').replace(/^tecnico-vendedor$/,'tecnico_vendedor');
function project(key,value,fields){const out={fbKey:key};for(const k of fields)if(['string','number','boolean'].includes(typeof value[k]))out[k]=value[k];return out;}
function createUserDirectory({auth,db,enabled=false}){
 const get=async p=>(await db.ref(p).get()).val();
 async function authorize(req){
  const token=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!token)throw fail(401,'Sesión requerida');
  let u;try{u=await auth.verifyIdToken(token[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  if(typeof u.uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(u.uid))throw fail(403,'Identidad inválida');
  const identity=await get('sv_chat_roles/'+u.uid);if(identity?.activo!==true||!roles.includes(identity.rol))throw fail(403,'Acceso inactivo o no verificado');
  if(!enabled)throw fail(503,'El directorio protegido todavía no está habilitado');return {uid:u.uid,role:identity.rol};
 }
 async function profile(actor){
  const records=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(actor.uid).get()).val()||{},matches=Object.entries(records).filter(([,u])=>u.uid===actor.uid);
  if(matches.length!==1||matches[0][1].activo===false||normalize(matches[0][1].rol)!==actor.role)throw fail(403,'La ficha y la identidad de acceso no coinciden. Contactá al administrador.');
  const [key,p]=matches[0];return {profile:{...project(key,p,ownFields),rol:actor.role}};
 }
 async function directory(actor,administration=false){
  if(!internal.includes(actor.role))throw fail(403,'Directorio interno');
  if(administration){const cfg=await get('sv_permisos/'+actor.role)||{};if(actor.role!=='admin'||Object.values(cfg.bloqueados||{}).includes('usuarios'))throw fail(403,'Solo administración autorizada');}
  const [data,identities]=await Promise.all([get('sv_usuarios'),get('sv_chat_roles')]);
  const counts={};for(const p of Object.values(data||{}))if(typeof p.uid==='string')counts[p.uid]=(counts[p.uid]||0)+1;
  const users=Object.entries(data||{}).filter(([,p])=>administration||(counts[p.uid]===1&&identities?.[p.uid]&&internal.includes(identities[p.uid].rol)&&identities[p.uid].rol===normalize(p.rol))).map(([key,p])=>{
   const v=project(key,p,administration?ownFields:directoryFields);
   if(!administration){v.activo=p.activo!==false&&identities[p.uid].activo===true;v.rol=identities[p.uid].rol;}return v;
  });return {users};
 }
 return {authorize,profile,directory};
}
module.exports={createUserDirectory,project,ownFields,directoryFields};
