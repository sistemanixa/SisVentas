'use strict';
const crypto=require('node:crypto');
const {identity}=require('./personal-expenses');
const {esComision,claveGrupo}=require('./commission-calculations');

const INDEX_ROOT='sv_labor_indexes',VERSION=1;
const indexes=Object.freeze({gastos:['identity','commissionGroup','legacyKey'],hsextra_solicitudes:['aporteId','employeeMonth']});
const invalid=message=>Object.assign(Error(message),{statusCode:400});
function recordKey(key){
 if(typeof key!=='string'||!key||Buffer.byteLength(key)>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(key))throw invalid('Clave de registro laboral inválida');
 return key;
}
function indexType(domain,index){
 if(!Object.hasOwn(indexes,domain)||!indexes[domain].includes(index))throw invalid('Índice laboral inválido');
}
function bucketPath(domain,index,value){
 indexType(domain,index);
 const serialized=JSON.stringify(value);
 if(serialized===undefined)throw invalid('Valor de índice laboral inválido');
 return INDEX_ROOT+'/'+domain+'/'+index+'/'+crypto.createHash('sha256').update(serialized).digest('hex');
}
function indexEntries(domain,key,record){
 if(!Object.hasOwn(indexes,domain))throw invalid('Dominio laboral inválido');
 recordKey(key);const result=Object.create(null);
 if(record==null)return result;
 if(typeof record!=='object'||Array.isArray(record))throw invalid('Registro laboral inválido');
 const add=(index,value)=>{result[bucketPath(domain,index,value)+'/'+key]=true;};
 if(domain==='gastos'){
  add('identity',identity(record));
  // El grupo usa la clave real, incluso cuando la ficha contiene un fbKey viejo.
  if(esComision(record))add('commissionGroup',claveGrupo({...record,fbKey:key}));
  if(typeof record.legacyKey==='string'&&record.legacyKey)add('legacyKey',record.legacyKey);
 }else{
  for(const aporteId of Object.keys(record.aportes||{}))add('aporteId',aporteId);
  add('employeeMonth',[record.empFbKey,String(record.mes||record.fecha).slice(0,7)]);
 }
 return result;
}
function buildIndex(snapshot){
 if(snapshot!=null&&(typeof snapshot!=='object'||Array.isArray(snapshot)))throw invalid('Datos laborales inválidos');
 const result=Object.create(null);
 for(const domain of Object.keys(indexes)){
  const records=snapshot?.[domain];
  if(records!=null&&typeof records!=='object')throw invalid('Colección laboral inválida');
  for(const [key,record]of Object.entries(records||{}))Object.assign(result,indexEntries(domain,key,record));
 }
 return result;
}
// Sólo referencias derivadas. La preparación/versión del índice pertenece al
// coordinador y nunca se elimina cuando desaparece el último miembro de un grupo.
function planIndexDelta(recordsBeforeAfter){
 if(!Array.isArray(recordsBeforeAfter))throw invalid('Cambios laborales inválidos');
 const result=Object.create(null),seen=new Set();
 for(const change of recordsBeforeAfter){
  if(!change||typeof change!=='object')throw invalid('Cambio laboral inválido');
  const {domain,key,before,after}=change,id=JSON.stringify([domain,key]);
  if(seen.has(id))throw invalid('Registro laboral repetido en la operación');seen.add(id);
  const previous=indexEntries(domain,key,before),next=indexEntries(domain,key,after);
  for(const path of Object.keys(previous))if(!Object.hasOwn(next,path))result[path]=null;
  for(const path of Object.keys(next))if(!Object.hasOwn(previous,path))result[path]=true;
 }
 return result;
}
module.exports={INDEX_ROOT,VERSION,bucketPath,indexEntries,buildIndex,planIndexDelta};
