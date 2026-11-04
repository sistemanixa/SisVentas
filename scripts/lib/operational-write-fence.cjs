'use strict';
// Offline candidate builder only. Never reads or writes a remote database.
const {permissionsIdle,financialRule}=require('../../cotizador/labor-fence-policy');
const domains=Object.freeze(['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo','inventario_operativo']);
const summaryDomains=Object.freeze(['ordenes','listas_materiales','inventario_operativo']);
function prepare(input){
 const out=structuredClone(input),root=out.rules,data=root?.sisventas;
 for(const node of [root,data])if(!node||![undefined,false,'false'].includes(node['.write']))throw Error('Revisar autoridad padre antes de cerrar los escritores operativos.');
 if(Object.entries(root).some(([key,node])=>key.startsWith('$')&&JSON.stringify(node).includes('".write"')))throw Error('Revisar autoridad comodín en la raíz.');
 const prefix='('+permissionsIdle+') && (';
 function wrap(original,depth){if(original===false||original==='false')return original;if(typeof original!=='string')throw Error('La autoridad de escritura requiere revisión.');if(original.startsWith(prefix))return original;return prefix+original+') || ('+financialRule(depth,original)+')';}
 function visit(node,depth,condition){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Regla operativa inválida.');for(const [name,value]of Object.entries(node)){if(name==='.write'){
   if(condition){const marker='('+condition+') ? (';if(typeof value==='string'&&value.startsWith(marker))continue;const next=wrap(value,depth);if(next!==value)node[name]=marker+next+') : ('+value+')';
   }else node[name]=wrap(value,depth);
  }else if(!name.startsWith('.'))visit(value,depth+1,condition);}}
 for(const domain of domains){if(!data[domain])throw Error('Falta inventariar el dominio '+domain+'.');visit(data[domain],2);}
 const summaries=data.compras_resumen;
 if(!summaries||![undefined,false,'false'].includes(summaries['.write']))throw Error('Revisar autoridad padre de resúmenes de Compras.');
 for(const domain of summaryDomains){if(!summaries[domain])throw Error('Falta el resumen de '+domain+'.');visit(summaries[domain],3);}
 for(const [name,node]of Object.entries(summaries))if(name.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín de resumen inválido.');visit(node,3,summaryDomains.map(domain=>name+" === '"+domain+"'").join(' || '));}
 for(const [name,node]of Object.entries(data))if(name.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín inválido.');visit(node,2,domains.map(domain=>name+" === '"+domain+"'").join(' || '));}
 return out;
}
module.exports={prepare,domains,summaryDomains};
