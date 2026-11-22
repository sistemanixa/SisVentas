'use strict';
// Explicit OFFLINE candidate. No IO, deployment, flags or additional authority.
const {permissionsIdle,fence,serverActor,userActor}=require('../../cotizador/labor-fence-policy');
const closed=value=>value===undefined||value===false||value==='false';
function prepare(input){
 const out=structuredClone(input);
 if(!out.rules||typeof out.rules!=='object')throw Error('Faltan reglas completas.');
 function visit(node,segments,conditions){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de reglas inválido.');
  if(segments.length<2){if(!closed(node['.write']))throw Error('Autoridad ancestro no acotable: '+(segments.join('/')||'/'));}
  else if(!closed(node['.write'])){
   const original=node['.write'];if(typeof original!=='string')throw Error('Concesión no revisada.');
   const gate='('+permissionsIdle+') || ('+fence(segments.length,'('+serverActor+') || ('+userActor+')')+')';
   const prefix=conditions.length?'('+conditions.join(' && ')+') ? (':'(';
   const marker=prefix+'('+gate+') && (';
   if(!original.startsWith(marker))node['.write']=marker+original+'))'+(conditions.length?' : ('+original+')':'');
  }
  for(const [name,child]of Object.entries(node)){
   if(name.startsWith('.'))continue;
   const depth=segments.length,target=['sisventas','productos'][depth];
   if(target&&name!==target&&!name.startsWith('$'))continue;
   if(name.startsWith('$')&&!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín inválido.');
   visit(child,segments.concat(name),conditions.concat(target&&name.startsWith('$')?name+" === '"+target+"'":[]));
  }
 }
 visit(out.rules,[],[]);return out;
}
module.exports={prepare};
