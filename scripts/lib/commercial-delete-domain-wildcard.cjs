'use strict';
// Narrow one reviewed leaf wildcard without interpreting its original policy.
// This is an offline AND restriction, never a grant or a remote attestation.
const NAME='$dominio',SUFFIX=") && ($dominio !== 'ventas' && $dominio !== 'ordenes' && $dominio !== 'ordenes_trabajo')";
const closed=value=>value===undefined||value===false||value==='false';
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function fail(){throw Error('El comodín de dominio requiere revisión: sólo se admite la hoja $dominio con read/write.');}
function balanced(source){
 if(typeof source!=='string'||!source.trim())return false;
 let depth=0,quote='',escaped=false;
 for(const ch of source){
  if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
  if(ch==="'"||ch==='"'){quote=ch;continue;}
  // This known leaf uses no regex/division/comments. Reject those ambiguous
  // forms rather than counting parentheses inside a regex/comment as syntax.
  if(ch==='/'||ch==='`'||ch===';')return false;
  if(ch==='(')depth++;else if(ch===')'&&--depth<0)return false;
 }
 return !quote&&!escaped&&depth===0;
}
function leaf(name,node){return name===NAME&&object(node)&&Object.keys(node).every(key=>key==='.read'||key==='.write')&&[node['.read'],node['.write']].every(value=>closed(value)||typeof value==='string'&&!!value.trim())&&(closed(node['.write'])||balanced(node['.write']));}
function wrap(original){return '('+original+SUFFIX;}
function recognized(name,node){
 if(!leaf(name,node))return false;const value=node['.write'];if(closed(value))return true;
 if(typeof value!=='string'||value[0]!=='('||!value.endsWith(SUFFIX))return false;
 const original=value.slice(1,-SUFFIX.length);return balanced(original)&&value===wrap(original);
}
function prepare(input){
 const out=structuredClone(input),r=out?.rules,s=r?.sisventas;if(!object(r)||!object(s)||!closed(r['.write'])||!closed(s['.write']))fail();
 for(const [name,node]of Object.entries(s))if(name.startsWith('$')){if(!leaf(name,node))fail();if(!closed(node['.write'])&&!recognized(name,node))node['.write']=wrap(node['.write']);}
 return out;
}
module.exports={prepare,recognized,NAME};
