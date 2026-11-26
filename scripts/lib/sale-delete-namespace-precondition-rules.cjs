'use strict';
// Atomic PRE/POST namespace CAS, activated only by the reserved delete action.
const ROOTS=Object.freeze(['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies']);
function modePredicate(depth){
 if(!Number.isInteger(depth)||depth<0)throw Error('Profundidad inválida.');
 const next='newData'+'.parent()'.repeat(depth),h='auth.token.svClientHistoryWriterVersion',f='auth.token.svSaleFinancialWriterVersion';
 const absent=ROOTS.flatMap(p=>["!root.child('"+p+"').exists()","!"+next+".child('"+p+"').exists()"]).join(' && ');
 const installed=["root.child('sv_client_history_config/schema').val() === 1","root.child('sv_client_history_config/ready').val() === true","root.child('sv_client_history_config/writerSchema').val() === 1","root.child('sv_client_history/v1/state/schema').val() === 1","root.child('sv_client_history/v1/state/ready').val() === true","root.child('sv_client_history_config/generation').isString()","root.child('sv_client_history/v1/state/generation').val() === root.child('sv_client_history_config/generation').val()","root.child('sv_sale_financial_dependencies/v1/coverage/schema').val() === 1","root.child('sv_sale_financial_dependencies/v1/coverage/ready').val() === true","root.child('sv_sale_financial_dependencies/v1/coverage/generation').isString()","root.child('sv_sale_financial_dependencies/v1/coverage/revision').isNumber()","root.child('sv_sale_financial_dependencies/v1/coverage/revision').val() >= 1","root.child('sv_sale_financial_dependencies/v1/coverage/unresolved').val() === 0"].join(' && ');
 return '(('+h+' === 0 && '+f+' === 0 && '+absent+') || ('+h+' === 1 && '+f+' === 1 && '+installed+'))';
}
const predicate=depth=>"(auth == null || auth.token.svFinancialAction !== 'ventas.eliminar' || "+modePredicate(depth)+')';
const prefix=depth=>'('+predicate(depth)+') && (';
function prepare(input){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules))throw Error('Faltan reglas completas.');
 const rules=structuredClone(input),changed=[];
 function visit(node,path){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo no revisable.');const old=node['.write'];
  if(![undefined,false,'false'].includes(old)){if(old!==true&&typeof old!=='string')throw Error('Grant no revisable.');node['.write']=prefix(path.length)+String(old)+')';changed.push([...path,'.write'].join('/'));}
  for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))visit(v,[...path,k]);
 }
 visit(rules.rules,[]);return{rules,changed};
}
module.exports={ROOTS,modePredicate,predicate,prefix,prepare};
