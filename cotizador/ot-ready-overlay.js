'use strict';
// Pure overlay for reviewed runtime buffers. It never reads or writes files.
const changes={
 'ot-lifecycle.js':[
  'return {ok:true,ready:true,version:1,atomicStock:true};',
  'return {ok:true,ready:true,version:1,atomicStock:true,otKey,otRevision:ot._svListRevision??0,expectedOTHash:digest(ot)};'
 ],
 'ot-delivery.js':[
  "if(!Model.key(otKey)||!await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,identity))throw fail(409,'La OT no existe.');return{ok:true,ready:true,version:1,atomicStock:true};",
  "if(!Model.key(otKey))throw fail(409,'La OT no existe.');const ot=await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,identity);if(!ot)throw fail(409,'La OT no existe.');return{ok:true,ready:true,version:1,atomicStock:true,otKey,otRevision:ot._svListRevision??0,expectedOTHash:digest(ot)};"
 ]
};
function apply(filename,input){
 const name=String(filename).replaceAll('\\','/').split('/').at(-1),pair=changes[name];
 if(!pair||typeof input!=='string'&&!Buffer.isBuffer(input))throw Error('Unsupported OT ready overlay input');
 const source=Buffer.isBuffer(input)?input.toString('utf8'):input,[before,after]=pair;
 let result=source;
 if(source.includes(after)){if(source.split(after).length!==2||source.includes(before))throw Error('Ambiguous patched availability');}
 else{
  const start=source.indexOf('async function available('),end=source.indexOf('async function executeInternal(',start);
  if(start<0||end<start||source.split(before).length!==2||!source.slice(start,end).includes(before))throw Error('Reviewed OT availability shape changed');
  result=source.replace(before,after);
  if(result.replace(after,before)!==source)throw Error('OT overlay changed unrelated bytes');
 }
 return Buffer.isBuffer(input)?Buffer.from(result,'utf8'):result;
}
module.exports={apply};
