'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{isDeepStrictEqual}=require('node:util');
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Usar --apply únicamente después de verificar cliente y emulador');
 const baseline=JSON.parse(fs.readFileSync('tmp/security-domain-rules-base.json','utf8'));
 const candidate=JSON.parse(fs.readFileSync('security/database.domain-write.candidate.json','utf8'));
 if(candidate.rules.sisventas['.write']!==false)throw Error('La candidata conserva el permiso raíz');
 const token=execFileSync('powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const read=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'}});if(!read.ok)throw Error('Lectura de reglas HTTP '+read.status);
 const current=await read.json(),etag=read.headers.get('etag');
 if(isDeepStrictEqual(current,candidate)){console.log('Reglas ya aplicadas y verificadas.');return;}
 if(!isDeepStrictEqual(current,baseline))throw Error('Las reglas cambiaron desde el respaldo: volver a preparar y probar');
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync('tmp/backups/reglas-dominios-'+Date.now()+'.json',JSON.stringify(current));
 if(!etag){const check=await fetch(url,{headers});if(!check.ok||!isDeepStrictEqual(await check.json(),current))throw Error('Cambio concurrente de reglas');}
 const write=await fetch(url,{method:'PUT',headers:{...headers,...(etag?{'if-match':etag}:{})},body:JSON.stringify(candidate)});
 if(!write.ok)throw Error('Escritura de reglas HTTP '+write.status);
 const verified=await fetch(url,{headers});if(!verified.ok||!isDeepStrictEqual(await verified.json(),candidate))throw Error('No se pudo verificar el resultado');
 console.log('Primer corte de escrituras comerciales aplicado y verificado. Lecturas y otros dominios siguen pendientes.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
