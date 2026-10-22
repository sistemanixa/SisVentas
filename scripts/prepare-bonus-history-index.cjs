'use strict';
// Offline candidate only: add a query index; never fetch data/rules or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BASELINE_HASH='dc05032cdfbcc5976a871d414f60b2920e709d248496474aff7c0d9b087df39a';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const gastos=input.rules.sisventas?.gastos;if(!gastos||typeof gastos!=='object'||Array.isArray(gastos))throw Error('Nodo de Gastos inesperado');
 const old=gastos['.indexOn'];let indexes;
 if(old===undefined)indexes=[];
 else if(typeof old==='string'&&old.trim())indexes=[old];
 else if(Array.isArray(old)&&old.every(value=>typeof value==='string'&&!!value.trim()))indexes=old.slice();
 else throw Error('Índices de Gastos inesperados');
 const output=structuredClone(input);
 if(!indexes.includes('tipoPagable')){indexes.push('tipoPagable');output.rules.sisventas.gastos['.indexOn']=indexes;}
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-bonus-history-index.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local sólo de índice tipoPagable en Gastos. Sin aplicar. SHA256 '+hash(result));
}
module.exports={build,hash,BASELINE_HASH};
