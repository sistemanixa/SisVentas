'use strict';
const closed=value=>value===undefined||value===false||value==='false';
function prepare(input){
 const out=structuredClone(input),root=out.rules,data=root?.sisventas;
 if(!root||!data||!closed(root['.write'])||!closed(data['.write'])||!closed(data.listados_resumen?.['.write']))throw Error('Una autoridad padre puede eludir el veto de eliminación OT.');
 function grants(node){return node&&typeof node==='object'&&Object.entries(node).some(([name,value])=>name==='.write'?!closed(value):!name.startsWith('.')&&grants(value));}
 for(const [name,value]of Object.entries(root))if(name.startsWith('$')&&grants(value))throw Error('Un comodín raíz requiere cierre explícito antes de componer.');
 for(const [node,targets]of [[data,['ordenes_trabajo','listados_resumen']],[data.listados_resumen,['ordenes_trabajo']]])for(const [name,value]of Object.entries(node||{}))if(name.startsWith('$')&&grants(value)){
  if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín inválido.');
  const restriction=targets.map(target=>name+" !== '"+target+"'").join(' && '),suffix=' && ('+restriction+')';
  function close(branch){for(const [field,rule]of Object.entries(branch))if(field==='.write'&&!closed(rule)){if(typeof rule!=='string')throw Error('Autoridad comodín no reconocida.');if(!rule.endsWith(suffix))branch[field]='('+rule+')'+suffix;}else if(!field.startsWith('.')&&rule&&typeof rule==='object')close(rule);}
  close(value);
 }
 const profile="root.child('sv_chat_roles').child(auth.uid)",permission="root.child('sv_permisos').child("+profile+".child('rol').val()).child('acciones/ot/eliminar')";
 const allowed='('+permission+".val() === true || (!"+permission+".exists() && "+profile+".child('rol').val() === 'admin'))",suffix=' && (newData.exists() || '+allowed+')';
 for(const domain of [data.ordenes_trabajo,data.listados_resumen?.ordenes_trabajo]){
  if(!domain||!closed(domain['.write']))throw Error('La concesión padre de OT requiere revisión.');
  const records=Object.keys(domain).filter(name=>name.startsWith('$'));if(records.length!==1)throw Error('No se identificó el registro de OT.');
  const row=domain[records[0]],original=row['.write'];if(typeof original!=='string')throw Error('Falta autoridad original del registro OT.');
  if(!original.endsWith(suffix))row['.write']='('+original+')'+suffix;
 }
 return out;
}
module.exports={prepare};
