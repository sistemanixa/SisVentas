'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
async function main(){
 const mode=process.argv[2];
 if(!['prepare','final','restore-prepare'].includes(mode))throw Error('Indicar prepare, final o restore-prepare');
 const oldFile=mode==='restore-prepare'?'security/database.control-access.rules.json':mode==='prepare'?'security/database.identity.rules.json':'security/database.control-access.prepare.rules.json';
 const newFile=mode==='final'?'security/database.control-access.rules.json':'security/database.control-access.prepare.rules.json';
 const expected=JSON.parse(fs.readFileSync(oldFile,'utf8')),candidate=JSON.parse(fs.readFileSync(newFile,'utf8'));
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json';
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('No se pudieron leer reglas');
 const actual=await response.json();
 if(!isDeepStrictEqual(actual,expected))throw Error('Reglas inesperadas: no reemplazar');
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync('tmp/backups/control-rules-'+mode+'-'+Date.now()+'.json',JSON.stringify(actual));
 const written=await fetch(url,{method:'PUT',headers,body:JSON.stringify(candidate),signal:AbortSignal.timeout(20000)});
 if(!written.ok)throw Error('No se confirmaron las reglas');
 const verify=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
 if(!verify.ok||!isDeepStrictEqual(await verify.json(),candidate))throw Error('Revisar las reglas publicadas antes de continuar');
 console.log(JSON.stringify({reglasVerificadas:mode,datosModificados:false}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
