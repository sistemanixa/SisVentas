'use strict';
// Offline candidate. The technical dependency index grants no client read.
const Protocol=require('../../cotizador/sale-financial-dependencies-protocol'),Model=require('../../cotizador/sale-financial-dependencies-model');
const closed=value=>value===undefined||value===false||value==='false';
const originals=Object.freeze(['ventas','gastos','ctaemp','comisiones_generacion']);
function prepare(input){
 const output=structuredClone(input),root=output.rules,data=root?.sisventas;
 if(!root||!data||!closed(root['.write'])||!closed(root['.read'])||!closed(data['.write']))throw Error('Revisar autoridad padre de dependencias financieras.');
 if(root.sv_sale_financial_dependencies)throw Error('La cobertura financiera existente requiere comparación explícita.');
 const financial=root.sv_labor_indexes?.['.write'];if(typeof financial!=='string'||!financial.includes('sv_labor_guard')||!financial.includes('sv_labor_receipts')||!financial.includes('svLaborService'))throw Error('Falta el guard financiero verificable.');
 root.sv_sale_financial_dependencies={'.read':false,'.write':'('+financial+') && auth.token.'+Protocol.CLAIM+' === 1'};
 const lock=depth=>'(!'+Protocol.installed+' || (('+financial.replaceAll('newData.parent()','newData'+'.parent()'.repeat(depth))+') && auth.token.'+Protocol.CLAIM+' === 1))';
 function visit(node,depth,condition){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Falta inventariar un escritor financiero.');for(const [name,value]of Object.entries(node)){if(name==='.write'&&!closed(value)){if(typeof value!=='string')throw Error('Autoridad financiera no reconocida.');node[name]='('+value+') && '+(condition?'(!('+condition+') || '+lock(depth)+')':lock(depth));}else if(!name.startsWith('.'))visit(value,depth+1,condition);}}
 for(const domain of originals){if(!data[domain])throw Error('Falta inventariar '+domain);visit(data[domain],2);}
 if(!root.sv_commission_generation)throw Error('Falta inventariar el control de generación.');visit(root.sv_commission_generation,1);
 for(const [name,node]of Object.entries(data))if(name.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(name))throw Error('Comodín financiero inválido.');visit(node,2,originals.map(domain=>name+" === '"+domain+"'").join(' || '));}
 return output;
}
module.exports={prepare,originals,root:Model.ROOT};
