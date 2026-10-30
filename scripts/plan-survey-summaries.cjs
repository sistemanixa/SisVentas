'use strict';
// Sólo inventario offline; no lee ni escribe Firebase ni modifica los originales.
const fs=require('node:fs'),crypto=require('node:crypto'),Model=require('../js/core/survey-summaries.v1');
function canonical(v){return v&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'):JSON.stringify(v);}
function plan(rows){const sourceHash=crypto.createHash('sha256').update(canonical(rows)).digest('hex'),index=Model.buildIndex(rows,sourceHash);return {index,report:{sourceHash,records:Object.keys(rows).length,sourceBytes:Buffer.byteLength(JSON.stringify(rows)),indexBytes:Buffer.byteLength(JSON.stringify(index)),writes:0}};}
if(require.main===module){if(process.argv.length!==3||process.argv[2].startsWith('--'))throw Error('Indicar un archivo privado de relevamientos para inventario offline; no hay modo apply.');console.log(JSON.stringify(plan(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))).report,null,2));}
module.exports={plan};
