'use strict';
const {isDeepStrictEqual}=require('node:util');
function sourceOf(root){return {usuarios:root?.sisventas?.usuarios||null,permisos:root?.sisventas?.config?.permisos||null,identidades:root?.sv_chat_roles||null,directorio:root?.sv_chat_directorio||null};}
function planMigration(root){
 if(!root||root.sv_usuarios||root.sv_permisos)throw Error('Destino ocupado o datos no disponibles');
 const source=sourceOf(root);
 if(!source.usuarios||!source.permisos||!source.identidades)throw Error('Faltan datos de origen');
 const users=structuredClone(source.usuarios),seen=new Set();
 function normal(role){let r=String(role||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/-/g,'_');return r==='administrador'?'admin':r;}
 for(const [key,user] of Object.entries(users)){
  const uid=user.uid||Object.keys(source.directorio||{}).find(id=>source.directorio[id].usuarioKey===key);
  if(!uid||seen.has(uid))throw Error('Identidad ausente o duplicada: no migrar');
  seen.add(uid);
  const identity=source.identidades[uid];
  if(!identity||normal(user.rol)!==identity.rol||(user.activo!==false)!==(identity.activo===true))throw Error('Identidad inconsistente: no migrar');
  // Única adición: UID verificado para permitir las marcas de acceso propias.
  user.uid=uid;
 }
 return {source:structuredClone(source),users,permissions:structuredClone(source.permisos)};
}
function applyPlan(current,plan){
 if(current===null)return null; // caché inicial de transacción
 if(current.sv_usuarios||current.sv_permisos)throw Error('El destino ya tiene datos');
 if(!isDeepStrictEqual(sourceOf(current),plan.source))throw Error('El origen cambió después de revisar: no migrar');
 const next=structuredClone(current);
 next.sv_usuarios=structuredClone(plan.users);
 next.sv_permisos=structuredClone(plan.permissions);
 delete next.sisventas.usuarios;
 delete next.sisventas.config.permisos;
 return next;
}
function migrationPatch(plan){
 return {sv_usuarios:structuredClone(plan.users),sv_permisos:structuredClone(plan.permissions),'sisventas/usuarios':null,'sisventas/config/permisos':null};
}
module.exports={planMigration,applyPlan,sourceOf,migrationPatch};
