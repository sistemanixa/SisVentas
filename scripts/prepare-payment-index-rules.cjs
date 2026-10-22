'use strict';
// Offline candidate only. Does not fetch rules, authenticate, or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Policy=require('../cotizador/labor-fence-policy');
const coverage="root.child('sv_labor_indexes/paymentRefs_v1/coverage/ready').val() === true";
const writer="(!("+coverage+") || auth.token.svPaymentIndexVersion === 1)";
const actor="root.child('sv_chat_roles').child(auth.token.actorUid)",cfg="root.child('sv_permisos').child(auth.token.svFinancialActorRole)";
function actionAllowed(group,action,defaults){const value=cfg+".child('acciones').child('"+group+"').child('"+action+"')",module=group==='mantenimiento'?'configuracion':group;return "((!"+cfg+".exists() || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos').child('"+module+"').val() === true)) && ("+value+".val() === true || (!"+value+".exists() && ("+defaults.map(role=>"auth.token.svFinancialActorRole === '"+role+"'").join(' || ')+"))))";}
const financialContext="((auth.token.svFinancialAction == null || auth.token.svFinancialAction === '') || (auth.uid === auth.token.actorUid && "+actor+".child('activo').val() === true && "+actor+".child('rol').val() === auth.token.svFinancialActorRole && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && ((auth.token.svFinancialAction === 'cobranzas.registrar' && "+actionAllowed('cobranzas','registrar',['admin','administrativo'])+") || (auth.token.svFinancialAction === 'cobranzas.anular' && "+actionAllowed('cobranzas','anular',['admin'])+") || (auth.token.svFinancialAction === 'gastos.administrar' && "+actionAllowed('gastos','administrar',['admin','administrativo'])+") || (auth.token.svFinancialAction === 'gastos.eliminar' && auth.token.svFinancialActorRole === 'admin' && "+actionAllowed('gastos','eliminar',['admin'])+") || (auth.token.svFinancialAction === 'mantenimiento.normalizar' && "+actionAllowed('mantenimiento','normalizar',['admin'])+"))))";
const passwordContext="auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
const removalContext="auth.token.svFinancialAction === 'gastos.eliminar' && auth.token.svFinancialActorRole === 'admin' && ("+financialContext+") && ("+passwordContext+")";
function removalGrant(depth,condition){return '('+Policy.fence(depth,Policy.userActor)+' && '+removalContext+' && ('+condition+'))';}
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const closed=value=>value===undefined||value===false||value==='false';
function restrict(input,{expectedHash}={}){
 if(!input?.rules||typeof input.rules!=='object'||expectedHash&&hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const output=structuredClone(input),r=output.rules,s=r.sisventas;
 if(!s||!closed(r['.write'])||!closed(s['.write']))throw Error('Concesión ancestro inesperada');
 const metadata=Policy.metadataRules();
 if(r.sv_labor_indexes?.['.write']!==metadata.sv_labor_indexes['.write']||!s.pagos)throw Error('Se requiere la base coordinada verificada');
 const passwordGuard=original=>typeof original==='string'&&original.length>0;
 function wrap(node,p){
  if(Object.hasOwn(node,'.write')&&!closed(node['.write'])){
   if(!Policy.recognizedRule(node['.write'],p,'.write',passwordGuard))throw Error('Regla de pago no reconocida: '+p);
   node['.write']='('+node['.write']+') && '+writer;
  }
  for(const [key,value]of Object.entries(node))if(!key.startsWith('.')&&value&&typeof value==='object')wrap(value,p+'/'+key);
 }
 wrap(s.pagos,'sisventas/pagos');
 r.sv_labor_indexes['.write']='('+r.sv_labor_indexes['.write']+') && '+writer;
 if(r.sv_labor_receipts?.$op?.['.write']!==metadata.sv_labor_receipts.$op['.write'])throw Error('Regla de recibos no reconocida');
 r.sv_labor_receipts.$op['.write']='('+r.sv_labor_receipts.$op['.write']+') && '+financialContext;
 // A reviewed admin removal can have eliminar=true and administrar=false.
 // Add only record DELETE, marker CREATE and audit CREATE under its signed
 // internal context. Existing domain/employee grants and all reads stay exact.
 function child(node,fallback){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de eliminación inesperado');
  const wildcards=Object.keys(node).filter(key=>key.startsWith('$'));if(wildcards.length>1)throw Error('Comodín de eliminación ambiguo');
  const key=wildcards[0]||fallback;node[key]||={};return {key,node:node[key]};
 }
 function grant(node,p,condition){
  const old=node['.write'];if(!closed(old)&&!Policy.recognizedRule(old,p,'.write',passwordGuard))throw Error('Regla de eliminación no reconocida: '+p);
  const added=removalGrant(p.split('/').length,condition);node['.write']=closed(old)?added:'('+old+') || '+added;
 }
 const expense=child(s.gastos,'$gasto'),expensePath='sisventas/gastos/'+expense.key;
 grant(expense.node,expensePath,"data.exists() && !data.child('bajaAdministrativa').exists() && !newData.exists()");
 if(expense.node.bajaAdministrativa!==undefined&&(typeof expense.node.bajaAdministrativa!=='object'||Array.isArray(expense.node.bajaAdministrativa)))throw Error('Marcador de gasto inesperado');
 expense.node.bajaAdministrativa||={};
 const nextRoot="newData.parent().parent().parent().parent()",audit=nextRoot+".child('sisventas/auditoria_pagos').child(newData.child('auditKey').val())";
 grant(expense.node.bajaAdministrativa,expensePath+'/bajaAdministrativa',"data.parent().exists() && !data.exists() && newData.hasChildren(['uid','usuario','ts','auditKey']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber() && newData.child('auditKey').isString() && !root.child('sisventas/auditoria_pagos').child(newData.child('auditKey').val()).exists() && "+audit+".child('accion').val() === 'baja_administrativa_gasto' && "+audit+".child('gastoFbKey').val() === "+expense.key+" && "+audit+".child('uid').val() === auth.uid && "+audit+".child('usuario').val() === newData.child('usuario').val() && "+audit+".child('ts').val() === newData.child('ts').val()");
 const auditRecord=child(s.auditoria_pagos,'$audit');
 grant(auditRecord.node,'sisventas/auditoria_pagos/'+auditRecord.key,"!data.exists() && newData.hasChildren(['accion','gastoFbKey','gastoAnterior','uid','ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber() && (newData.child('accion').val() === 'baja_administrativa_gasto' || newData.child('accion').val() === 'eliminar_gasto' || newData.child('accion').val() === 'eliminar_adelanto_vinculado')");
 const employee=child(s.ctaemp,'$empleado'),movement=child(employee.node,'$movimiento');
 grant(movement.node,'sisventas/ctaemp/'+employee.key+'/'+movement.key,'data.exists() && !newData.exists()');
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-payment-index-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=restrict(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local de restricción de escritores. Sin aplicar. SHA256 '+hash(result));
}
module.exports={restrict,writer,financialContext,removalContext,hash};
