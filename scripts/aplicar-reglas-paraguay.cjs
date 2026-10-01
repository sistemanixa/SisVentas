'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
const {reglasParaguay}=require('./generar-reglas-paraguay.cjs');
async function main(){
  const mode=process.argv[2];
  if(!['prepare','apply','verify'].includes(mode))throw Error('Indicar prepare, apply o verify');
  const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
  const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json';
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('No se pudieron leer las reglas vigentes');
  const actual=await response.json();
  const basePath='tmp/backups/paraguay-reglas-base.json';
  const candidatePath='security/database.paraguay.rules.json';
  if(mode==='prepare'){
    if(!actual.rules.sv_usuarios || !actual.rules.sv_chat_roles || actual.rules.sv_listas_paraguay)throw Error('Revisar estructura de reglas antes de generar la candidata');
    fs.mkdirSync('tmp/backups',{recursive:true});
    fs.writeFileSync('tmp/backups/paraguay-reglas-'+Date.now()+'.json',JSON.stringify(actual,null,2));
    fs.writeFileSync(basePath,JSON.stringify(actual,null,2));
    fs.writeFileSync(candidatePath,JSON.stringify(reglasParaguay(actual),null,2)+'\n');
    console.log(JSON.stringify({preparadas:true,baseRepositorioCoincide:isDeepStrictEqual(actual,JSON.parse(fs.readFileSync('security/database.control-access.rules.json','utf8'))),datosModificados:false}));return;
  }
  const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
  if(mode==='apply'){
    if(!isDeepStrictEqual(actual,JSON.parse(fs.readFileSync(basePath,'utf8'))))throw Error('Las reglas cambiaron desde la validación; no reemplazar');
    const written=await fetch(url,{method:'PUT',headers,body:JSON.stringify(candidate),signal:AbortSignal.timeout(20000)});
    if(!written.ok)throw Error('No se confirmaron las reglas: HTTP '+written.status);
  }
  const verify=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
  if(!verify.ok || !isDeepStrictEqual(await verify.json(),candidate))throw Error('La candidata no coincide con las reglas publicadas');
  console.log(JSON.stringify({reglasParaguayVerificadas:true,datosModificados:false}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
