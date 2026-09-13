'use strict';
const fs=require('node:fs');
function reglasControlAcceso(original,{cerrarLegacy=false}={}){
  const result=structuredClone(original);
  const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
  const admin=active+" && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'";
  if(result.rules?.sisventas?.['.write']!==active)throw Error('Primero debe estar aplicada la restricción de identidades');
  if(result.rules.sv_usuarios||result.rules.sv_permisos)throw Error('Ya existen rutas de control; revisar antes de reemplazar');
  const timestamp={
    '.write':active+" && data.parent().child('uid').val() === auth.uid",
    '.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() <= now + 300000'
  };
  result.rules.sv_usuarios={'.read':active,'.write':admin,'$usuario':{ultimoAcceso:timestamp,ultimoAccesoEn:structuredClone(timestamp)}};
  result.rules.sv_permisos={'.read':active,'.write':admin};
  if(cerrarLegacy){
    result.rules.sisventas.usuarios={'.validate':false};
    result.rules.sisventas.config=result.rules.sisventas.config||{};
    result.rules.sisventas.config.permisos={'.validate':false};
  }
  return result;
}
if(require.main===module){
 const [source,target]=process.argv.slice(2);
 if(!source||!target)throw Error('Indicar origen y destino');
 fs.writeFileSync(target,JSON.stringify(reglasControlAcceso(JSON.parse(fs.readFileSync(source,'utf8')),{cerrarLegacy:process.argv.includes('--cerrar-legacy')}),null,2)+'\n');
}
module.exports={reglasControlAcceso};
