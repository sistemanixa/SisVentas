'use strict';
// Lectura únicamente. No imprime nombres, correos ni identificadores.
const {execFileSync}=require('node:child_process');
async function main(){
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 async function read(path){const r=await fetch(base+path+'.json',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('No se pudo verificar la base');return await r.json()||{};}
 const [users,roles,directory]=await Promise.all(['sisventas/usuarios','sv_chat_roles','sv_chat_directorio'].map(read));
 const result={usuarios:0,activos:0,activosSinIdentidad:0,estadoInconsistente:0,rolInconsistente:0,administradoresActivos:0};
 function normal(value){const r=String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/-/g,'_');return r==='administrador'?'admin':r;}
 for(const [key,user] of Object.entries(users)){
  result.usuarios++;if(user.activo!==false)result.activos++;
  const uid=user.uid||Object.keys(directory).find(id=>directory[id].usuarioKey===key);
  const identity=roles[uid];
  if(!identity){if(user.activo!==false)result.activosSinIdentidad++;continue;}
  if((user.activo!==false)!==(identity.activo===true))result.estadoInconsistente++;
  if(normal(user.rol)!==identity.rol)result.rolInconsistente++;
  if(identity.rol==='admin'&&identity.activo===true)result.administradoresActivos++;
 }
 result.aptoParaRestringir=result.activosSinIdentidad===0&&result.estadoInconsistente===0&&result.rolInconsistente===0&&result.administradoresActivos>0;
 console.log(JSON.stringify(result));
 if(!result.aptoParaRestringir)process.exitCode=2;
}
main().catch(()=>{console.error('La verificación no terminó; no aplicar reglas.');process.exitCode=1;});
