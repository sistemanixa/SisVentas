'use strict';
const Policy=require('../cotizador/labor-fence-policy'),Summary=require('./prepare-collection-summary-rules.cjs');
const {writer}=require('./prepare-payment-index-rules.cjs');
const closed=value=>value===undefined||value===false||value==='false';
function prepare(base,{expectedHash}={}){
 if(Summary.hash(base)!==expectedHash)throw Error('Base de reglas no verificada');
 const result=structuredClone(base),rules=result.rules;
 if(!rules?.sisventas?.pagos||!closed(rules['.write'])||!closed(rules.sisventas['.write'])||rules.sv_labor_indexes?.['.write']!==Policy.metadataRules().sv_labor_indexes['.write'])throw Error('Base coordinada no reconocida');
 function wrap(node,path){
  if(Object.hasOwn(node,'.write')&&!closed(node['.write'])){
   if(!Policy.recognizedRule(node['.write'],path,'.write',value=>value.includes('svPasswordChangeRequired')))throw Error('Escritor de pago no reconocido');
   node['.write']='('+node['.write']+') && '+writer;
  }
  for(const [key,value]of Object.entries(node))if(!key.startsWith('.')&&value&&typeof value==='object')wrap(value,path+'/'+key);
 }
 wrap(rules.sisventas.pagos,'sisventas/pagos');rules.sv_labor_indexes['.write']='('+rules.sv_labor_indexes['.write']+') && '+writer;
 // Conservar recibos y permisos extendidos ya publicados de bonos/SAC/gastos.
 return result;
}
module.exports={prepare,hash:Summary.hash};
