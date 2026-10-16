'use strict';
// Generador offline de la candidata intermedia; no aplica reglas.
const fs=require('node:fs'),{internalRoles}=require('../js/core/domain-read-policy');
function build(base){
  if(base.rules?.sv_access_resets||base.rules?.sv_access_control)throw Error('Base con protección de acceso: usar prepare-access-permission-stages.cjs para conservar el guard');
  const result=structuredClone(base),role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
  result.rules.sisventas['.read']="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+internalRoles.map(r=>role+" === '"+r+"'").join(' || ')+')';
  return result;
}
if(require.main===module){
  const base=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8'));
  fs.writeFileSync('security/database.known-role-read.candidate.json',JSON.stringify(build(base),null,2)+'\n');
  console.log('Candidata intermedia preparada; no aplicada.');
}
module.exports={build};
