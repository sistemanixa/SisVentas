'use strict';
// Apply last, after all grant constructors. Only narrows existing authority.
const crypto=require('node:crypto');
const closed=v=>v===undefined||v===false||v==='false';
const predicate="(auth == null || auth.token.svOfficeStockVersion !== 1 || (auth.token.svOfficeStockPreconditionVersion === 1 && (auth.token.svOfficeStockSourcePresent === true || auth.token.svOfficeStockSourcePresent === false) && root.child('sisventas/inventario_operativo').child(auth.token.svOfficeStockInventoryKey).exists() === auth.token.svOfficeStockSourcePresent))";
function prepare(input){
  if(!input||!input.rules||typeof input.rules!=='object'||Array.isArray(input.rules))throw Error('Faltan reglas completas.');
  const out=structuredClone(input),changed=[];
  function visit(node,path){
    if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo no revisable.');
    const original=node['.write'];
    if(!closed(original)){
      if(original!==true&&typeof original!=='string')throw Error('Grant no revisable.');
      node['.write']='('+predicate+') && ('+String(original)+')';
      changed.push(path.concat('.write').join('/'));
    }
    for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))visit(v,path.concat(k));
  }
  visit(out.rules,[]);
  return{rules:out,manifest:{schema:1,changed,grantsAdded:false,activated:false,atomicPrecondition:'office-stock-source-presence-v1',applyLast:true,adminSdkBypassNotCovered:true,candidateDigest:crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex')}};
}
module.exports={prepare,predicate};
