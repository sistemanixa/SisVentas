'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
async function main(){
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 async function read(route,auth){
  const query=auth===undefined?'':'?auth_variable_override='+encodeURIComponent(JSON.stringify(auth));
  const r=await fetch(base+route+'.json'+query,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  return {status:r.status,value:r.ok?await r.json():null};
 }
 const rules=await read('.settings/rules');
 if(!isDeepStrictEqual(rules.value,JSON.parse(fs.readFileSync('security/database.control-access.rules.json','utf8'))))throw Error('Reglas diferentes a las probadas');
 const roles=await read('sv_chat_roles'),users=await read('sv_usuarios'),permissions=await read('sv_permisos');
 if(!users.value||!permissions.value)throw Error('Faltan datos protegidos');
 let checks=0;
 for(const [uid,identity] of Object.entries(roles.value)){
  for(const route of ['sv_usuarios','sv_permisos','sisventas/config/version']){
   const response=await read(route,{uid});
   if((response.status===200)!==(identity.activo===true))throw Error('Acceso inesperado');
   checks++;
  }
 }
 for(const auth of [null,{uid:'verification-unregistered-identity'}])for(const route of ['sv_usuarios','sv_permisos']){
  const response=await read(route,auth);
  if(![401,403].includes(response.status))throw Error('No se rechazó la sesión ajena');
  checks++;
 }
 for(const route of ['sisventas/usuarios','sisventas/config/permisos'])if((await read(route)).value!==null)throw Error('Quedó una copia antigua');
 console.log(JSON.stringify({usuarios:Object.keys(users.value).length,accesosVerificados:checks,reglasExactas:true,rutasAntiguasVacias:true,soloLectura:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
