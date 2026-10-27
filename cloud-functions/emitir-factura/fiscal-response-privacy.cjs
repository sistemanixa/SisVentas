'use strict';
// Provider lookup metadata is not a second document-download endpoint.
function withoutFiles(value,depth=0){
 if(depth>64)return null;
 if(typeof value==='string'&&/^data:(?:application\/(?:pdf|octet-stream)|image\/)/i.test(value))return null;
 if(Array.isArray(value))return value.map(item=>withoutFiles(item,depth+1));
 if(!value||typeof value!=='object')return value;
 const out={};
 for(const [key,entry]of Object.entries(value)){
  if(/pdf|base64|^archivo(?:_?data)?$|^file(?:_?data)?$/i.test(key))continue;
  if((value.tipo==='application/pdf'||value.type==='application/pdf')&&['data','url','href','src'].includes(key))continue;
  Object.defineProperty(out,key,{value:withoutFiles(entry,depth+1),enumerable:true,configurable:true,writable:true});
 }
 return out;
}
module.exports={withoutFiles};
