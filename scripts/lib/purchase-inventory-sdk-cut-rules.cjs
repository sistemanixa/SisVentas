'use strict';
// Offline narrowing proposal only. Does not apply flags, rules or add authority.
const {fence,serverActor,userActor}=require('../../cotizador/labor-fence-policy');
const Activation=require('./stock-link-activation-rules.cjs'),domains=Object.freeze(['ordenes','listas_materiales','compras_resumen']);
const closed=value=>value===undefined||value===false||value==='false';
function prepare(input,{activationPins}={}){const out=structuredClone(input);if(!activationPins)return out;const active=Activation.predicate(activationPins);if(!out.rules?.sisventas)throw Error('Falta la copia íntegra de reglas.');
 const summaries=out.rules.sisventas.compras_resumen;if(!summaries||Object.keys(summaries).some(k=>!k.startsWith('.')&&!k.startsWith('$')&&!['ordenes','listas_materiales','inventario_operativo'].includes(k)))throw Error('Revisar dominios de resumen antes del corte.');
 function visit(node,segments,conditions){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de reglas inválido.');
  if(segments.length<2){if(!closed(node['.write']))throw Error('Autoridad ancestro no acotable.');}
  else if(!closed(node['.write'])){const original=node['.write'];if(typeof original!=='string')throw Error('Concesión no revisada.');const typed="(auth != null && auth.token.svLaborService === true && auth.token.mode === 'commit' && auth.token.svFinancialAction === 'ordenes.editar')",gate='(!('+typed+') || ('+active+')) && (!('+active+') || ('+fence(segments.length,'('+serverActor+') || ('+userActor+')')+'))',prefix=conditions.length?'('+conditions.join(' && ')+') ? (':'(',marker=prefix+'('+gate+') && (';if(!original.startsWith(marker))node['.write']=marker+original+'))'+(conditions.length?' : ('+original+')':'');}
  for(const [name,child]of Object.entries(node)){if(name.startsWith('.'))continue;const depth=segments.length;if(depth===0&&name!=='sisventas'&&!name.startsWith('$')||depth===1&&!domains.includes(name)&&!name.startsWith('$'))continue;if(name.startsWith('$')&&!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín inválido.');const condition=depth===0&&name.startsWith('$')?name+" === 'sisventas'":depth===1&&name.startsWith('$')?'('+domains.map(d=>name+" === '"+d+"'").join(' || ')+')':null;visit(child,segments.concat(name),conditions.concat(condition?[condition]:[]));}
 }
 visit(out.rules,[],[]);return out;
}
module.exports={prepare,domains};
