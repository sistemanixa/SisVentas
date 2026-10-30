'use strict';
// A creation CAS needs a null snapshot. This grants no read of existing sales,
// parent collections, payments or private employee records, and no write.
function build(input){
 const rules=JSON.parse(JSON.stringify(input)),node=rules.rules?.sisventas?.ventas?.$venta;
 if(!node||typeof node['.read']!=='string')throw Error('No se encontró la regla de lectura individual de ventas');
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",cfg="root.child('sv_permisos').child("+role+")";
 const defaults="("+['admin','administrativo','vendedor','tecnico_vendedor'].map(r=>role+" === '"+r+"'").join(' || ')+")";
 const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].map(r=>role+" === '"+r+"'").join(' || ')+")";
 const module="(("+cfg+".exists() && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos').child('venta').val() === true) || (!"+cfg+".exists() && "+defaults+"))";
 const action="("+cfg+".child('acciones').child('ventas').child('crear').val() === true || (!"+cfg+".child('acciones').child('ventas').child('crear').exists() && "+defaults+"))";
 const session="auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
 const absence="(!data.exists() && "+active+" && "+module+" && "+action+" && "+session+")";
 if(node['.read'].endsWith(' || '+absence+')'))return rules;
 node['.read']='('+node['.read']+' || '+absence+')';return rules;
}
module.exports={build};
