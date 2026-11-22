'use strict';
// Restricts only the newly reserved Link1 capability. Never adds authority.
const outside="(auth == null || auth.token.svStockLinkVersion !== 1)",closed=v=>v===undefined||v===false||v==='false',fields=['ok','committed','operationId','productKey','inventoryKey','receiptIdentityKey','revision'];
const allowed=new Set(['sv_labor_guard','sv_labor_receipts/$op','sisventas/stock_vinculos/porProducto/$product','sisventas/stock_vinculos/porInventario/$inventory','sisventas/stock_vinculos/operaciones/$operation']);
function restrict(out){const filtered=[];function visit(node,path){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Reglas de scope inválidas.');if(!closed(node['.write'])&&!allowed.has(path.join('/'))){const original=node['.write'];if(typeof original!=='string'&&original!==true)throw Error('Grant no reconocido.');node['.write']=outside+' && ('+original+')';filtered.push(path.join('/')+'/.write');}for(const [name,child]of Object.entries(node))if(!name.startsWith('.'))visit(child,path.concat(name));}visit(out.rules,[]);
 const guard=out.rules.sv_labor_guard,receipt=out.rules.sv_labor_receipts?.$op;
 if(!guard||typeof guard['.write']!=='string'||!receipt||typeof receipt['.write']!=='string'||!receipt.result||typeof receipt.result!=='object')throw Error('Falta contrato de guard/recibo revisable.');
 guard['.write']='('+outside+" || (auth.token.mode === 'commit' && auth.uid === root.child('sv_labor_guard/actorUid').val())) && ("+guard['.write']+')';
 const original=receipt['.validate'];receipt['.validate']='('+outside+" || newData.hasChildren(['result'])) && ("+(original===undefined?'true':original)+')';
 const result=receipt.result,root="newData.parent().parent().parent()",op=root+".child('sisventas/stock_vinculos/operaciones').child(auth.token.opId)",previous="root.child('sisventas/stock_vinculos/operaciones').child(auth.token.opId)";
 const oldValidation=result['.validate'];result['.validate']='('+outside+' || ('+op+'.exists() && !'+previous+'.exists() && newData.hasChildren('+JSON.stringify(fields)+') && '+fields.map(f=>"newData.child('"+f+"').val() === "+op+".child('result/"+f+"').val()").join(' && ')+')) && ('+(oldValidation===undefined?'true':oldValidation)+')';
 for(const [name,node]of Object.entries(result))if(!name.startsWith('.')&&!fields.includes(name)){const prior=node['.validate'];node['.validate']=outside+' && ('+(prior===undefined?'true':prior)+')';}
 for(const name of fields)if(!result[name])result[name]={'.validate':true};
 if(!result.$other)result.$other={'.validate':outside};
 return{filtered,guardRestricted:true,receiptValidators:['sv_labor_receipts/$op/.validate','sv_labor_receipts/$op/result/.validate','sv_labor_receipts/$op/result/$other/.validate']};
}
module.exports={restrict,outside};
