// Primera fase: conservar operaciones existentes y rechazar identidades no activas.
// No sustituye la autorización por acción de las fases siguientes.
'use strict';
const fs=require('node:fs');
function restringirIdentidad(original){
  const result=structuredClone(original);
  if(!result.rules?.sisventas)throw Error('Falta la rama sisventas');
  for(const action of ['.read','.write']){
    const previous=result.rules.sisventas[action];
    if(previous!=='auth != null')throw Error('Las reglas de origen cambiaron; revisar antes de generar');
    result.rules.sisventas[action]="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
  }
  return result;
}
if(require.main===module){
  const [source,target]=process.argv.slice(2);
  if(!source||!target)throw Error('Indicar reglas de origen y archivo de salida');
  fs.writeFileSync(target,JSON.stringify(restringirIdentidad(JSON.parse(fs.readFileSync(source,'utf8'))),null,2)+'\n');
}
module.exports={restringirIdentidad};
