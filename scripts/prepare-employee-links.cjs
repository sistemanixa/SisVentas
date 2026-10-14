'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
function buildLinks(identities,profiles,employees){
 const links={},seen=new Set();
 for(const [uid,identity] of Object.entries(identities||{})){
  if(identity.activo!==true || !['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(identity.rol))continue;
  const matches=Object.entries(profiles||{}).filter(([key,u])=>[key,u.uid,u.authUid,u.firebaseUid].some(k=>k&&String(k)===uid));
  if(matches.length!==1)throw Error('Identidad interna sin perfil único; requiere revisión');
  const [profileKey,profile]=matches[0],employeeKey=profile.empleadoFbKey;
  if(!employeeKey && identity.rol==='admin')continue;
  if(profile.activo===false || !employeeKey || !employees[employeeKey])throw Error('Perfil sin vínculo laboral válido; requiere revisión');
  if(seen.has(employeeKey))throw Error('Empleado vinculado a más de un UID; requiere revisión');
  seen.add(employeeKey);links[uid]={empleadoFbKey:employeeKey,perfilFbKey:profileKey};
 }
 return links;
}
async function main(){
 const token=execFileSync('powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const read=async p=>{const r=await fetch('https://nixa-sisventas-default-rtdb.firebaseio.com/'+p+'.json',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Lectura HTTP '+r.status);return await r.json()||{};};
 const [roles,profiles,employees]=await Promise.all(['sv_chat_roles','sv_usuarios','sisventas/empleados'].map(read));
 const links=buildLinks(roles,profiles,employees);
 fs.writeFileSync('tmp/employee-links-plan.json',JSON.stringify({preparedAt:new Date().toISOString(),links},null,2));
 console.log(Object.keys(links).length+' vínculos laborales validados y preparados. Sin escrituras en producción.');
}
module.exports={buildLinks};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
