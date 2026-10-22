'use strict';
// Offline, expense-removal-only candidate. No provider, authentication or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Policy=require('../cotizador/labor-fence-policy');
const BASELINE_HASH='978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const closed=value=>value===undefined||value===false||value==='false';
const profile="root.child('sv_chat_roles').child(auth.token.actorUid)",cfg="root.child('sv_permisos/admin')",reset="root.child('sv_access_resets').child(auth.uid)";
const removalContext="auth.token.svFinancialAction === 'gastos.eliminar' && auth.uid === auth.token.actorUid && auth.token.svFinancialActorRole === 'admin' && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === 'admin' && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && (!"+cfg+".exists() || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/gastos').val() === true)) && ("+cfg+".child('acciones/gastos/eliminar').val() === true || !"+cfg+".child('acciones/gastos/eliminar').exists()) && auth.token.svPasswordChangeRequired !== true && "+reset+".child('required').val() !== true && (!"+reset+".child('version').exists() || auth.token.svAccessVersion === "+reset+".child('version').val())";
const receiptContext="(auth.token.svFinancialAction !== 'gastos.eliminar' || ("+removalContext+"))";
function grant(depth,condition){return '('+Policy.fence(depth,Policy.userActor)+' && ('+removalContext+') && ('+condition+'))';}
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!input?.rules||typeof input.rules!=='object'||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const output=structuredClone(input),r=output.rules,s=r.sisventas;
 if(!s||!closed(r['.write'])||!closed(s['.write']))throw Error('Concesión ancestro inesperada');
 const originalReceipt=Policy.metadataRules().sv_labor_receipts.$op['.write'];
 if(r.sv_labor_receipts?.$op?.['.write']!==originalReceipt)throw Error('Regla de recibos no reconocida');
 // A parent expense grant may still authorize an admin with administrar=true.
 // Requiring the CURRENT removal permission on this commit's mandatory receipt
 // closes that bypass without altering any other action or fiscal/index writer.
 r.sv_labor_receipts.$op['.write']='('+originalReceipt+') && '+receiptContext;
 const passwordGuard=original=>typeof original==='string'&&original.length>0;
 function child(node,fallback){
  if(!node||typeof node!=='object'||Array.isArray(node))throw Error('Nodo de eliminación inesperado');
  const names=Object.keys(node).filter(key=>key.startsWith('$'));if(names.length>1)throw Error('Comodín de eliminación ambiguo');
  const key=names[0]||fallback;node[key]||={};return {key,node:node[key]};
 }
 function add(node,p,condition){
  const old=node['.write'];if(!closed(old)&&!Policy.recognizedRule(old,p,'.write',passwordGuard))throw Error('Regla de eliminación no reconocida: '+p);
  const added=grant(p.split('/').length,condition);node['.write']=closed(old)?added:'('+old+') || '+added;
 }
 const expense=child(s.gastos,'$gasto'),expensePath='sisventas/gastos/'+expense.key;
 // The signed gateway policy classifies unpaid vs paid across the full CAS
 // snapshots. These rules authorize only the operation shape, not a new ledger.
 add(expense.node,expensePath,"data.exists() && !data.child('bajaAdministrativa').exists() && !newData.exists()");
 if(expense.node.bajaAdministrativa!==undefined&&(typeof expense.node.bajaAdministrativa!=='object'||Array.isArray(expense.node.bajaAdministrativa)))throw Error('Marcador de gasto inesperado');
 expense.node.bajaAdministrativa||={};
 const nextRoot='newData.parent().parent().parent().parent()',audit=nextRoot+".child('sisventas/auditoria_pagos').child(newData.child('auditKey').val())";
 add(expense.node.bajaAdministrativa,expensePath+'/bajaAdministrativa',"data.parent().exists() && !data.exists() && newData.hasChildren(['uid','usuario','ts','auditKey']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber() && newData.child('auditKey').isString() && !root.child('sisventas/auditoria_pagos').child(newData.child('auditKey').val()).exists() && "+audit+".child('accion').val() === 'baja_administrativa_gasto' && "+audit+".child('gastoFbKey').val() === "+expense.key+" && "+audit+".child('uid').val() === auth.uid && "+audit+".child('usuario').val() === newData.child('usuario').val() && "+audit+".child('ts').val() === newData.child('ts').val()");
 const auditRecord=child(s.auditoria_pagos,'$audit');
 add(auditRecord.node,'sisventas/auditoria_pagos/'+auditRecord.key,"!data.exists() && newData.hasChildren(['accion','gastoFbKey','gastoAnterior','uid','ts']) && newData.child('uid').val() === auth.uid && newData.child('ts').isNumber() && (newData.child('accion').val() === 'baja_administrativa_gasto' || newData.child('accion').val() === 'eliminar_gasto' || newData.child('accion').val() === 'eliminar_adelanto_vinculado')");
 const employee=child(s.ctaemp,'$empleado'),movement=child(employee.node,'$movimiento');
 add(movement.node,'sisventas/ctaemp/'+employee.key+'/'+movement.key,'data.exists() && !newData.exists()');
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-expense-removal-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local sólo de baja de Gastos. Sin aplicar. SHA256 '+hash(result));
}
module.exports={build,hash,BASELINE_HASH,removalContext,receiptContext};
