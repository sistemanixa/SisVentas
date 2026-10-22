'use strict';
// Offline restriction only. No provider, credentials, network or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Bonus=require('./prepare-bonus-batch-rules.cjs');
const BASELINE_HASH='a4b9a66f6ae6f272683bfcbf9c4cd6245436aa3f6bdc9e96de4aa098722ca4ad';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const closed=value=>value===undefined||value===false||value==='false';
const role='auth.token.svFinancialActorRole';
const profile="root.child('sv_chat_roles').child(auth.token.actorUid)";
const cfg="root.child('sv_permisos').child("+role+")";
const reset="root.child('sv_access_resets').child(auth.uid)";
function context(action,module,roles){
 const allowed='('+roles.map(value=>role+" === '"+value+"'").join(' || ')+')',permission=cfg+".child('acciones/"+action.replace('.','/')+"')";
 return "auth != null && auth.token.svLaborService === true && auth.token.mode === 'commit' && auth.token.svFinancialAction === '"+action+"' && root.child('sv_labor_guard/mode').val() === 'user' && auth.uid === auth.token.actorUid && "+allowed+" && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === "+role+" && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && (!"+cfg+".exists() || ("+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/"+module+"').val() === true)) && ("+permission+".val() === true || (!"+permission+".exists() && "+role+" === 'admin')) && root.child('sv_labor_config/schema').val() === 1 && root.child('sv_labor_config/ready').val() === true && auth.token.svPasswordChangeRequired !== true && "+reset+".child('required').val() !== true && (!"+reset+".child('version').exists() || auth.token.svAccessVersion === "+reset+".child('version').val())";
}
const sacContext=context('empleados.registrarHaberes','empleados',['admin','administrativo','vendedor','tecnico_vendedor','tecnico']);
const migrationContext=context('mantenimiento.migrar','configuracion',['admin']);
const receiptContext="(auth.token.svFinancialAction !== 'empleados.registrarHaberes' || ("+sacContext+")) && (auth.token.svFinancialAction !== 'mantenimiento.migrar' || ("+migrationContext+"))";
const baselineReceipt='('+Bonus.baselineReceipt+') && '+Bonus.receiptContext;
function build(input,{expectedHash=BASELINE_HASH}={}){
 if(!input?.rules||typeof input.rules!=='object'||Array.isArray(input.rules)||!/^[a-f0-9]{64}$/.test(expectedHash)||hash(input)!==expectedHash)throw Error('Base de reglas inesperada');
 const r=input.rules;
 if(!r.sisventas||typeof r.sisventas!=='object'||Array.isArray(r.sisventas)||!closed(r['.write'])||!closed(r.sisventas['.write']))throw Error('Concesión ancestro inesperada');
 if(r.sv_labor_receipts?.$op?.['.write']!==baselineReceipt)throw Error('Regla de recibos no reconocida');
 const output=structuredClone(input);
 // Keep every existing grant and restriction. This mandatory receipt is part
 // of the same atomic PATCH, including when a different ledger grant is true.
 output.rules.sv_labor_receipts.$op['.write']='('+baselineReceipt+') && '+receiptContext;
 return output;
}
if(require.main===module){
 const [source,target,expectedHash]=process.argv.slice(2);
 if(!source||!target||!target.endsWith('.candidate.json')||path.resolve(source)===path.resolve(target)||!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Uso: node scripts/prepare-sac-batch-rules.cjs base-local.json salida.candidate.json hash-base-revisado');
 const result=build(JSON.parse(fs.readFileSync(source,'utf8')),{expectedHash});
 fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');
 console.log('Candidata local: restricción del recibo de SAC y su migración. Sin aplicar. SHA256 '+hash(result));
}
module.exports={build,hash,BASELINE_HASH,sacContext,migrationContext,receiptContext,baselineReceipt};
