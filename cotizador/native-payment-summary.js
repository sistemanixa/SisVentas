'use strict';
const Money=require('./commercial-models/commercial-money');
const cents=value=>Money.cents(Money.decimal(parseFloat(value)||0));
const active=payment=>payment&&!payment.anulado&&String(payment.estado||'').toLowerCase()!=='anulado';
function enrich(id,payment,sale,related,date){
 let balance=null;for(const field of ['saldoRestante','saldo_restante','nuevoSaldo','saldoPosterior'])if(payment[field]!==''&&payment[field]!=null&&Number.isFinite(parseFloat(payment[field]))){balance=Math.max(0,cents(payment[field]));break;}
 if(balance===null&&active(payment)&&sale&&sale.totalCents>0){
  const rows=related.slice().sort((a,b)=>date(b.fecha,b.ts).localeCompare(date(a.fecha,a.ts))||(Number(b.ts)||0)-(Number(a.ts)||0)||String(a.fbKey).localeCompare(String(b.fbKey),'en'));
  const at=rows.findIndex(row=>row.fbKey===id),tied=rows.some(row=>row.fbKey!==id&&active(row)&&date(row.fecha,row.ts)===date(payment.fecha,payment.ts)&&(Number(row.ts)||0)===(Number(payment.ts)||0));
  // Without a recorded balance, identical historical timestamps cannot establish
  // which payment came first. Keep that individual balance unknown, not invented.
  if(at>=0&&!tied){const total=cents(payment.totalVenta)||sale.totalCents,paid=rows.slice(at).filter(active).reduce((sum,row)=>sum+cents(row.monto??row.importe),0);if(!Number.isSafeInteger(paid))throw Error('El historial de cobros supera la precisión permitida.');balance=Math.max(0,total-paid);}
 }
 const stamp=Number(payment.ts)||0;if(!Number.isSafeInteger(stamp)||stamp<0)throw Error('La fecha del cobro requiere revisión.');
 const reverse=String(99999999-Number(date(payment.fecha||payment.fechaPago,payment.ts).replace(/-/g,''))).padStart(8,'0');
 return{nativeSchema:1,clientRecordKey:String(sale?.clientRecordKey||payment.clienteFbKey||payment.clienteKey||''),groupKey:String(payment.grupoPago||''),hasReceipt:!!(payment.comprobanteRef||payment.comprobanteAdjunto||payment.comprobanteCuenta&&(payment.grupoPago||payment.pagoCuentaGrupo)),balanceAfterCents:balance,isUSD:String(payment.moneda||'').toUpperCase()==='USD'||parseFloat(payment.montoUSD)>0,amountUSD:Number(payment.montoUSD||payment.montoOriginal)||0,exchangeRate:Number(payment.tipoCambio)||0,currency:String(payment.moneda||''),manualQuote:payment.cotizacionEditada===true,sort:reverse+'_'+(Number.MAX_SAFE_INTEGER-stamp).toString(16).padStart(16,'0')+Buffer.from(id,'utf8').toString('hex')};
}
module.exports={enrich};
