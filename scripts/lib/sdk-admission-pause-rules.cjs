'use strict';
const roots=Object.freeze(['sisventas','sv_usuarios','sv_chat_roles','sv_permisos','sv_commission_generation','sv_commission_events']);
const open="(!root.child('sv_labor_config/sdkAdmissionPaused').exists() || root.child('sv_labor_config/sdkAdmissionPaused').val() === false)";
const service='(auth != null && auth.token.svLaborService === true)';
const closed=value=>value===undefined||value===false||value==='false';
function parts(source,operator){
 const out=[];let depth=0,quote='',escaped=false,start=0;
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
  if(ch==="'"||ch==='"'){quote=ch;continue;}
  if(ch==='(')depth++;else if(ch===')')depth--;
  if(depth<0)throw Error('Expresión de escritura no balanceada.');
  if(depth===0&&source.slice(i,i+operator.length)===operator){out.push(source.slice(start,i).trim());start=i+operator.length;i+=operator.length-1;}
 }
 if(depth||quote)throw Error('Expresión de escritura no balanceada.');
 out.push(source.slice(start).trim());return out;
}
function requiresService(source){
 // Prove necessity structurally, never from a substring in an OR branch.
 let quoted='',escape=false;
 for(const ch of source){if(quoted){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quoted)quoted='';}else if(ch==="'"||ch==='"')quoted=ch;else if(ch==='?')return false;}
 let value=source.trim();
 while(value.startsWith('(')&&value.endsWith(')')){
  let depth=0,quote='',escaped=false,enclosing=true;
  for(let i=0;i<value.length;i++){const ch=value[i];if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'){quote=ch;continue;}if(ch==='(')depth++;else if(ch===')')depth--;if(depth===0&&i<value.length-1){enclosing=false;break;}}
  if(!enclosing)break;value=value.slice(1,-1).trim();
 }
 const ors=parts(value,'||');if(ors.length>1)return ors.every(requiresService);
 const ands=parts(value,'&&');if(ands.length>1)return ands.some(requiresService);
 return /^auth\.token\.svLaborService\s*===\s*true$/.test(value);
}
function assertUnscopedClosed(node,path){
 if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo no acotable: '+path);
 if(!closed(node['.write']))throw Error('Autoridad ancestro/comodín no acotable: '+path);
 for(const [key,value]of Object.entries(node))if(!key.startsWith('.'))assertUnscopedClosed(value,path+'/'+key);
}
const validator={'.validate':'newData.isBoolean()'};
const gateFor=original=>requiresService(String(original))?'('+open+' || '+service+')':open;
function strip(input){
 const out=structuredClone(input),tree=out.rules;
 if(!tree?.sv_labor_config||!Object.hasOwn(tree.sv_labor_config,'sdkAdmissionPaused'))return out;
 if(JSON.stringify(tree.sv_labor_config.sdkAdmissionPaused)!==JSON.stringify(validator))throw Error('Revisar configuración sdkAdmissionPaused existente.');
 if(!closed(tree['.write']))throw Error('Autoridad padre no acotable de pausa SDK.');
 for(const [key,node]of Object.entries(tree))if(key.startsWith('$'))assertUnscopedClosed(node,key);
 for(const name of roots){
  const walk=(node,path)=>{
   if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de reglas inválido: '+path);
   if(Object.hasOwn(node,'.write')&&!closed(node['.write'])){
    const wrapped=node['.write'];let original;
    if(typeof wrapped==='string'&&wrapped.startsWith('('))for(const gate of [open,'('+open+' || '+service+')']){
     const suffix=') && '+gate;
     if(wrapped.endsWith(suffix)){const candidate=wrapped.slice(1,-suffix.length);if(gateFor(candidate)===gate&&'('+candidate+') && '+gate===wrapped)original=candidate;}
    }
    if(original===undefined)throw Error('Envelope SDK no verificable: '+path);
    node['.write']=original==='true'?true:original;
   }
   for(const [key,child]of Object.entries(node))if(!key.startsWith('.'))walk(child,path+'/'+key);
  };
  if(!tree[name])throw Error('Falta raíz inventariada de pausa SDK: '+name);
  walk(tree[name],name);
 }
 delete tree.sv_labor_config.sdkAdmissionPaused;return out;
}
function prepare(input){
 const out=strip(input),tree=out.rules;
 if(!tree||typeof tree!=='object'||Array.isArray(tree)||!closed(tree['.write']))throw Error('Autoridad padre no acotable de pausa SDK.');
 for(const [key,node]of Object.entries(tree))if(key.startsWith('$'))assertUnscopedClosed(node,key);
 if(!tree.sv_labor_config||!requiresService(String(tree.sv_labor_config['.write']||'false')))throw Error('Falta autoridad reservada existente para la configuración.');
 for(const name of roots){
  const walk=(node,path)=>{
   if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de reglas inválido: '+path);
   if(Object.hasOwn(node,'.write')&&!closed(node['.write'])){
    const original=node['.write'];if(typeof original!=='string'&&original!==true)throw Error('Escritura no reconocida: '+path);
    const gate=gateFor(original);
    node['.write']='('+original+') && '+gate;
   }
   for(const [key,child]of Object.entries(node))if(!key.startsWith('.'))walk(child,path+'/'+key);
  };
  if(!tree[name])throw Error('Falta raíz inventariada de pausa SDK: '+name);
  walk(tree[name],name);
 }
 tree.sv_labor_config.sdkAdmissionPaused=structuredClone(validator);return out;
}
module.exports={prepare,strip,roots,open,requiresService};
