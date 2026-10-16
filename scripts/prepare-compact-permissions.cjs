'use strict';
// Generación offline: conserva la política revisada y cambia únicamente el
// formato de consulta de módulos, verificable contra bloqueados/permitidos.
const fs=require('fs'),{buildStages}=require('./prepare-access-permission-stages.cjs'),{build:privateUsers}=require('./prepare-user-directory-rules.cjs'),index=require('../js/core/permission-index');
const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",cfg="root.child('sv_permisos').child("+role+")";
function build(stage='audit-final'){
 const input=buildStages().stages[stage];if(!input)throw Error('Etapa no revisada');const out=require('./prepare-chat-security.cjs').build(privateUsers(input));let replaced=0;
 function walk(node){for(const [k,value]of Object.entries(node)){
  if(typeof value==='string'){
   let s=value;for(const name of index.modules){const before=Array.from({length:64},(_,i)=>cfg+".child('bloqueados').child('"+i+"').val() !== '"+name+"'").join(' && ');if(s.includes(before)){replaced+=s.split(before).length-1;s=s.replaceAll(before,"("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos').child('"+name+"').val() === true)");}}
   if(['.read','.write'].includes(k)&&s.includes(".child('bloqueados').child("))throw Error('Quedó una consulta sin compactar');node[k]=s;
  }else if(value&&typeof value==='object')walk(value);
 }}walk(out.rules);
 const internal="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && ("+['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].map(r=>role+" === '"+r+"'").join(' || ')+')';
 const {GUARD}=require('../cotizador/password-policy');
 for(const [name,policy]of Object.entries(index.additionalDomains)){
  const defaults=require('../js/core/domain-read-policy').restrictedDefaults;
  const allowed=policy.modules.map(m=>"((!"+cfg+".exists() && ("+(defaults[m]||['admin','administrativo','vendedor','tecnico_vendedor','tecnico']).map(r=>role+" === '"+r+"'").join(' || ')+")) || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos').child('"+m+"').val() === true))").join(' || ');
  const gate='('+internal+') && ('+allowed+') && '+GUARD;
  const parts=name.split('/');let parent=out.rules.sisventas;while(parts.length>1){const part=parts.shift();parent=parent[part]||(parent[part]={});}const leaf=parts[0];
  // Configuración mantiene su escritura administrativa previa; esta extensión
  // limita lecturas de porcentajes/salarios sin delegar su edición a vendedores.
  parent[leaf]={...(parent[leaf]||{}),'.read':gate,...(!name.includes('/')?{'.write':gate}:{})};
 }
 out.rules.sisventas._integraciones_server={'.read':false,'.write':false};
 out.rules.sisventas.config.loginRapido={'.read':false};
 const p=out.rules.sv_permisos;p.$rol=p.$rol||{};
 p.$rol['.validate']="($rol === '_version' && newData.isNumber()) || (newData.child('indiceVersion').val() === 2 && newData.child('indiceRevision').isNumber() && ((!data.child('indiceVersion').exists() && newData.child('indiceRevision').val() === 1) || (data.child('indiceVersion').val() === 2 && newData.child('indiceRevision').val() === data.child('indiceRevision').val() + 1)) && newData.child('indiceModulos').hasChildren("+JSON.stringify(index.modules)+'))';
 const blocked=Array.from({length:64},(_,i)=>"newData.parent().parent().child('bloqueados').child('"+i+"').val() !== $modulo").join(' && ');
 const permitted=Array.from({length:64},(_,i)=>"newData.parent().parent().child('permitidos').child('"+i+"').val() === $modulo").join(' || ');
 p.$rol.indiceModulos={'$modulo':{'.validate':"newData.isBoolean() && newData.val() === (("+blocked+") && ($modulo.matches(/^("+index.base.join('|')+")$/) || ("+permitted+')))'}};
 return {rules:out,replaced,bytes:Buffer.byteLength(JSON.stringify(out))};
}
if(require.main===module){const [dest,stage]=process.argv.slice(2);if(!dest||!dest.endsWith('.candidate.json'))throw Error('Uso offline: salida.candidate.json [etapa]');const x=build(stage);fs.writeFileSync(dest,JSON.stringify(x.rules)+'\n');console.log(JSON.stringify({applied:false,replaced:x.replaced,bytes:x.bytes}));}
module.exports={build};
