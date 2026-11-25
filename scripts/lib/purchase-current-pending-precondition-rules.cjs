'use strict';
// Narrow every existing grant, including parents: RTDB child vetoes cannot
// revoke an inherited grant. The reserved Kind comes only from sealed policy.
const crypto=require('node:crypto');
const kind='current-pending-reconcile';
const conditions=[
 "auth.token.svPurchaseSourceCostVersion === 0",
 "auth.token.svLaborService === true", "auth.token.mode === 'commit'",
 "auth.token.svFinancialAction === 'ordenes.editar'",
 "auth.uid === auth.token.actorUid",
 "root.child('sv_labor_guard/mode').val() === 'user'",
 "root.child('sv_labor_guard/actorUid').val() === auth.uid",
 ...['fence','opId','digest'].map(k=>"root.child('sv_labor_guard/"+k+"').isString() && root.child('sv_labor_guard/"+k+"').val() === auth.token."+k),
 "root.child('sv_labor_guard/expiresAt').isNumber() && root.child('sv_labor_guard/expiresAt').val() > now",
 "root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true",
 "root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'",
 "auth.token.svFinancialActorRole === 'admin'",
 "root.child('sv_permisos/admin/indiceVersion').val() === 2",
 "root.child('sv_permisos/admin/indiceRevision').val() === auth.token.svFinancialPermissionRevision",
 ...['ordenes','configuracion'].map(k=>"root.child('sv_permisos/admin/indiceModulos/"+k+"').val() === true"),
 "root.child('sv_permisos/admin/acciones/ordenes/editar').val() !== false",
 "root.child('sv_permisos/admin/acciones/mantenimiento/migrar').val() !== false",
 "auth.token.svPasswordChangeRequired !== true",
 "root.child('sv_access_resets').child(auth.uid).child('required').val() !== true",
 "(!root.child('sv_access_resets').child(auth.uid).child('version').exists() || root.child('sv_access_resets').child(auth.uid).child('version').val() === auth.token.svAccessVersion)",
 "root.child('sisventas/ordenes').child(auth.token.svPurchaseSourceCostOrderKey).exists()"
];
const predicate="(auth == null || auth.token.svPurchaseSourceCostKind !== '"+kind+"' || ("+conditions.map(v=>'('+v+')').join(' && ')+'))';
function prepare(input){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules))throw Error('Faltan reglas completas.');
 const rules=structuredClone(input),changed=[];
 function visit(node,path){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo no revisable.');
  const old=node['.write'];
  if(![undefined,false,'false'].includes(old)){
   if(old!==true&&typeof old!=='string')throw Error('Grant no revisable.');
   node['.write']='('+predicate+') && ('+String(old)+')';changed.push([...path,'.write'].join('/'));
  }
  for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))visit(v,[...path,k]);
 }
 visit(rules.rules,[]);
 return{rules,manifest:{schema:1,changed,grantsAdded:false,activated:false,kind,adminSdkBypassNotCovered:true,candidateDigest:crypto.createHash('sha256').update(JSON.stringify(rules)).digest('hex')}};
}
module.exports={prepare,predicate,conditions,kind};
