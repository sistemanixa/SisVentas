'use strict';
// Offline restriction only. No provider, credentials, network or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Policy=require('../cotizador/labor-fence-policy');
const Removal=require('./prepare-expense-removal-rules.cjs');
const BASELINE_HASH='2cf231b801aa720eee482b3c1d3203b37b5ded6c2b99ae0d6009433e04e24aea';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const closed=value=>value===undefined||value===false||value==='false';
const role='auth.token.svFinancialActorRole';
const profile="root.child('sv_chat_roles').child(auth.token.actorUid)";
const cfg="root.child('sv_permisos').child("+role+")";
const reset="root.child('sv_access_resets').child(auth.uid)";
const allowedRole='('+['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].map(value=>role+" === '"+value+"'").join(' || ')+')';
const bonusContext="auth != null && auth.token.svLaborService === true && auth.token.mode === 'commit' && auth.token.svFinancialAction === 'empleados.bonificar' && root.child('sv_labor_guard/mode').val() === 'user' && auth.uid === auth.token.actorUid && "+allowedRole+" && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === "+role+" && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && (!"+cfg+".exists() || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/empleados').val() === true)) && ("+cfg+".child('acciones/empleados/bonificar').val() === true || (!"+cfg+".child('acciones/empleados/bonificar').exists() && "+role+" === 'admin')) && root.child('sv_labor_config/schema').val() === 1 && root.child('sv_labor_config/ready').val() === true && auth.token.svPasswordChangeRequired !== true && "+reset+".child('required').val() !== true && (!"+reset+".child('version').exists() || auth.token.svAccessVersion === "+reset+".child('version').val())";
const receiptContext="(auth.token.svFinancialAction !== 'empleados.bonificar' || ("+bonusContext+"))";
const baselineReceipt='('+Policy.metadataRules().sv_labor_receipts.$op['.write']+') && '+Removal.receiptContext;
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const r=input.rules;
 if(!r.sisventas||typeof r.sisventas!=='object'||Array.isArray(r.sisventas)||!closed(r['.write'])||!closed(r.sisventas['.write']))throw Error('Concesión ancestro inesperada');
 if(r.sv_labor_receipts?.$op?.['.write']!==baselineReceipt)throw Error('Regla de recibos no reconocida');
 const output=structuredClone(input);
 // A parent ledger grant can remain true through registrarHaberes or another
 // action. A forbidden mandatory receipt rejects the entire atomic PATCH.
 // This adds no grant and retains the previous expense-removal condition.
 output.rules.sv_labor_receipts.$op['.write']='('+baselineReceipt+') && '+receiptContext;
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-bonus-batch-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local: restricción del recibo de bonificaciones. Sin aplicar. SHA256 '+hash(result));
}
module.exports={build,hash,BASELINE_HASH,bonusContext,receiptContext,baselineReceipt};
