'use strict';
// Read-only shape for existing controllers; data always comes from the REST store.
const {parts}=require('./labor-guard');
function create({store}){
 if(typeof store?.read!=='function'||typeof store?.readQuery!=='function')throw Error('Falta el puerto REST fresco de lectura');
 function ref(path,spec={}){
  parts(path);
  return Object.freeze({
   orderByChild:field=>ref(path,{...spec,orderBy:field}),orderByKey:()=>ref(path,{...spec,orderBy:'$key'}),equalTo:value=>ref(path,{...spec,equalTo:value}),
   // Space is the least permitted RTDB key character: inclusive cursor+' '
   // includes every legal lexical extension while excluding the cursor itself.
   startAt:value=>ref(path,{...spec,startAt:value}),startAfter:value=>{if(typeof value!=='string')throw Error('Cursor inválido');return ref(path,{...spec,startAt:value+' '});},limitToFirst:limit=>ref(path,{...spec,limitToFirst:limit}),
   async get(){const value=Object.keys(spec).length?await store.readQuery(path,spec):await store.read(path);return {val:()=>structuredClone(value),forEach(fn){for(const key of Object.keys(value||{}).sort())if(fn({key,val:()=>structuredClone(value[key])})===true)return true;return false;}};}
  });
 }
 return Object.freeze({ref:path=>ref(path)});
}
module.exports={create};
