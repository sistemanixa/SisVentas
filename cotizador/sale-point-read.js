'use strict';
const {createPaymentSnapshot}=require('./payment-snapshot');
const Index=require('./payment-membership-index');
const {SalesReadModel}=require('./commercial-models/sales-read-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const scalar=v=>['string','number','boolean'].includes(typeof v)?v:null;
function fields(value,names){const out={};for(const name of names)if(scalar(value?.[name])!==null)out[name]=value[name];return out;}
const PAYMENT=['fbKey','fecha','ts','monto','medio','estado','anulado','anulada','cancelado','ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey','ventaId','idVenta','venta','nroVenta','numeroVenta','ventaNumero'];
function project(sale){return {...fields(sale,['fbKey','id','numero','fecha','fechaOrden','cliente','estado','estadoPago','estadoInst','anulada','total','subtotal','iva']),items:Object.values(sale.items||{}).map(item=>fields(item,['cod','codigo','desc','descripcion','nombre','qty','cantidad','punit','sub','disc']))};}
// Bounded indexed reads only. Missing coverage is an error, never a zero balance
// or a fallback to the full payment history. No writes, timers or new service.
async function readSalePoint({read,actor,id,authorizeSale,canPayments,revalidate,maxCandidates=2000}){
 Index.recordKey(id);
 if(!actor?.uid||actor.viewing||actor.claims?.uid!==actor.uid||actor.claims?.svPasswordChangeRequired===true)throw fail(403,'Volvé a tu cuenta para consultar esta venta.');
 const raw=await read('sisventas/ventas/'+id);
 await authorizeSale(raw);
 const sale={...raw,fbKey:id};
 let payments=[],summary=null,coverage=null;
 if(canPayments){
  const snapshot=await createPaymentSnapshot({store:{readAsUser:read},maxCandidates})({get:read,getAsUser:read},actor,[id]);
  if(Index.digest(snapshot.sales[id])!==Index.digest(sale))throw fail(409,'La venta cambió. Volvé a consultar.');
  payments=snapshot.bySale[id];coverage=snapshot.coverage;
  // A business number can be duplicated in another historical sale. Without
  // a verified unique sale-alias index, do not turn that ambiguity into a balance.
  if(payments.some(p=>!['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey'].some(k=>String(p[k]||'').trim())))throw fail(503,'Hay cobros antiguos sin vínculo técnico. Revisá la relación antes de calcular el saldo.');
  const valid=p=>!!p&&!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado';
  const global=payments.filter(valid),embedded=Array.isArray(sale.pagos)?sale.pagos.filter(valid):[];
  const canonical=payments.length?global:embedded;
  const total=new SalesReadModel([sale],[]).summaryFor(sale).total;
  const paid=payments.length||canonical.length?canonical.reduce((sum,p)=>sum+(parseFloat(p.monto)||0),0):parseFloat(sale.totalPagado||sale.pagado||sale.montoPagado)||0;
  summary={total,paid,balance:sale.anulada&&!sale.notaCredito?0:Math.max(0,total-Math.min(total,paid))};
  payments=canonical;
  const after=Index.validateCoverage(await read(Index.COVERAGE_PATH));
  if(Index.canonical(after)!==Index.canonical(coverage))throw fail(409,'Los cobros cambiaron. Volvé a consultar.');
 }
 await revalidate();
 if(Index.digest(await read('sisventas/ventas/'+id))!==Index.digest(raw))throw fail(409,'La venta cambió. Volvé a consultar.');
 return {record:project(sale),payments:payments.map(p=>fields(p,PAYMENT)),account:summary?{status:'ready',total:summary.total,paid:summary.paid,balance:summary.balance}:{status:'unavailable'},scope:{type:'sale',key:id,complete:!!summary}};
}
module.exports={readSalePoint,project};
