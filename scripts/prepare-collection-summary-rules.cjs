'use strict';
const crypto=require('node:crypto'),Policy=require('../cotizador/labor-fence-policy');
const {financialContext}=require('./prepare-payment-index-rules.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function prepare(base,{expectedHash}={}){
 if(!/^[a-f0-9]{64}$/.test(expectedHash||'')||hash(base)!==expectedHash)throw Error('Base de reglas no verificada');
 const result=structuredClone(base),sales=result.rules?.sisventas?.ventas,record=sales?.$venta;
 if(!record||!['false',false,undefined].includes(result.rules['.write'])||!['false',false,undefined].includes(result.rules.sisventas['.write']))throw Error('Base de ventas no reconocida');
 const password="auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
 const action="(auth.token.svFinancialAction === 'cobranzas.registrar' || auth.token.svFinancialAction === 'cobranzas.anular')";
 for(const field of ['totalPagado','estadoPago']){
  const node=record[field],old=node?.['.write'];
  if(typeof old!=='string'||!Policy.recognizedRule(old,'sisventas/ventas/$venta/'+field,'.write',text=>text.includes('responsableUid')&&text.includes('svPasswordChangeRequired')))throw Error('Resumen financiero no reconocido');
  const type=field==='totalPagado'?"newData.isNumber() && newData.val() >= 0":"newData.isString() && (newData.val() === 'pendiente_pago' || newData.val() === 'seniado' || newData.val() === 'pago_total')";
  node['.write']='('+old+') || ('+Policy.fence(4,Policy.userActor)+' && '+action+' && ('+financialContext+') && ('+password+') && '+type+')';
 }
 return result;
}
module.exports={prepare,hash};
