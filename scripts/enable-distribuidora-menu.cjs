'use strict';
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
async function main(){
 const apply=process.argv.includes('--apply');
 const token=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',"& 'C:\\Users\\gon_s\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd' auth print-access-token"],{encoding:'utf8',windowsHide:true}).trim();
 const url='https://nixa-sisventas-default-rtdb.firebaseio.com/.settings/rules.json',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const read=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'}});if(!read.ok)throw Error('Lectura de reglas HTTP '+read.status);
 const rules=await read.json(),base=JSON.stringify(rules),etag=read.headers.get('etag');
 const candidate=require('./catalog-request-rules.cjs').catalogRequestRules();
 const r=rules.rules;
 if(!r.sv_catalogo_solicitudes||!r.sv_catalogo_solicitudes_estado?.$id||!r.sv_distribuidora_permisos)throw Error('Estructura inesperada');
 require('./distribuidora-menu-rules.cjs').apply(rules);
 if(!apply){console.log('Validación preparada: un campo numérico, sin cambios de permisos.');return;}
 // El endpoint de reglas puede omitir ETag. Releer antes de escribir y
 // abortar si otro proceso modificó la base que acabamos de respaldar.
 if(!etag){
   const fresh=await fetch(url,{headers});
   if(!fresh.ok||JSON.stringify(await fresh.json())!==base)throw Error('Las reglas cambiaron: no se reemplazan');
 }
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync('tmp/backups/reglas-edicion-solicitudes-'+Date.now()+'.json',base);
 const write=await fetch(url,{method:'PUT',headers:{...headers,...(etag?{'If-Match':etag}:{})},body:JSON.stringify(rules)});if(!write.ok)throw Error('Escritura de reglas HTTP '+write.status);
 const verified=await fetch(url,{headers});if(!verified.ok||JSON.stringify(await verified.json())!==JSON.stringify(rules))throw Error('No se pudo verificar la actualización');
 console.log('Acceso configurable al portal habilitado; otras reglas conservadas.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
