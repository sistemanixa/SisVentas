'use strict';
// OFFLINE PROPOSAL. Apply only after compatible readers/writers and a reviewed cut.
const fs=require('node:fs'),path=require('node:path'),Employee=require('./prepare-commission-privacy-rules.cjs'),Policy=require('../cotizador/labor-fence-policy');
const BASELINE_HASH='774afc535d2f43e718bb57b8a39482063189521db36b34c6779b24725490e31a',ROOTS=['sv_commercial_views','sv_commercial_view_sources'];
const PURCHASE_DOMAINS=['ordenes','listas_materiales','inventario_operativo'];
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=v=>v===undefined||v===false||v==='false';
function restrictReads(node){for(const [name,value]of Object.entries(node)){if(name==='.read'&&!closed(value)){if(typeof value!=='string'&&typeof value!=='boolean')throw Error('Lectura comercial inválida');node[name]='('+value+') && ('+Employee.expressions.financial+')';}else if(!name.startsWith('.')&&object(value))restrictReads(value);}}
function fencePurchaseWrites(node,depth=2){
 if(Object.hasOwn(node,'.write')){const original=node['.write'];if(typeof original!=='boolean'&&typeof original!=='string'||typeof original==='string'&&original.includes('svLaborService'))throw Error('Escritura de Compras no revisada');node['.write']=depth===2?Policy.financialRule(depth,String(original)):closed(original)?original:Policy.childRule(depth,String(original));}
 for(const [name,value]of Object.entries(node))if(!name.startsWith('.')&&object(value))fencePurchaseWrites(value,depth+1);
}
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!object(input)||!object(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||Employee.hash(input)!==expectedHash)throw Error('Base exacta de vistas de cuenta requerida');
 const rules=input.rules,original=rules.sisventas;
 for(const [label,node]of [['raíz',rules],['sisventas',original]])if(!object(node)||!closed(node['.read'])||!closed(node['.write']))throw Error('Concesión ancestro no revisada: '+label);
 if(!object(rules[Employee.VIEW_ROOT])||!object(rules.sv_labor_config?.employeeAccountViews)||ROOTS.some(root=>Object.hasOwn(rules,root))||Object.hasOwn(rules.sv_labor_config,'commercialViews'))throw Error('Transición de vistas no revisada');
 const serviceWrite=Policy.metadataRules().sv_labor_indexes['.write'];if(rules.sv_labor_indexes?.['.write']!==serviceWrite)throw Error('Fence no reconocido');
 for(const domain of ['ventas','presupuestos'])if(!object(original[domain])||!closed(original[domain]['.write'])&&domain==='presupuestos')throw Error('Nodo comercial no reconocido');
 const budget=original.presupuestos.$presupuesto,previous=budget?.['.write'];if(!object(budget)||typeof previous!=='string'||previous.includes('svLaborService'))throw Error('Escritura de presupuesto debe revisarse antes de cercarla');
 // A wildcard ancestor grant would override the exact record fence.
 const wildcard=original.$dominio?.['.write'];if(!closed(wildcard)&&(typeof wildcard!=='string'||!wildcard.includes("$dominio !== 'presupuestos'")))throw Error('Comodín de escritura permite presupuesto');
 for(const name of PURCHASE_DOMAINS){if(!object(original[name])||!Object.hasOwn(original[name],'.write'))throw Error('Nodo de Compras ausente: '+name);if(!closed(wildcard)&&!wildcard.includes("$dominio !== '"+name+"'"))throw Error('Comodín de escritura permite Compras: '+name);}
 const next=structuredClone(input),domain=next.rules.sisventas;
 for(const name of ['ventas','presupuestos'])restrictReads(domain[name]);
 if(domain.$dominio&&!closed(domain.$dominio['.read']))domain.$dominio['.read']='('+domain.$dominio['.read']+") && ($dominio !== 'ventas' && $dominio !== 'presupuestos')";
 // Keep all original actor/ownership/state predicates inside their fences.
 // Purchase sources must share the lease with the derived sale-cost update.
 domain.presupuestos.$presupuesto['.write']=Policy.childRule(3,previous);
 for(const name of PURCHASE_DOMAINS)fencePurchaseWrites(domain[name]);
 for(const root of ROOTS)next.rules[root]={'.read':false,'.write':serviceWrite};
 next.rules.sv_labor_config.commercialViews={'.validate':"newData.hasChildren(['schema','enabled'])",schema:{'.validate':'newData.val() === 1'},enabled:{'.validate':'newData.isBoolean()'},'$other':{'.validate':false}};
 return next;
}
function main(args=process.argv.slice(2)){
 if(args.includes('--apply'))throw Error('Sólo propuesta offline; no hay modo aplicar');
 const [source,target,expectedHash=BASELINE_HASH]=args;if(args.length<2||args.length>3||!source||!target||!target.endsWith('.candidate.json')||path.resolve(source).toLowerCase()===path.resolve(target).toLowerCase())throw Error('Uso: base-local.json salida.candidate.json [hash-base]');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,'')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log('PROPUESTA OFFLINE, NO APLICADA: '+Employee.hash(result));
}
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={build,main,BASELINE_HASH,ROOTS,PURCHASE_DOMAINS,hash:Employee.hash};
