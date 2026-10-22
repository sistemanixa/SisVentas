'use strict';
// Offline candidate only: add one query index, never fetch rules/data or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASELINE_HASH='cf03c8023e13b0eebb28419c84b6ada82524f79e7f12e40dfa68c23ed0e3b064';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validIndex=value=>typeof value==='string'&&!!value.trim();
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!object(input)||!object(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const domain=input.rules.sisventas;
 if(!object(domain)||!object(domain.hsextra_solicitudes))throw Error('Nodo de solicitudes de horas extra inesperado');
 const old=domain.hsextra_solicitudes['.indexOn'];let indexes;
 if(old===undefined)indexes=[];
 else if(validIndex(old))indexes=[old];
 else if(Array.isArray(old)&&Array.from(old).every(validIndex))indexes=old.slice();
 else throw Error('Índices de solicitudes de horas extra inesperados');
 const output=structuredClone(input);
 if(!indexes.includes('estado')){
  indexes.push('estado');
  output.rules.sisventas.hsextra_solicitudes['.indexOn']=indexes;
 }
 return output;
}
if(require.main===module){
 const args=process.argv.slice(2),[source,target,expectedHash]=args;
 const resolved=value=>{const result=path.resolve(value);return process.platform==='win32'?result.toLowerCase():result;};
 if(args.length!==3||!source||!target||!target.endsWith('.candidate.json')||resolved(source)===resolved(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-hs-extra-pending-index.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});
 // A candidate is a separate artifact. Never overwrite an existing target,
 // including an alias/hardlink/symlink of the reviewed input.
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('Candidata local sólo de índice estado en solicitudes de horas extra. Sin aplicar. SHA256 '+hash(result));
}
module.exports={build,hash,BASELINE_HASH};
