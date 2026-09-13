'use strict';
// Sin --apply solo analiza. Nunca envía la raíz completa de la base.
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const {planMigration,migrationPatch,sourceOf}=require('./control-access-migration.cjs');
async function main(){
 if(process.argv.includes('--apply')&&!process.argv.includes('--clientes-coordinados'))throw Error('Falta confirmar clientes coordinados');
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const base='https://nixa-sisventas-default-rtdb.firebaseio.com/';
 async function request(route,method='GET',value){
  const response=await fetch(base+route+'.json',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Firebase no confirmó la operación: '+response.status);
  return response.json();
 }
 async function control(){
  const [users,permissions,identities,directory,newUsers,newPermissions]=await Promise.all(['sisventas/usuarios','sisventas/config/permisos','sv_chat_roles','sv_chat_directorio','sv_usuarios','sv_permisos'].map(p=>request(p)));
  return {sisventas:{usuarios:users,config:{permisos:permissions}},sv_chat_roles:identities,sv_chat_directorio:directory,sv_usuarios:newUsers,sv_permisos:newPermissions};
 }
 const original=await control(),plan=planMigration(original),patch=migrationPatch(plan);
 const bytes=Buffer.byteLength(JSON.stringify(patch));
 if(bytes>8*1024*1024)throw Error('Payload de control demasiado grande: no migrar');
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({soloLectura:true,usuarios:Object.keys(plan.users).length,bytesTraslado:bytes,destinosDisponibles:true,identidadesVerificadas:true}));return;}
 const prepared=JSON.parse(fs.readFileSync('security/database.control-access.prepare.rules.json','utf8'));
 const final=JSON.parse(fs.readFileSync('security/database.control-access.rules.json','utf8'));
 if(!isDeepStrictEqual(await request('.settings/rules'),prepared))throw Error('Reglas distintas a la preparación verificada');
 const backup='tmp/backups/control-acceso-'+Date.now()+'.json';
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync(backup,JSON.stringify({source:plan.source,rules:prepared}));
 // Se congelan las escrituras legacy antes de releer para evitar perder ediciones.
 await request('.settings/rules','PUT',final);
 let patchAttempted=false;
 try{
  if(!isDeepStrictEqual(await request('.settings/rules'),final))throw Error('No se verificaron reglas finales');
  const frozen=await control();
  if(frozen.sv_usuarios||frozen.sv_permisos||!isDeepStrictEqual(sourceOf(frozen),plan.source))throw Error('Los datos cambiaron: repetir revisión');
  patchAttempted=true;
  await request('','PATCH',patch);
  const saved=await control();
  if(!isDeepStrictEqual(saved.sv_usuarios,plan.users)||!isDeepStrictEqual(saved.sv_permisos,plan.permissions)||saved.sisventas.usuarios||saved.sisventas.config.permisos)throw Error('La verificación posterior no coincide');
  console.log(JSON.stringify({migrado:true,usuarios:Object.keys(plan.users).length,bytesTraslado:bytes,permisosConservados:true,copiaLegacyRetirada:true,respaldo:backup}));
 }catch(error){
  // Una respuesta incierta posterior al PATCH exige inspección, no reintento.
  if(!patchAttempted&&isDeepStrictEqual(await request('.settings/rules'),final))await request('.settings/rules','PUT',prepared);
  throw error;
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
