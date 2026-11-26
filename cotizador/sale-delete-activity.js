'use strict';
const Matcher=require('./payment-membership-matcher');
const OTDelete=require('./ot-delete-policy');
const domains=Object.freeze(['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo']);
const fail=domain=>Object.assign(Error('La venta tiene actividad en '+domain+'. Resolvé sus vínculos antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_ACTIVITY'});
const physicalField=name=>/material|custodia|stock|rendicion|remito|inventar|entreg|instal|devol|devuelt|consum|reserv|recibid|recepci|danad|faltante|enTecnico|enCompra|delivery|physical|fisic|receipt|return|ledger|movement/i.test(name.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
function assertNoPhysicalOT(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('OT con custodia desconocida');
 function visit(record){
  for(const [field,entry]of Object.entries(record)){
   // An explicitly empty materials array has no rows to retire. Any other
   // physical marker, including unknown/false/zero markers, requires review;
   // this cascade neither reconstructs nor reverses inventory history.
   if(['materiales','items'].includes(field)&&Array.isArray(entry)&&entry.length===0&&Object.keys(entry).length===0)continue;
   if(field==='items'||physicalField(field))throw Object.assign(Error('La OT conserva materiales o trazas físicas. Revisá su custodia antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_OT_PHYSICAL'});
   if(entry&&typeof entry==='object')visit(entry);
  }
 }
 visit(value);
 try{OTDelete.assertNoActivity(value);}catch(error){throw Object.assign(error,{statusCode:409});}
}
async function validate(read,sale,otRecords){
 for(const record of Object.values(otRecords))assertNoPhysicalOT(record);
 const snapshot={};
 for(const domain of domains){
  const rows=await read('sisventas/'+domain)||{};snapshot[domain]=rows;
  for(const row of Object.values(rows)){
   if(Matcher.belongsToSale(row,sale))throw fail(domain);
   const otRefs=[row.otKey,row.otId,row.otNumero,row.ordenTrabajoId,row.ordenTrabajoFbKey].filter(Boolean).map(String);
   if(Object.entries(otRecords).some(([id,ot])=>otRefs.some(ref=>[id,ot.id,ot.numero,ot.otId].filter(Boolean).map(String).includes(ref))))throw fail(domain);
  }
 }
 for(const record of [sale,...Object.values(otRecords)]){
  if(record.stockExistenteReservado||record.compraConjuntaId||record.compraConfirmacion||record.aplicacionExteriorId||record.aplicacionExteriorPendiente||record.recepcionPendiente||record.ordenesIds&&Object.keys(record.ordenesIds).length||record.listaMaterialesKey||record.listaMaterialesId)throw fail('compras o stock reservado');
  if(['equipos','tickets'].some(domain=>record[domain]&&Object.keys(record[domain]).length))throw fail('equipos o tickets embebidos');
 }
 return snapshot;
}
module.exports={domains,validate};
