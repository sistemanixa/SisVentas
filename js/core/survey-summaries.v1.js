(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSurveySummaries=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var DETAIL='sisventas/relevamientos',INDEX='sisventas/relevamientos_resumen';
 var fields=Object.freeze(['id','cliente','direccion','autor','savedAt']);
 function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
 function key(v){return typeof v==='string'&&v.length>0&&new TextEncoder().encode(v).length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype','hasOwnProperty'].includes(v);}
 function summary(row,id){
  if(!key(id)||!object(row))throw Error('Identificación de relevamiento inválida');
  var out={};fields.forEach(function(field){var value=row[field];if(value===undefined||value===null)value=field==='id'?id:'';if(typeof value!=='string'||value.length>(field==='direccion'?8000:4000))throw Error('Dato de relevamiento inválido');out[field]=value;});return out;
 }
 function parseIndex(data){
  var meta=data?.meta;if(!object(meta)||meta.schema!==1||meta.ready!==true||!Number.isSafeInteger(meta.baselineCount)||meta.baselineCount<0||typeof meta.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(meta.sourceHash))throw Error('Falta preparar el listado de relevamientos');
  var records=data.records||{};if(!object(records))throw Error('Listado de relevamientos inválido');
  return Object.entries(records).map(function(entry){var id=entry[0],row=entry[1];if(!object(row)||Object.keys(row).length!==fields.length||Object.keys(row).some(function(f){return !fields.includes(f);}))throw Error('Resumen de relevamiento inválido');var dto=summary(row,id);return Object.assign({key:id},dto);}).sort(function(a,b){return b.savedAt.localeCompare(a.savedAt)||a.key.localeCompare(b.key);});
 }
 function savePatch(data){if(!object(data)||!key(data.id))throw Error('Identificación de relevamiento inválida');var out={};out[DETAIL+'/'+data.id]=JSON.parse(JSON.stringify(data));out[INDEX+'/records/'+data.id]=summary(data,data.id);return out;}
 function buildIndex(rows,sourceHash){
  if(!object(rows)||!/^[a-f0-9]{64}$/.test(sourceHash||''))throw Error('Inventario de relevamientos inválido');var records={};for(var entry of Object.entries(rows))records[entry[0]]=summary(entry[1],entry[0]);
  return {meta:{schema:1,ready:true,baselineCount:Object.keys(records).length,sourceHash:sourceHash},records:records};
 }
 return Object.freeze({DETAIL:DETAIL,INDEX:INDEX,fields:fields,key:key,summary:summary,parseIndex:parseIndex,savePatch:savePatch,buildIndex:buildIndex});
});
