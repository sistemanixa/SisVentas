'use strict';
// Offline metadata-only candidate. It neither contacts Firebase nor deploys.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Published10 source reference used by the older JSON-order hash scripts. The
// mandatory hash accepted here is canonical, independent of property order.
const SOURCE_BASELINE_HASH='29cb92156619a52ab8905c524190f622740e1a1865128978aac21811ca3dc61f';
const BASELINE_HASH='ce74aa228ffe88cc6c2c8aeaf84dff262a90576a89fd863d141a19db396f0f07';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(object(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
}
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const validIndex=value=>typeof value==='string'&&!!value.trim();
function build(input,{expectedHash}={}){
 if(!object(input)||!object(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash||'')||hash(input)!==expectedHash)throw Error('Se requiere la base exacta revisada. No se aplicó ninguna regla.');
 const domain=input.rules.sisventas;
 if(!object(domain)||!object(domain.log_actividad))throw Error('Nodo de actividad inesperado');
 const old=domain.log_actividad['.indexOn'];let indexes;
 if(old===undefined)indexes=[];
 else if(validIndex(old))indexes=[old];
 else if(Array.isArray(old)&&Array.from(old).every(validIndex))indexes=old.slice();
 else throw Error('Índices de actividad inesperados');
 const result=structuredClone(input);
 if(!indexes.includes('fecha')){
  indexes.push('fecha');result.rules.sisventas.log_actividad['.indexOn']=indexes;
 }
 return result;
}
if(require.main===module){
 const args=process.argv.slice(2),[source,target,expectedHash]=args;
 const resolved=value=>{const result=path.resolve(value);return process.platform==='win32'?result.toLowerCase():result;};
 if(args.length!==3||!source||!target||!target.endsWith('.candidate.json')||resolved(source)===resolved(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso offline: node scripts/prepare-activity-date-index.cjs base-local.json salida.candidate.json hash-semantico-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log('Candidata local sólo de índice fecha en Actividad. Sin aplicar. SHA256 semántico '+hash(result));
}
module.exports={build,hash,BASELINE_HASH,SOURCE_BASELINE_HASH};
