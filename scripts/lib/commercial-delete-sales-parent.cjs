'use strict';
// One reviewed structural rewrite only: the known server-only collection grant
// is regenerated at record depth. The original record authority is untouched.
const Fence=require('../../cotizador/labor-fence-policy'),{digest}=require('../../cotizador/labor-guard');
const Wildcard=require('./commercial-delete-domain-wildcard.cjs');
const PARENT=Fence.financialRule(2,'false');
const EXPECTED_SHA256='a7938a6aaaad2b1a86e3aa2984993724c283ab6534e382aa1c7135069f30be3b';
const closed=value=>value===undefined||value===false||value==='false';
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fail(){throw Error('La autoridad padre de Ventas no coincide con la plantilla única revisada.');}
function anyGrant(node){return object(node)&&Object.entries(node).some(([name,value])=>name==='.write'?!closed(value):!name.startsWith('.')&&anyGrant(value));}
function prepare(input){
 const out=Wildcard.prepare(input),root=out?.rules,data=root?.sisventas,sales=data?.ventas;
 if(digest(PARENT)!==EXPECTED_SHA256||!object(root)||!object(data)||!object(sales)||!closed(root['.write'])||!closed(data['.write'])||sales['.write']!==PARENT)fail();
 for(const [name,node]of Object.entries(root))if(name.startsWith('$')&&anyGrant(node))fail();
 for(const [name,node]of Object.entries(data))if(name.startsWith('$')&&anyGrant(node)&&!Wildcard.recognized(name,node))fail();
 const children=Object.keys(sales).filter(name=>!name.startsWith('.'));if(children.length!==1||children[0]!=='$venta'||!object(sales.$venta))fail();
 if(Object.keys(sales).some(name=>name.startsWith('.')&&!['.read','.write','.validate','.indexOn'].includes(name)))fail();
 const original=sales.$venta['.write'];if(original!==undefined&&original!==false&&(typeof original!=='string'||!original.trim()))fail();
 sales['.write']=false;
 sales.$venta['.write']='('+Fence.financialRule(3,'false')+') || ('+(original===undefined||original===false?'false':original)+')';
 return out;
}
module.exports={prepare,PARENT,EXPECTED_SHA256};
