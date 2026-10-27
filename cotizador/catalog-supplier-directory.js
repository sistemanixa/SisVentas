'use strict';
const {isDeepStrictEqual}=require('node:util');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const fields=['nombre','web','pais','monedaPrecios','activo','base','favorito','preciosSinIva','descuentoPorcentaje'];
const key=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function publicValue(name,value){
 if(name==='nombre')return String(value).trim().toLocaleUpperCase('es-AR');
 if(name!=='web'||typeof value!=='string'||!value.trim())return value;
 try{const text=value.trim(),url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(text)?text:'https://'+text);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?text:'';}catch(_){return '';}
}
function project(input){
 return Object.fromEntries(Object.entries(input||{}).filter(([id,p])=>key(id)&&id!=='referencia-de-valor'&&p&&typeof p==='object'&&!Array.isArray(p)).map(([id,p])=>[id,Object.fromEntries(fields.filter(name=>Object.hasOwn(p,name)&&(['string','boolean'].includes(typeof p[name])||typeof p[name]==='number'&&Number.isFinite(p[name]))).map(name=>[name,publicValue(name,p[name])]))]));
}
function createCatalogSupplierDirectory({auth,db}){
 const read=async path=>(await db.ref(path).get()).val();
 async function identity(actor,use){
  const [role,reset,permissions]=await Promise.all([read('sv_chat_roles/'+actor.uid),read('sv_access_resets/'+actor.uid),read('sv_distribuidora_permisos')]);
  if(role?.activo!==true||role.rol!=='distribuidora'||permissions?.[use]!==true)throw fail(403,'Tu cuenta no tiene permiso para editar este catálogo.');
  if(actor.svPasswordChangeRequired===true||reset!==null&&(!reset||typeof reset!=='object'||reset.required===true||reset.version!==actor.svAccessVersion))throw fail(403,'Actualizá tu acceso y volvé a ingresar.');
  return {role,reset,permission:permissions[use]};
 }
 async function list(req){
  let url;try{url=new URL(req.url,'http://localhost');}catch(_){throw fail(400,'Solicitud inválida');}
  const use=url.searchParams.get('uso');
  if(req.method!=='GET'||url.pathname!=='/catalogo/proveedores'||url.hash||!['crear','editar'].includes(use)||[...url.searchParams].length!==1)throw fail(400,'Solicitud inválida');
  const bearer=String(req.headers?.authorization||'').match(/^Bearer (\S+)$/i);if(!bearer)throw fail(401,'Volvé a ingresar.');
  let actor;try{actor=await auth.verifyIdToken(bearer[1],true);}catch(_){throw fail(401,'Volvé a ingresar.');}
  if(!key(actor?.uid))throw fail(401,'Sesión inválida');
  const before=await identity(actor,use),source=await read('sisventas/proveedores'),after=await identity(actor,use);
  if(!isDeepStrictEqual(before,after))throw fail(409,'Tu acceso cambió. Volvé a abrir el producto.');
  return {proveedores:project(source)};
 }
 return Object.freeze({list});
}
module.exports={createCatalogSupplierDirectory,project};
