'use strict';
const {isDeepStrictEqual}=require('node:util');
const {rulesProtectOTUnitConfirmation}=require('./ot-unit-confirmation-rules');
const hash=v=>require('node:crypto').createHash('sha256').update(JSON.stringify(v)).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const guard="root.child('sv_labor_guard')";
const API="auth != null && auth.token.svLaborService === true && auth.token.svOTUnitConfirmation === true && auth.token.svOTUnitCustody === true && auth.token.mode === 'commit' && "+guard+".child('mode').val() === 'user' && "+guard+".child('otUnitPolicy').val() === 1 && "+guard+".child('actorUid').val() === auth.uid && "+guard+".child('fence').val() === auth.token.fence && "+guard+".child('opId').val() === auth.token.opId && "+guard+".child('digest').val() === auth.token.digest && "+guard+".child('expiresAt').val() > now";
const SAME="data.exists() && newData.val() === data.val()";
const countSame="data.exists() && newData.numChildren() === data.numChildren()";
function field(type){return {'.validate':'('+type+') && (('+API+') || ('+SAME+'))'};}
function nodeRules(){
 const event={'.validate':"newData.hasChildren(['accion','estado','uid','technicianKey','ts']) && (("+API+') || ('+countSame+'))',accion:field('newData.isString()'),estado:field('newData.isString()'),uid:field('newData.isString()'),technicianKey:field('newData.isString()'),ts:field('newData.isNumber()'),'$other':{'.validate':false}};
 const unit={'.validate':"newData.hasChildren(['unitKey','itemKey','n','materialKey','productKey','sourceDigest','technicianKey','serie','estado','historial','actualizadoEn','actualizadoPor']) && (("+API+') || ('+countSame+'))'};
 for(const name of ['unitKey','itemKey','materialKey','productKey','sourceDigest','technicianKey','serie','estado','actualizadoPor'])unit[name]=field('newData.isString()');
 for(const name of ['n','actualizadoEn','entregadoEn','devolucionSolicitadaEn','recibidoEn','instaladoEn'])unit[name]=field('newData.isNumber()');
 unit.inventarioOperativo=field('newData.isBoolean()');unit.historial={'.validate':'('+API+') || ('+countSame+')','$event':event};unit.$other={'.validate':false};
 return {'.validate':'('+API+') || ('+countSame+')','$unit':unit};
}
function otValidation(){return '('+API+") || (newData.child('unidadesCustodia').exists() === data.child('unidadesCustodia').exists() && newData.child('custodiaSerialRevision').val() === data.child('custodiaSerialRevision').val())";}
const materialFields=['cod','codigo','productoKey','productoFbKey','ventaItemKey','garantiaLinea','vendida','entregada','instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante','custodiaSerialRevision'];
function materialValidation(){return "(!data.child('custodiaSerialRevision').exists() && !newData.child('custodiaSerialRevision').exists()) || ("+API+') || ('+materialFields.map(name=>"newData.child('"+name+"').val() === data.child('"+name+"').val()").join(' && ')+')';}
function compose(existing,restriction){if(existing===undefined)return restriction;if(typeof existing!=='string'&&typeof existing!=='boolean')throw Error('Validación existente desconocida');return '('+String(existing)+') && ('+restriction+')';}
function wrapped(value){if(!value.startsWith('(')||!value.endsWith(')'))return false;let depth=0,quote='',escaped=false;for(let n=0;n<value.length;n++){const c=value[n];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}if(c==='\''||c==='"'){quote=c;continue;}if(c==='(')depth++;if(c===')'){depth--;if(depth===0&&n!==value.length-1)return false;if(depth<0)return false;}}return !quote&&depth===0;}
function contains(value,restriction){if(value===restriction)return true;const suffix=' && ('+restriction+')';return typeof value==='string'&&value.endsWith(suffix)&&wrapped(value.slice(0,-suffix.length));}
function childName(node,fallback){const children=Object.keys(node).filter(k=>!k.startsWith('.'));if(children.some(k=>!k.startsWith('$'))||children.length>1)throw Error('Descendientes no reconocidos');return children[0]||fallback;}
function build(input,{expectedHash}={}){
 if(hash(input)!==expectedHash||!rulesProtectOTUnitConfirmation(input))throw Error('Se requiere la candidata OT completa y su hash revisado');
 const result=structuredClone(input);let found=0;
 for(const name of ['ordenes_trabajo','ordenesTrabajo']){const node=result.rules.sisventas[name];if(!node)continue;const record=childName(node,'$ot');node[record]??={};const unit=node[record];if(unit.unidadesCustodia)throw Error('La custodia existente requiere revisión');unit['.validate']=compose(unit['.validate'],otValidation());unit.unidadesCustodia=nodeRules();unit.materiales??={};const material=childName(unit.materiales,'$material');unit.materiales[material]??={};unit.materiales[material]['.validate']=compose(unit.materiales[material]['.validate'],materialValidation());found++;}
 if(!found)throw Error('No hay rama OT reconocida');return result;
}
function protects(input,name){const rules=input?.rules||input;if(!rulesProtectOTUnitConfirmation(input)||!['ordenes_trabajo','ordenesTrabajo'].includes(name))return false;try{const node=rules.sisventas[name],record=node[childName(node,'$ot')],material=record.materiales[childName(record.materiales,'$material')];return contains(record['.validate'],otValidation())&&isDeepStrictEqual(record.unidadesCustodia,nodeRules())&&contains(material['.validate'],materialValidation());}catch(_){return false;}}
module.exports={build,protects,nodeRules,otValidation,materialValidation};
