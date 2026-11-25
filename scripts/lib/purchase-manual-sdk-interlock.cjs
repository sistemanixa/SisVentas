'use strict';
// Preserve original user authorization. Extend only the exact SDK-idle check
// for the authenticated, fenced manual-delete action. Never deploys itself.
const Policy=require('../../cotizador/labor-fence-policy');
const domains=['ordenes','inventario_operativo'];
function prepare(input){const out=structuredClone(input),root=out.rules,data=root?.sisventas,changed=[];
 for(const node of [root,data])if(!node||![undefined,false,'false'].includes(node['.write']))throw Error('Revisar autoridad padre antes de proteger Compras.');
 if(Object.entries(root).some(([k,v])=>k.startsWith('$')&&JSON.stringify(v).includes('".write"')))throw Error('Autoridad global no revisada.');
 function visit(node,depth,path,condition){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Falta una regla de Compras.');for(const[k,v]of Object.entries(node)){if(k==='.write'&&![false,'false'].includes(v)){
  if(typeof v!=='string')throw Error('Autoridad desconocida.');
  const profile="root.child('sv_chat_roles').child(auth.uid)",perms="root.child('sv_permisos').child("+profile+".child('rol').val())",override=perms+".child('acciones/ordenes/eliminar')";
  const action="auth.token.svFinancialAction === 'ordenes.eliminar' && root.child('sv_labor_config/writerSchema').val() === 2 && "+profile+".child('activo').val() === true && auth.token.svFinancialActorRole === "+profile+".child('rol').val() && auth.token.svFinancialPermissionRevision === "+perms+".child('indiceRevision').val() && "+perms+".child('indiceVersion').val() === 2 && "+perms+".child('indiceModulos/ordenes').val() === true && ("+override+".isBoolean() ? "+override+".val() === true : "+profile+".child('rol').val() === 'admin')";
  const gate='('+Policy.permissionsIdle+') || (('+Policy.fence(depth,Policy.userActor)+') && ('+action+'))';
  const next=v.includes(Policy.permissionsIdle)?v.split(Policy.permissionsIdle).join('('+gate+')'):'(('+gate+') && ('+v+'))';
  node[k]=condition?'('+condition+') ? ('+next+') : ('+v+')':next;changed.push(path+'/.write');
 }else if(!k.startsWith('.'))visit(v,depth+1,path+'/'+k,condition);}}
 for(const d of domains)visit(data[d],2,'sisventas/'+d);
 const summary=data.compras_resumen;if(!summary||![undefined,false,'false'].includes(summary['.write']))throw Error('Revisar autoridad de resúmenes.');
 for(const d of domains)visit(summary[d],3,'sisventas/compras_resumen/'+d);
 for(const[k,v]of Object.entries(summary))if(k.startsWith('$'))visit(v,3,'sisventas/compras_resumen/'+k,domains.map(d=>k+" === '"+d+"'").join(' || '));
 for(const[k,v]of Object.entries(data))if(k.startsWith('$'))visit(v,2,'sisventas/'+k,domains.concat('compras_resumen').map(d=>k+" === '"+d+"'").join(' || '));
 return{rules:out,changed,scope:'original-authorization-with-fenced-manual-delete-action'};
}
module.exports={prepare};
