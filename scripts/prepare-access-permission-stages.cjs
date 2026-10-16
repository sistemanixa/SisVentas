'use strict';
// Composición offline. No incluye SDK, red, credenciales ni despliegue.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {build:protect}=require('./prepare-password-access.cjs');
const {rulesProtectPasswords}=require('../cotizador/password-policy.js');
const root=path.resolve(__dirname,'..');
const stages=['known-role-read','domain-read','employee-account-read','audit-final'];
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'security/database.'+name+'.candidate.json'),'utf8'));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function buildStages(current=read('password-access')){
 // Una composición antigua no debe sobreescribir cambios remotos adicionales.
 // El operador debe comparar esta base con la lectura remota antes de un corte.
 const expected=protect(read('domain-write'));
 assert.deepEqual(current,expected,'La base protegida cambió: revisar las diferencias antes de regenerar etapas');
 assert.ok(rulesProtectPasswords(current),'La base debe conservar el bloqueo de acceso temporal');
 const result={};
 for(const stage of stages){
  const candidate=protect(read(stage));
  assert.ok(rulesProtectPasswords(candidate),'Protección incompleta en '+stage);
  result[stage]=candidate;
 }
 return {baseHash:hash(current),stages:result};
}
function main(){
 const [source,output]=process.argv.slice(2);
 if(!source||!output)throw Error('Uso offline: node scripts/prepare-access-permission-stages.cjs base-protegida.json directorio-de-salida');
 const result=buildStages(JSON.parse(fs.readFileSync(source,'utf8')));
 fs.mkdirSync(output,{recursive:true});const manifest={baseHash:result.baseHash,applied:false,stages:{}};
 for(const [stage,candidate]of Object.entries(result.stages)){
  const file='database.'+stage+'-access.candidate.json',text=JSON.stringify(candidate,null,2)+'\n';
  fs.writeFileSync(path.join(output,file),text);
  manifest.stages[stage]={file,sha256:hash(candidate),bytes:Buffer.byteLength(text),intermediateOnly:stage==='domain-read'};
 }
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(manifest));
}
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={buildStages,stages,hash};
