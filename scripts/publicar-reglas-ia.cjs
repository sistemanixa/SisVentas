'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
const rule={'.read':active,'.write':active+" && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'",'$id':{'.validate':"newData.hasChildren(['categoria','codigo','cantidad','activa','actualizadaEn','autor']) && newData.child('categoria').isString() && newData.child('codigo').isString() && newData.child('cantidad').isNumber() && newData.child('cantidad').val() > 0 && newData.child('activa').isBoolean()"}};
module.exports=rule;
async function main(){
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const res=await fetch(url,{headers});if(!res.ok)throw Error('No se pudieron leer reglas');const before=await res.json();
 if(before.rules.sv_ia_reglas&&!isDeepStrictEqual(before.rules.sv_ia_reglas,rule))throw Error('La ruta ya tiene reglas distintas; revisar antes de modificar.');
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync('tmp/backups/reglas-antes-ia-'+Date.now()+'.json',JSON.stringify(before,null,2));
 const after=structuredClone(before);after.rules.sv_ia_reglas=rule;
 const response=await fetch(url,{method:'PUT',headers,body:JSON.stringify(after)});if(!response.ok)throw Error('No se publicaron reglas: '+await response.text());
 const check=await fetch(url,{headers});if(!check.ok||!isDeepStrictEqual(await check.json(),after))throw Error('No se verificó la publicación de reglas');
 console.log('Ruta de reglas IA protegida; resto de reglas conservado.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
