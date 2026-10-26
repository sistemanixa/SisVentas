'use strict';
// Shared pure policy strings: offline builder and the deployed rules checker.
const SERVICE_UID='sv-labor-service',MAX_LEASE_MS=60000;
const DOMAINS=['empleados','gastos','gastos_adjuntos','ctaemp','hsextra_solicitudes','haberes','aguinaldos','comisiones_generacion','pagos_realizados','auditoria_pagos','gastos_periodicos_emp','ventas','presupuestos','pagos','ordenes','listas_materiales','inventario_operativo'];
const CONFIG=['cargos','maxComisionPct','comisiones','comisionesEmpleados'];
const SERVER_ONLY=['sv_commission_generation','sv_commission_events'];
const service="auth != null && auth.token.svLaborService === true";
const serviceIdentity=service+" && auth.uid === '"+SERVICE_UID+"'";
const guard="root.child('sv_labor_guard')";
const permissionsIdle='(!'+guard+".exists() || ("+guard+".child('expiresAt').isNumber() && "+guard+".child('expiresAt').val() <= now))";
const matching=service+" && "+guard+".child('fence').val() === auth.token.fence && "+guard+".child('opId').val() === auth.token.opId && "+guard+".child('digest').val() === auth.token.digest && "+guard+".child('actorUid').val() === auth.token.actorUid";
const live=matching+" && auth.token.mode === 'commit' && "+guard+".child('expiresAt').isNumber() && "+guard+".child('expiresAt').val() > now";
const ready="root.child('sv_labor_config/schema').val() === 1 && root.child('sv_labor_config/ready').val() === true";
const mode=(...modes)=>'('+modes.map(m=>guard+".child('mode').val() === '"+m+"'").join(' || ')+')';
const actorReset="root.child('sv_access_resets').child("+guard+".child('actorUid').val())";
const actorIdentity="root.child('sv_chat_roles').child("+guard+".child('actorUid').val())";
const commandAccess=actorIdentity+".child('activo').val() === true && "+actorIdentity+".child('rol').isString() && "+actorIdentity+".child('rol').val() === auth.token.actorRole && root.child('sv_permisos').child(auth.token.actorRole).child('indiceRevision').val() === auth.token.actorPermissionRevision && auth.token.actorPasswordChangeRequired !== true && "+actorReset+".child('required').val() !== true && (!"+actorReset+".child('version').exists() || auth.token.actorAccessVersion === "+actorReset+".child('version').val())";
const serverActor="auth.uid === '"+SERVICE_UID+"' && ("+mode('server')+' || ('+mode('command')+' && '+commandAccess+'))';
const userActor=mode('user')+" && auth.uid === "+guard+".child('actorUid').val()";
const bootstrapActor="auth.uid === '"+SERVICE_UID+"' && "+mode('bootstrap');
const anyActor='(('+serverActor+') || ('+userActor+') || ('+bootstrapActor+'))';
function committed(depth){const r='newData'+'.parent()'.repeat(depth),receipt=r+".child('sv_labor_receipts').child(auth.token.opId)";return "!root.child('sv_labor_receipts').child(auth.token.opId).exists() && !"+r+".child('sv_labor_guard').exists() && "+receipt+".child('fence').val() === auth.token.fence && "+receipt+".child('digest').val() === auth.token.digest && "+receipt+".child('actorUid').val() === auth.token.actorUid";}
function fence(depth,actor,needsReady=true){return live+' && ('+actor+') && '+(needsReady?'('+ready+') && ':'')+committed(depth);}
function financialRule(depth,original){return '('+fence(depth,serverActor)+') || ('+fence(depth,userActor)+' && ('+original+'))';}
function childRule(depth,original){return '('+fence(depth,userActor)+') && ('+original+')';}
function metadataRules(){
 const acquisition=serviceIdentity+" && auth.token.mode === 'acquire' && !root.child('sv_labor_receipts').child(auth.token.opId).exists() && (!data.exists() || data.child('expiresAt').val() <= now) && newData.hasChildren(['fence','opId','digest','expiresAt','actorUid','mode']) && newData.child('fence').val() === auth.token.fence && newData.child('opId').val() === auth.token.opId && newData.child('digest').val() === auth.token.digest && newData.child('actorUid').val() === auth.token.actorUid && newData.child('expiresAt').isNumber() && newData.child('expiresAt').val() > now && newData.child('expiresAt').val() <= now + "+MAX_LEASE_MS;
 const abort=matching+" && auth.uid === '"+SERVICE_UID+"' && auth.token.mode === 'abort' && !newData.exists()";
 const keyValidation="newData.isString() && newData.val().length >= 8 && newData.val().length <= 160 && newData.val().matches(/^[A-Za-z0-9_-]+$/)";
 const actorValidation="newData.isString() && newData.val().length > 0 && newData.val().length <= 128";
 return{
  sv_labor_guard:{'.read':serviceIdentity,'.write':'('+acquisition+') || ('+abort+') || ('+fence(1,anyActor,false)+' && !newData.exists())',fence:{'.validate':keyValidation},opId:{'.validate':keyValidation},digest:{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/)"},expiresAt:{'.validate':"newData.isNumber()"},actorUid:{'.validate':actorValidation},mode:{'.validate':"newData.isString() && (newData.val() === 'command' || newData.val() === 'user' || newData.val() === 'server' || newData.val() === 'bootstrap')"},'$other':{'.validate':false}},
  sv_labor_receipts:{'.read':serviceIdentity,'$op':{'.write':fence(2,anyActor,false)+" && $op === auth.token.opId && !data.exists() && newData.hasChildren(['fence','digest','actorUid'])",fence:{'.validate':keyValidation},digest:{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{64}$/)"},actorUid:{'.validate':actorValidation},result:{'.validate':true},confirmedAt:{'.validate':"newData.isNumber()"},'$other':{'.validate':false}}},
  sv_labor_indexes:{'.read':serviceIdentity,'.write':fence(1,anyActor,false)},
  sv_labor_config:{'.read':serviceIdentity,'.write':fence(1,bootstrapActor,false)+' && newData.exists()','.validate':"newData.hasChildren(['schema','ready']) && newData.child('schema').val() === 1 && newData.child('ready').val() === true",schema:{'.validate':"newData.val() === 1"},ready:{'.validate':"newData.val() === true"},'$other':{'.validate':false}}
 };
}
// Exact generated envelopes only. The remaining original permission must itself
// require the existing password guard. No contains/substring exemption.
function recognizedRule(value,path,key,passwordGuardRequired){
 if(typeof value!=='string')return false;
 const metadata=metadataRules();let node=metadata;for(const part of path.split('/'))node=node?.[part];if(node?.[key]===value)return true;
 if(key!=='.write')return false;
 const parts=path.split('/');let start=-1,serverOnly=false;
 if(parts[0]==='sisventas'&&DOMAINS.includes(parts[1]))start=2;
 if(parts[0]==='sisventas'&&parts[1]==='config'&&CONFIG.includes(parts[2]))start=3;
 if(SERVER_ONLY.includes(parts[0])){start=1;serverOnly=true;}
 if(start<0)return false;
 if(parts.length===start){const prefix='('+fence(parts.length,serverActor)+') || ('+fence(parts.length,userActor)+' && (';if(!value.startsWith(prefix)||!value.endsWith('))'))return false;const original=value.slice(prefix.length,-2);return serverOnly?original==='false':passwordGuardRequired(original);}
 if(serverOnly)return false;
 const prefix='('+fence(parts.length,userActor)+') && (';return value.startsWith(prefix)&&value.endsWith(')')&&passwordGuardRequired(value.slice(prefix.length,-1));
}
module.exports={SERVICE_UID,MAX_LEASE_MS,DOMAINS,CONFIG,SERVER_ONLY,permissionsIdle,fence,serverActor,userActor,financialRule,childRule,metadataRules,recognizedRule};
