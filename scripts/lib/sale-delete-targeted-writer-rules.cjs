'use strict';
// Offline only. Existing source authorities remain independent AND operands.
const Fence=require('../../cotizador/labor-fence-policy');
const ROOT='sv_sale_delete_relations',CONFIG=ROOT+'/config',COVERAGE=ROOT+'/v1/coverage';
const CLAIM='svSaleDeleteRelationsWriterVersion',VERSION=1,PREPARE_ACTION='ventas.eliminar.preparar';
const SERVICE_READ="auth != null && auth.token.svLaborService === true && auth.uid === '"+Fence.SERVICE_UID+"'";
const DOMAINS=Object.freeze(['ventas','pagos','ordenes_trabajo','presupuestos','reclamos','agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo','gastos','ctaemp','comisiones_generacion']);
const SERVER_DOMAINS=Object.freeze(['sv_commission_generation']);
const closed=v=>v===undefined||v===false||v==='false';
const child=(base,path)=>base+".child('"+path+"')";
function prepared(base){const c=child(base,CONFIG),v=child(base,COVERAGE);return [c+".child('schema').val() === 2",c+".child('writerSchema').val() === 1",c+".child('ready').val() === true",c+".child('generation').isString()",v+".child('schema').val() === 2",v+".child('ready').val() === true",v+".child('generation').val() === "+c+".child('generation').val()",v+".child('revision').isNumber()",v+".child('revision').val() >= 1"].map(s=>'('+s+')').join(' && ');}
function maintained(depth){const next='newData'+'.parent()'.repeat(depth),before=child('root',COVERAGE),after=child(next,COVERAGE);return ["auth != null && auth.token."+CLAIM+' === 1',prepared('root'),prepared(next),child(next,CONFIG)+".child('generation').val() === "+child('root',CONFIG)+".child('generation').val()",after+".child('revision').val() === "+before+".child('revision').val() + 1",'('+Fence.fence(depth,Fence.userActor)+' || '+Fence.fence(depth,Fence.serverActor)+')'].map(s=>'('+s+')').join(' && ');}
function sourceGate(depth){const next='newData'+'.parent()'.repeat(depth);return '((!'+child('root',ROOT)+'.exists() && !'+child(next,ROOT)+'.exists()) || ('+maintained(depth)+'))';}
function preparation(){const next='newData.parent()',uid="root.child('sv_chat_roles').child(auth.uid)",permissions="root.child('sv_permisos/admin')",reset="root.child('sv_access_resets').child(auth.uid)";return ["!root.child('"+ROOT+"').exists()",'auth != null && auth.token.'+CLAIM+' === 1',"auth.token.svFinancialAction === '"+PREPARE_ACTION+"'",Fence.fence(1,Fence.userActor),uid+".child('activo').val() === true",uid+".child('rol').val() === 'admin'","auth.token.svFinancialActorRole === 'admin'",permissions+".child('indiceVersion').val() === 2",permissions+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision",permissions+".child('indiceModulos/venta').val() === true",permissions+".child('indiceModulos/configuracion').val() === true",permissions+".child('acciones/mantenimiento/migrar').val() !== false",permissions+".child('acciones/ventas/eliminar').val() !== false",...['venta','configuracion'].flatMap(module=>Array.from({length:64},(_,i)=>permissions+".child('bloqueados/"+i+"').val() !== '"+module+"'")),"auth.token.svPasswordChangeRequired !== true",reset+".child('required').val() !== true",'(!'+reset+".child('version').exists() || "+reset+".child('version').val() === auth.token.svAccessVersion)",prepared(next)].map(s=>'('+s+')').join(' && ');}
function prepare(input){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules))throw Error('Faltan reglas completas.');
 const rules=structuredClone(input),r=rules.rules,s=r.sisventas,changed=[];
 if(!s||!closed(r['.write'])||!closed(s['.write'])||Object.hasOwn(r,ROOT))throw Error('La autoridad existente requiere comparación explícita.');
 for(const[k,v]of Object.entries(r))if(k.startsWith('$')&&JSON.stringify(v).includes('".write"'))throw Error('Comodín raíz no inventariado.');
 function visit(node,path,condition){if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de fuente inválido.');const old=node['.write'];if(!closed(old)){if(old!==true&&typeof old!=='string')throw Error('Grant no revisable.');const gate=sourceGate(path.length);node['.write']='('+String(old)+') && ('+(condition?'!('+condition+') || ('+gate+')':gate)+')';changed.push(path.join('/')+'/.write');}for(const[k,v]of Object.entries(node))if(!k.startsWith('.'))visit(v,[...path,k],condition);}
 for(const domain of DOMAINS){if(!s[domain])throw Error('Falta inventariar '+domain);visit(s[domain],['sisventas',domain]);}
 for(const domain of SERVER_DOMAINS){if(!r[domain])throw Error('Falta inventariar '+domain);visit(r[domain],[domain]);}
 for(const[k,v]of Object.entries(s))if(k.startsWith('$')){if(!/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(k))throw Error('Comodín inválido.');visit(v,['sisventas',k],DOMAINS.map(d=>k+" === '"+d+"'").join(' || '));}
 r[ROOT]={'.read':SERVICE_READ,'.write':'('+preparation()+') || ('+maintained(1)+')'};
 return {rules,manifest:{schema:1,root:ROOT,claim:CLAIM,version:VERSION,prepareAction:PREPARE_ACTION,domains:DOMAINS,serverDomains:SERVER_DOMAINS,changed,sourceGrantsAdded:false,parentGrantsAdded:false,technicalRootsAdded:[ROOT],historyFinancialRootsAdded:false,activated:false}};
}
module.exports={prepare,ROOT,CONFIG,COVERAGE,CLAIM,VERSION,PREPARE_ACTION,DOMAINS,SERVER_DOMAINS,prepared,maintained,sourceGate,preparation};
