'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const BASE=Object.freeze({
 'index.js':'c20743a481d1c51fed8e1631aec015ca12f4cf7ed10dc914015d57e3b652c9eb',
 'commercial-ownership.js':'f5df3428c59bf7ee1ecf68f732ceaf31b2c3d46909e040f1f241f61bea956923'
});
function once(source,before,after){if(source.split(before).length!==2)throw Error('Unexpected CC read anchor');return source.replace(before,after);}
function apply(name,source){
 if(!Object.hasOwn(BASE,name)||sha(source)!==BASE[name])throw Error('Server baseline changed; CC patch refused');
 if(name==='index.js'){
  const anchor="const commercialOwnership=require('./commercial-ownership').createCommercialOwnership({auth:businessAuth,db,collectionReader:commercialCollectionReader,";
  return once(source,anchor,anchor+'listReadConcurrency:16,');
 }
 const signature='function createCommercialOwnership({auth,db,enabled=false,now=Date.now,collectionReader,scopedReads=false,queryReader}){';
 const at=source.indexOf(signature)+signature.length,newline=source.slice(at,at+2)==='\r\n'?'\r\n':'\n';
 let result=once(source,signature,signature.replace('queryReader})','queryReader,listReadConcurrency=6})')+newline+" if(!Number.isInteger(listReadConcurrency)||listReadConcurrency<1||listReadConcurrency>16)throw Error('La concurrencia de lectura debe estar entre 1 y 16.');");
 result=once(result,'async function linkedBudgets(records){','async function linkedBudgets(records,concurrency=6){');
 result=once(result,'Math.min(6,ids.length)','Math.min(concurrency,ids.length)');
 return once(result,"const budgets=domain==='ventas'?await linkedBudgets(records):null;","const budgets=domain==='ventas'?await linkedBudgets(records,useCollectionReader?listReadConcurrency:6):null;");
}
if(require.main===module){
 const root=process.argv[2]||'/app';
 // Validate both immutable inputs and prepare both results before any write.
 const prepared=Object.keys(BASE).map(name=>({name,result:apply(name,fs.readFileSync(path.join(root,name),'utf8'))}));
 for(const item of prepared)fs.writeFileSync(path.join(root,item.name),item.result);
 console.log(JSON.stringify({patch:'cc-list-read-concurrency',files:prepared.map(x=>({name:x.name,sha256:sha(x.result)}))}));
}
module.exports={BASE,apply,sha};
