'use strict';
const crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const markerField='bajaAdministrativa';
// Every 409 below is a confirmed pre-commit rejection, never an unknown HTTP
// acknowledgement. Reuse the transport's existing, bounded CAS recovery path.
const fail=(statusCode,message,code=statusCode===409?'SV_CAS_CONFLICT':'SV_EXPENSE_REMOVAL_INVALID')=>Object.assign(Error(message),{statusCode,code});
const own=(value,key)=>Object.hasOwn(value||{},key);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const positive=value=>(parseFloat(value)||0)>0;
const compare=(a,b)=>a<b?-1:a>b?1:0;
function recordKey(key){if(typeof key!=='string'||!key||Buffer.byteLength(key)>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(key))throw fail(400,'Referencia del gasto inválida');return key;}
function canonical(value){if(value==null)return 'null';if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(typeof value==='object')return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
const digest=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');
function sameKeys(value,keys){return plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>own(value,key));}
function employeeKeys(expense){
 if(!plain(expense))throw fail(400,'Gasto inválido');
 const legacy=String(expense.legacyKey||'').split('/');
 return [...new Set([expense.empleadoId,expense.empleadoFbKey,legacy[0]==='ctaemp'?legacy[1]:''].filter(Boolean).map(value=>recordKey(String(value))))].sort(compare);
}
function linkedMovements(values,accounts,expense,key){
 if(!plain(values)||!Array.isArray(accounts)||!plain(expense))throw fail(400,'Vínculos del gasto inválidos');recordKey(key);
 const refs=[];
 for(const empKey of [...new Set(accounts.map(recordKey))].sort(compare)){
  const path='sisventas/ctaemp/'+empKey;if(!own(values,path))throw fail(400,'Falta comprobar la cuenta vinculada');
  const account=values[path];if(account!==null&&!plain(account)&&!Array.isArray(account))throw fail(409,'La cuenta del empleado requiere revisión');
  for(const [movKey,mov]of Object.entries(account||{})){
   recordKey(movKey);if(mov===null&&Array.isArray(account))continue;if(!plain(mov))throw fail(409,'La cuenta del empleado requiere revisión');
   if(mov.gastoFbKey===key||mov.gastoKey===key||expense.legacyKey==='ctaemp/'+empKey+'/'+movKey||expense.movimientoCtaKey===movKey)refs.push({empKey,key:movKey,mov});
  }
 }
 return refs.sort((a,b)=>compare(a.empKey+'/'+a.key,b.empKey+'/'+b.key));
}
function hasEconomicHistory(record){
 if(!plain(record))return false;
 if(['montoPagado','saldoPagadoLegacy','montoCompensado','adelantoCompensado'].some(field=>positive(record[field])))return true;
 if(Object.values(record.compensaciones||{}).some(positive)||Object.values(record.adelantosAplicados||{}).some(value=>positive(plain(value)?value.monto:value)))return true;
 const payments=Object.values(record.pagos||{});
 if(payments.some(payment=>payment&&payment.anulado!==true&&String(payment.estado||'').toLowerCase()!=='anulado'&&positive(payment.monto)))return true;
 // A paid legacy state without a detailed ledger is still evidence of money.
 // Detailed, wholly voided payments with cleared summaries retain the former
 // physical-removal contract; removal never voids a payment itself.
 return !payments.length&&['pagado','pagada','pagado_parcial'].includes(String(record.estado||'').toLowerCase());
}
function describe(body){
 if(!plain(body)||body.kind!=='atomic'||body.purpose!=='expense-removal'||!plain(body.expectedHashes)||body.expectedHash!==undefined)throw fail(400,'La eliminación requiere una comparación atómica específica');
 const expected=Object.keys(body.expectedHashes);if(expected.length<2||expected.length>128)throw fail(400,'Comparación del gasto inválida');
 let key,path,auditKey,auditPath;const accounts=[];
 for(const candidate of expected){
  if(!/^[a-f0-9]{64}$/.test(body.expectedHashes[candidate]))throw fail(400,'Comparación del gasto inválida');
  const parts=candidate.split('/');if(parts.length!==3||parts[0]!=='sisventas')throw fail(400,'La eliminación sólo compara registros individuales');recordKey(parts[2]);
  if(parts[1]==='gastos'&&!path){key=parts[2];path=candidate;}
  else if(parts[1]==='auditoria_pagos'&&!auditPath){auditKey=parts[2];auditPath=candidate;}
  else if(parts[1]==='ctaemp')accounts.push(parts[2]);
  else throw fail(400,'La eliminación excede sus registros permitidos');
 }
 if(!path||!auditPath)throw fail(400,'Falta comprobar el gasto y su auditoría');
 accounts.sort(compare);return {key,path,auditKey,auditPath,accounts,paths:[path,...accounts.map(emp=>'sisventas/ctaemp/'+emp),auditPath]};
}
function validateRemoval({actor,body,patch,values}={}){
 if(actor?.mode!=='user'||actor.role!=='admin'||actor.financialAction!=='gastos.eliminar'||typeof actor.uid!=='string'||!actor.uid)throw fail(403,'Sólo el administrador puede eliminar gastos','SV_EXPENSE_REMOVAL_FORBIDDEN');
 const description=describe(body),{key,path,auditKey,auditPath,accounts,paths}=description;
 if(!plain(values)||!plain(patch))throw fail(400,'Plan de eliminación inválido');
 for(const source of paths){if(!own(values,source))throw fail(400,'Falta comprobar un registro de la eliminación');if(digest(values[source])!==body.expectedHashes[source])throw fail(409,'El gasto o sus vínculos cambiaron. Actualizá la pantalla.','SV_CAS_CONFLICT');}
 const actual=values[path];if(!plain(actual))throw fail(409,'El gasto ya no está disponible','SV_CAS_CONFLICT');
 if(own(actual,markerField))throw fail(409,'El gasto ya fue retirado de la lista','SV_CAS_CONFLICT');
 if(values[auditPath]!==null)throw fail(409,'La referencia de auditoría ya está ocupada','SV_CAS_CONFLICT');
 if(!isDeepStrictEqual(employeeKeys(actual),accounts))throw fail(409,'Los empleados vinculados cambiaron. Actualizá la pantalla.','SV_CAS_CONFLICT');
 const refs=linkedMovements(values,accounts,actual,key),logical=hasEconomicHistory(actual)||refs.some(ref=>hasEconomicHistory(ref.mov));
 const audit=patch[auditPath];
 if(!sameKeys(audit,['accion','gastoFbKey','gastoAnterior','movimientosAnteriores','uid','usuario','ts'])||audit.uid!==actor.uid||typeof audit.usuario!=='string'||audit.usuario.length>1000||!Number.isSafeInteger(audit.ts)||audit.ts<0)throw fail(400,'La auditoría de eliminación es inválida');
 const isAdvance=actual.tipoPagable==='adelanto'||/^adelanto_personal/.test(actual.origen||'');
 const expectedAudit={accion:logical?'baja_administrativa_gasto':isAdvance?'eliminar_adelanto_vinculado':'eliminar_gasto',gastoFbKey:key,gastoAnterior:actual,movimientosAnteriores:refs,uid:actor.uid,usuario:audit.usuario,ts:audit.ts};
 if(!isDeepStrictEqual(audit,expectedAudit))throw fail(400,'La auditoría no corresponde al gasto y sus movimientos');
 const expectedPatch=Object.create(null);
 if(logical)expectedPatch[path+'/'+markerField]={uid:actor.uid,usuario:audit.usuario,ts:audit.ts,auditKey};
 else{
  const type=String(actual.tipoPagable||actual.origen||'').toLowerCase();
  if((isAdvance||type==='bonificacion')&&!refs.length)throw fail(409,'El gasto no tiene un vínculo válido con la cuenta del empleado','SV_CAS_CONFLICT');
  expectedPatch[path]=null;for(const ref of refs)expectedPatch['sisventas/ctaemp/'+ref.empKey+'/'+ref.key]=null;
 }
 expectedPatch[auditPath]=expectedAudit;
 if(!sameKeys(patch,Object.keys(expectedPatch))||Object.entries(expectedPatch).some(([target,value])=>!isDeepStrictEqual(patch[target],value)))throw fail(400,'La eliminación modifica datos fuera de su alcance');
 return {mode:logical?'logical':'physical',key,refs};
}
module.exports={markerField,employeeKeys,linkedMovements,hasEconomicHistory,describe,validateRemoval};
