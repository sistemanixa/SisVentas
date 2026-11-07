'use strict';
// Stages inventory only. The caller owns authorization, one guarded commit,
// original/summary writes and final CAS over every source returned in `before`.
const {createHash}=require('node:crypto'),Model=require('./ot-lifecycle-model'),State=require('./ot-material-state'),Stock=require('./ot-stock-consumption-model'),Rows=require('./ot-material-rows-model'),Money=require('./commercial-models/commercial-money');
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const fail=(message,code)=>Object.assign(Error(message),{statusCode:409,code,svLaborAttempted:false});
async function stage({ot,otKey,targets,read,query}){
 const materials=structuredClone(targets),transitions=Model.materialChanges(ot,materials,'custody'),inventory=new Map(),before=new Map();
 for(const [index,transition]of transitions.entries()){
  const source=transition.row,target=materials[index];
  for(const field of ['stockRegistro','stockRevision'])if(JSON.stringify(source[field])!==JSON.stringify(target[field]))throw fail('La referencia de stock la confirma el servidor.','SV_OT_STOCK_REFERENCE');
  if(!transition.needsStockReceipt&&!transition.needsProductBinding)continue;
  const productKey=await State.resolveProduct(target,{read,query,source:transition.needsProductBinding?transition.source:null}),product=await read('sisventas/productos/'+productKey);
  if(Model.service(target,product))throw fail('Un servicio no puede registrar consumo físico.','SV_OT_SERVICE_STOCK');
  if(!transition.needsStockReceipt)continue;
  const path='sisventas/inventario_operativo/'+productKey;
  if(!inventory.has(path)){const value=await read(path);if(value==null)throw fail('Falta registrar el inventario operativo de '+String(target.cod||target.codigo||'este producto')+'. No se modificaron materiales ni stock.','SV_OT_INVENTORY_MISSING');before.set(path,structuredClone(value));inventory.set(path,structuredClone(value));}
  const allocation=target.destinoVenta==='nueva'?target.ventaDestinoFbKey:ot.ventaFbKey;if(!key(allocation))throw fail('La venta destino requiere una referencia canónica.','SV_OT_STOCK_DESTINATION');
  const identity=JSON.stringify([otKey,index,productKey,target.destinoVenta||'original',target.ventaDestinoFbKey||'',target.agregadoEn||'']),receipt=source.stockRegistro||createHash('sha256').update(identity).digest('hex'),revision=source.stockRevision??0;
  if(!Number.isSafeInteger(revision)||revision<0)throw fail('La revisión de stock requiere revisión.','SV_OT_STOCK_REFERENCE');
  const stockBefore=m=>m.stockPendiente===true?m.stockBaseInstalada:Number(m.instalada||0);
  if(source.stockPendiente===true&&(source.adicionalOT!==true||typeof source.stockBaseInstalada!=='number'||!Number.isFinite(source.stockBaseInstalada)||source.stockBaseInstalada<0||source.stockBaseInstalada>Number(source.instalada||0)||target.stockPendiente!==false))throw fail('El adicional pendiente requiere una base de stock verificable.','SV_OT_STOCK_REVIEW');
  const legacyTotal=Rows.view(ot).filter(m=>String(m.cod||m.codigo)===String(target.cod||target.codigo)&&String(m.destinoVenta||'original')===String(target.destinoVenta||'original')&&String(m.ventaDestinoFbKey||'')===String(target.ventaDestinoFbKey||'')).reduce((total,m)=>Money.quantitySum([total,stockBefore(m)]),0);
  try{inventory.set(path,Stock.plan(inventory.get(path),{before:stockBefore(source),target:Number(target.instalada||0),revision,receipt,allocation,ot:otKey,additional:target.adicionalOT===true,legacyTotal}));}
  catch(error){throw fail(error.message,/Stock disponible insuficiente/.test(error.message)?'SV_OT_STOCK_INSUFFICIENT':'SV_OT_STOCK_REVIEW');}
  target.stockRegistro=receipt;target.stockRevision=revision+1;
 }
 // The strict existing receipt/ledger verifier sees the staged complete ledger,
 // including every row sharing a product, rather than uncommitted global state.
 for(const transition of Model.materialChanges(ot,materials,'custody')){
  if(!transition.needsStockReceipt&&!transition.needsProductBinding)continue;
  const productKey=await State.resolveProduct(transition.target,{read,query,source:transition.needsProductBinding?transition.source:null});
  await State.verifyReceipt({ot,otKey,transition,productKey,read:path=>inventory.has(path)?inventory.get(path):read(path)});
 }
 return {materials,inventory,before};
}
module.exports={stage};
