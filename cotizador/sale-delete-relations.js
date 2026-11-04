'use strict';
const Matcher=require('./payment-membership-matcher');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_SALE_DELETE_RELATION_REVIEW'});
const text=value=>String(value||'').trim();
const budgetText=value=>text(value).replace(/^#/,'').toUpperCase();
function resolve(collections,saleKey){
 const sales=Object.entries(collections.ventas||{}).map(([fbKey,sale])=>({...sale,fbKey})),sale=sales.find(row=>row.fbKey===saleKey);
 if(!sale)throw fail('La venta ya no existe.');
 const result={pagos:{},ordenes_trabajo:{},presupuestos:{},reclamos:{}};
 for(const domain of ['pagos','ordenes_trabajo'])for(const [id,row]of Object.entries(collections[domain]||{})){
  if(!Matcher.belongsToSale(row,sale))continue;
  const owners=sales.filter(candidate=>Matcher.belongsToSale(row,candidate));
  if(owners.length!==1)throw fail('Vínculo ambiguo en '+domain+'/'+id+'. Conciliá la referencia antes de eliminar.');
  result[domain][id]=row;
 }
 const budgetKeys=[sale.presupuestoFbKey,sale.pptoFbKey].map(text).filter(Boolean),budgetRefs=[sale.presupuestoId,sale.pptoOrigen,sale.presupuestoOrigen,sale.pptoId].map(budgetText).filter(Boolean),saleRefs=[saleKey,sale.id,sale.numero].map(budgetText).filter(Boolean);
 for(const [id,row]of Object.entries(collections.presupuestos||{})){
  const forward=budgetKeys.includes(id)||[row.id,row.numero,row.nro].map(budgetText).some(ref=>ref&&budgetRefs.includes(ref));
  const reverse=[row.ventaFbKey,row.ventaGeneradaFbKey,row.ventaId,row.ventaGeneradaId].map(budgetText).some(ref=>ref&&saleRefs.includes(ref));
  if(!forward&&!reverse)continue;
  if(reverse){const owners=sales.filter(candidate=>[row.ventaFbKey,row.ventaGeneradaFbKey,row.ventaId,row.ventaGeneradaId].map(budgetText).some(ref=>ref&&[candidate.fbKey,candidate.id,candidate.numero].map(budgetText).includes(ref)));if(owners.length!==1)throw fail('El presupuesto inverso '+id+' apunta a ventas ambiguas.');}
  result.presupuestos[id]=row;
 }
 for(const id of budgetKeys)if(!result.presupuestos[id])throw fail('No se encontró el presupuesto de origen '+id+'.');
 for(const ref of budgetRefs){const matches=Object.values(collections.presupuestos||{}).filter(row=>[row.id,row.numero,row.nro].map(budgetText).includes(ref));if(matches.length!==1)throw fail('Referencia de presupuesto histórico ambigua o ausente: '+ref+'.');}
 for(const [id,row]of Object.entries(collections.reclamos||{})){
  const direct=[row.ventaKey,row.ventaFbKey,row.ventaId].map(text).filter(Boolean).some(ref=>[saleKey,sale.ventaKey,sale.ventaFbKey,sale.id,sale.idOriginal,sale.numero,sale.ventaId].map(text).includes(ref));
  const exact=[sale.reclamoKey,sale.reclamoFbKey,sale.reclamoFBKey,sale.reclamoId].map(text).filter(Boolean).some(ref=>[id,row.id,row.numero].map(text).includes(ref));
  const indirect=Object.entries(result.ordenes_trabajo).some(([otKey,ot])=>[row.otKey,row.otId,row.otNumero].map(text).filter(Boolean).some(ref=>[otKey,ot.id,ot.otId,ot.numero].map(text).includes(ref)));
  if(direct||exact||indirect)throw fail('Repará o cerrá primero el vínculo desde Reclamos.');
 }
 return result;
}
module.exports={resolve};
