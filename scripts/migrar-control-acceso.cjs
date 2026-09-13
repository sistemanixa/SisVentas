'use strict';
// Sin --apply solo analiza. La activación exige publicación coordinada del cliente
// con SV_SECURITY_STORAGE_V2 y del servicio fiscal con la misma variable.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const admin=require('../cotizador/node_modules/firebase-admin');
const {planMigration,applyPlan}=require('./control-access-migration.cjs');
async function main(){
 if(process.argv.includes('--apply')&&!process.argv.includes('--clientes-coordinados'))throw Error('Falta confirmar la publicación coordinada de clientes y servicio');
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const base='https://nixa-sisventas-default-rtdb.firebaseio.com';
 const app=admin.initializeApp({databaseURL:base,credential:{getAccessToken:async()=>({access_token:token,expires_in:3600})}},'security-migration');
 try{
  const db=app.database(),root=await db.ref().once('value');
  const plan=planMigration(root.val());
  if(!process.argv.includes('--apply')){
   console.log(JSON.stringify({soloLectura:true,usuarios:Object.keys(plan.users).length,permisosConservados:true,identidadesVerificadas:true,destinosDisponibles:true}));return;
  }
  const expectedRules=JSON.parse(fs.readFileSync('security/database.control-access.rules.json','utf8'));
  const response=await fetch(base+'/.settings/rules.json',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  if(!response.ok||!isDeepStrictEqual(await response.json(),expectedRules))throw Error('Las reglas V2 probadas deben estar publicadas antes de migrar');
  const backup=path.join('tmp','backups','control-acceso-'+Date.now()+'.json');
  fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,JSON.stringify(plan.source));
  let failure='';
  const result=await db.ref().transaction(current=>{try{return applyPlan(current,plan);}catch(e){failure=e.message;return;}},undefined,false);
  if(!result.committed)throw Error(failure||'Migración no confirmada');
  const saved=result.snapshot.val();
  if(!isDeepStrictEqual(saved.sv_usuarios,plan.users)||!isDeepStrictEqual(saved.sv_permisos,plan.permissions)||saved.sisventas.usuarios||saved.sisventas.config.permisos)throw Error('Revisar resultado: verificación incompleta');
  console.log(JSON.stringify({migrado:true,usuarios:Object.keys(plan.users).length,permisosConservados:true,copiaLegacyRetirada:true,respaldo:backup}));
 }finally{await app.delete();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
