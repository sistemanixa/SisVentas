'use strict';
const Matcher=require('./payment-membership-matcher');
const OTPolicy=require('./ot-delete-policy');
const domains=Object.freeze(['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo']);
const fail=domain=>Object.assign(Error('La venta tiene actividad en '+domain+'. Resolvé sus vínculos antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_ACTIVITY'});
async function validate(read,sale,otRecords){
 const snapshot={};
 for(const domain of domains){
  const rows=await read('sisventas/'+domain)||{};snapshot[domain]=rows;
  for(const row of Object.values(rows)){
   if(Matcher.belongsToSale(row,sale))throw fail(domain);
   const otRefs=[row.otKey,row.otId,row.otNumero,row.ordenTrabajoId,row.ordenTrabajoFbKey].filter(Boolean).map(String);
   if(Object.entries(otRecords).some(([id,ot])=>otRefs.some(ref=>[id,ot.id,ot.numero,ot.otId].filter(Boolean).map(String).includes(ref))))throw fail(domain);
  }
 }
 for(const ot of Object.values(otRecords)){
  try{OTPolicy.assertNoActivity(ot);}catch(error){if(['SV_OT_DELETE_ACTIVITY','SV_OT_DELETE_SOURCE'].includes(error.code))throw fail('órdenes de trabajo');throw error;}
 }
 for(const record of [sale,...Object.values(otRecords)]){
  if(record.stockExistenteReservado||record.compraConjuntaId||record.compraConfirmacion||record.aplicacionExteriorId||record.aplicacionExteriorPendiente||record.recepcionPendiente||record.ordenesIds&&Object.keys(record.ordenesIds).length||record.listaMaterialesKey||record.listaMaterialesId)throw fail('compras o stock reservado');
  if(['equipos','tickets'].some(domain=>record[domain]&&Object.keys(record[domain]).length))throw fail('equipos o tickets embebidos');
 }
 return snapshot;
}
module.exports={domains,validate};
