'use strict';
// Offline restriction only. Does not fetch rules, authenticate, or deploy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Policy=require('../cotizador/labor-fence-policy');
const coverage="root.child('sv_labor_indexes/paymentRefs_v1/coverage/ready').val() === true";
const writer="(!("+coverage+") || auth.token.svPaymentIndexVersion === 1)";
const actor="root.child('sv_chat_roles').child(auth.token.actorUid)",cfg="root.child('sv_permisos').child(auth.token.svFinancialActorRole)";
function actionAllowed(group,action,defaults){const value=cfg+".child('acciones').child('"+group+"').child('"+action+"')",module=group==='mantenimiento'?'configuracion':group;return "((!"+cfg+".exists() || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos').child('"+module+"').val() === true)) && ("+value+".val() === true || (!"+value+".exists() && ("+defaults.map(role=>"auth.token.svFinancialActorRole === '"+role+"'").join(' || ')+"))))";}
const financialContext="((auth.token.svFinancialAction == null || auth.token.svFinancialAction === '') || (auth.uid === auth.token.actorUid && "+actor+".child('activo').val() === true && "+actor+".child('rol').val() === auth.token.svFinancialActorRole && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && ((auth.token.svFinancialAction === 'cobranzas.registrar' && "+actionAllowed('cobranzas','registrar',['admin','administrativo'])+") || (auth.token.svFinancialAction === 'cobranzas.anular' && "+actionAllowed('cobranzas','anular',['admin'])+") || (auth.token.svFinancialAction === 'gastos.administrar' && "+actionAllowed('gastos','administrar',['admin','administrativo'])+") || (auth.token.svFinancialAction === 'mantenimiento.normalizar' && "+actionAllowed('mantenimiento','normalizar',['admin'])+"))))";
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
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-payment-index-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=restrict(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local de restricción de escritores. Sin aplicar. SHA256 '+hash(result));
}
module.exports={restrict,writer,financialContext,hash};
