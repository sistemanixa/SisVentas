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
 r.sv_catalogo_solicitudes['.read']=candidate.sv_catalogo_solicitudes['.read'];
 r.sv_catalogo_solicitudes_estado['.read']=candidate.sv_catalogo_solicitudes_estado['.read'];
 r.sv_catalogo_solicitudes_estado.$id['.write']=candidate.sv_catalogo_solicitudes_estado.$id['.write'];
 r.sv_distribuidora_permisos.solicitudes={'.validate':'newData.isBoolean()'};
 if(!apply){console.log('Validación preparada: un campo numérico, sin cambios de permisos.');return;}
 // El endpoint de reglas puede omitir ETag. Releer antes de escribir y
 // abortar si otro proceso modificó la base que acabamos de respaldar.
 if(!etag){
   const fresh=await fetch(url,{headers});
   if(!fresh.ok||JSON.stringify(await fresh.json())!==base)throw Error('Las reglas cambiaron: no se reemplazan');
 }
 fs.mkdirSync('tmp/backups',{recursive:true});fs.writeFileSync('tmp/backups/reglas-solicitudes-distribuidora-'+Date.now()+'.json',base);
 const write=await fetch(url,{method:'PUT',headers:{...headers,...(etag?{'If-Match':etag}:{})},body:JSON.stringify(rules)});if(!write.ok)throw Error('Escritura de reglas HTTP '+write.status);
 const verified=await fetch(url,{headers});if(!verified.ok||JSON.stringify(await verified.json())!==JSON.stringify(rules))throw Error('No se pudo verificar la actualización');
 const permissionURL='https://nixa-sisventas-default-rtdb.firebaseio.com/sv_distribuidora_permisos/solicitudes.json';
 const enabled=await fetch(permissionURL,{method:'PUT',headers,body:'true'});if(!enabled.ok)throw Error('No se habilitó el permiso: HTTP '+enabled.status);
 const checked=await fetch(permissionURL,{headers});if(!checked.ok||await checked.json()!==true)throw Error('No se verificó el permiso');
 console.log('Permiso solicitudes habilitado. Lectura y atención para Distribuidora verificadas; otras reglas conservadas.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
