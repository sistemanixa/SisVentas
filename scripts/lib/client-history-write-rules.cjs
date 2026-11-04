'use strict';
// Offline write-side preparation only. History readers remain closed.
const H=require('../../cotizador/client-history-model');
const closed=value=>value===undefined||value===false||value==='false';
function prepare(input){
 const out=structuredClone(input),root=out.rules,data=root?.sisventas;
 if(!root||!data||!closed(root['.write'])||!closed(root['.read'])||!closed(data['.write']))throw Error('Revisar autoridad padre antes de coordinar Historial.');
 if(root.sv_client_history||root.sv_client_history_config)throw Error('La autoridad de Historial ya existe; requiere comparación explícita.');
 for(const [name,node]of Object.entries(root))if(name.startsWith('$')&&JSON.stringify(node).includes('".write"'))throw Error('Revisar escritor comodín de raíz.');
 const financial=root.sv_labor_indexes?.['.write'];
 if(typeof financial!=='string'||!financial.includes('sv_labor_guard')||!financial.includes('svLaborService')||!financial.includes('sv_labor_receipts'))throw Error('Falta el guard financiero verificable.');
 const historyClaim='auth.token.svClientHistoryWriterVersion === 1';
 root.sv_client_history={'.read':false,'.write':'('+financial+') && ('+historyClaim+')'};
 root.sv_client_history_config={'.read':false,'.write':false};
 const installed="(root.child('sv_client_history_config/ready').val() === true || root.child('sv_client_history_config/writerMode').val() === 'coordinated-v1' || root.child('sv_client_history/v1/state').exists())";
 const lock=depth=>'(!'+installed+' || ('+financial.replaceAll('newData.parent()','newData'+'.parent()'.repeat(depth))+') && ('+historyClaim+'))';
 function visit(node,depth,condition){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Regla de fuente inválida.');for(const [name,value]of Object.entries(node)){if(name==='.write'&&!closed(value)){if(typeof value!=='string')throw Error('Autoridad de fuente no reconocida.');node[name]='('+value+') && '+(condition?'(!('+condition+') || '+lock(depth)+')':lock(depth));}else if(!name.startsWith('.'))visit(value,depth+1,condition);}}
 for(const domain of H.domains){if(!data[domain])throw Error('Falta inventariar '+domain+'.');visit(data[domain],2);}
 for(const [name,node]of Object.entries(data))if(name.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín inválido.');visit(node,2,H.domains.map(domain=>name+" === '"+domain+"'").join(' || '));}
 return out;
}
module.exports={prepare,domains:H.domains};
