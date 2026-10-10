'use strict';
const grant="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && root.child('sv_permisos').child(root.child('sv_chat_roles').child(auth.uid).child('rol').val()).child('distribuidora').val() === true";
function apply(rules){
 const r=rules.rules,own='('+grant+') && auth.uid === $uid';
 const add=(node,key,condition)=>{if(!node||typeof node[key]!=='string')throw Error('Regla no encontrada: '+key);if(!node[key].includes(condition))node[key]='('+node[key]+') || ('+condition+')';};
 add(r.sv_listas_paraguay.$uid,'.read',own);add(r.sv_listas_paraguay.$uid.$lista,'.write',own);
 for(const name of ['sv_catalogo_solicitudes','sv_catalogo_solicitudes_estado','sv_catalogo_solicitudes_edicion','sv_catalogo_solicitudes_atencion'])add(r[name],'.read',grant);
 add(r.sv_catalogo_solicitudes_estado.$id,'.write',grant);
 // Preserve the creation-only and request/index conditions on these writes.
 for(const [name,node] of [['sv_catalogo_solicitudes_edicion',r.sv_catalogo_solicitudes_edicion.$id.$index],['sv_catalogo_solicitudes_atencion',r.sv_catalogo_solicitudes_atencion.$id]]){
  if(!node['.write'].includes(grant))node['.write']=node['.write'].replace('auth != null', '('+grant+') || auth != null');
 }
 return rules;
}
module.exports={apply,grant};
