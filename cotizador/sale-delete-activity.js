'use strict';
const Matcher=require('./payment-membership-matcher');
const OTDelete=require('./ot-delete-policy');
const {pool}=require('./payment-snapshot');
const domains=Object.freeze(['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo']);
const fail=domain=>Object.assign(Error('La venta tiene actividad en '+domain+'. Resolvé sus vínculos antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_ACTIVITY'});
const physicalField=name=>/material|custodia|stock|rendicion|remito|inventar|entreg|instal|devol|devuelt|consum|reserv|recibid|recepci|danad|faltante|enTecnico|enCompra|delivery|physical|fisic|receipt|return|ledger|movement/i.test(name.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
// Narrow persisted form of OTMaterialCustody.normalizeMaterial / MaterialRows.
// Never run those normalizers here: their display defaults cannot prove zero.
const zeroQuantities=['entregada','instalada','devueltaPendiente','devuelta','enTecnico','danada','faltante'];
const plannedFields=new Set(['productoKey','cod','desc','vendida','unidad','cantidadInstalada','adicionalOT','destinoVenta','custodiaActiva','custodiaClasificada',...zeroQuantities]);
function plannedRow(row){
 return row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).every(field=>plannedFields.has(field))&&
  typeof row.productoKey==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(row.productoKey)&&!['__proto__','constructor','prototype'].includes(row.productoKey)&&
  typeof row.cod==='string'&&row.cod.trim()!==''&&typeof row.desc==='string'&&typeof row.vendida==='number'&&Number.isFinite(row.vendida)&&row.vendida>0&&
  zeroQuantities.every(field=>Object.hasOwn(row,field)&&row[field]===0)&&row.custodiaActiva===false&&row.custodiaClasificada===false&&
  (!Object.hasOwn(row,'cantidadInstalada')||row.cantidadInstalada===0)&&(!Object.hasOwn(row,'unidad')||typeof row.unidad==='string')&&
  (!Object.hasOwn(row,'adicionalOT')||row.adicionalOT===false)&&(!Object.hasOwn(row,'destinoVenta')||row.destinoVenta==='original');
}
function plannedRows(value){return Array.isArray(value)&&Object.keys(value).length===value.length&&Object.keys(value).every((key,index)=>key===String(index))&&value.every(plannedRow);}
function plannedChecks(value){
 const phases=['preparacion','instalacion','verificacion'];
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===phases.length&&phases.every(phase=>{
  if(!Object.hasOwn(value,phase)||!Array.isArray(value[phase]))return false;
  const rows=value[phase];return Object.keys(rows).length===rows.length&&Object.keys(rows).every((key,index)=>key===String(index)&&rows[index]===false);
 });
}
function assertNoPhysicalOT(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('OT con custodia desconocida');
 function visit(record,top=false){
  for(const [field,entry]of Object.entries(record)){
   if(top&&field==='checks'){
    if(plannedChecks(entry))continue;
    throw Object.assign(Error('El checklist de la OT no acredita un plan sin actividad. Revisalo antes de eliminar.'),{statusCode:409,code:'SV_SALE_DELETE_OT_PHYSICAL'});
   }
   // Inspect both RAW sources independently, never a merged presentation view.
   if(top&&['materiales','items'].includes(field)&&plannedRows(entry))continue;
   if(top&&['custodiaIniciada','custodiaRendida'].includes(field)&&entry===false&&['materiales','items'].some(source=>value[source]?.length>0&&plannedRows(value[source])))continue;
   if(field==='items'||physicalField(field))throw Object.assign(Error('La OT conserva materiales o trazas físicas. Revisá su custodia antes de eliminar; no se modificó ningún registro.'),{statusCode:409,code:'SV_SALE_DELETE_OT_PHYSICAL'});
   if(entry&&typeof entry==='object')visit(entry);
  }
 }
 visit(value,true);
 try{OTDelete.assertNoActivity(value);}catch(error){throw Object.assign(error,{statusCode:409});}
}
async function validate(read,sale,otRecords){
 for(const record of Object.values(otRecords))assertNoPhysicalOT(record);
 const values=await pool(domains,domain=>read('sisventas/'+domain));
 const snapshot={};
 for(const [index,domain]of domains.entries()){
  const rows=values[index]||{};snapshot[domain]=rows;
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
