(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./commercial-money.v1.js'):root.SVCommercialMoney);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleBudgetTransition=api;})(typeof window==='object'?window:globalThis,function(Money){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 function amount(value,label){if(!Money.isAmount(value))throw Error('Importe inválido: '+label);return Number(value);}
 function equal(left,right,label){if(Money.cents(Money.decimal(left))!==Money.cents(Money.decimal(right)))throw Error('Importes inconsistentes: '+label);}
 function toBudget(record,{sourceFormat}={}){
  if(!['sale','budget'].includes(sourceFormat))throw Error('Indicá el formato de origen.');
  if(sourceFormat==='sale'&&record.ventaOrigenFbKey&&(record.transicionEconomica?.schema===1||Object.hasOwn(record,'descuentoAmt')))throw Error('El presupuesto ya tiene semántica propia. Confirmá el formato de presupuesto.');
  if(typeof record.conIva!=='boolean')throw Error('Falta confirmar si incluye IVA.');
  if(!record.items||typeof record.items!=='object')throw Error('Faltan los ítems.');
  const items=Object.values(record.items);if(!items.length)throw Error('Faltan los ítems.');
  const lines=items.map(item=>{const price=item.punit??item.precio,quantity=item.qty??item.cantidad??1;if(price===undefined||price===null||price===''||!Number.isFinite(Number(price))||Number(price)<0||!Number.isFinite(Number(quantity))||Number(quantity)<=0)throw Error('Precio o cantidad de ítem inválido.');const expected=Money.line(quantity,price,item.disc??0)/100;if(item.sub!==undefined)equal(amount(item.sub,'subtotal de ítem'),expected,'subtotal de ítem');return expected;});
  const subtotal=Money.sum(lines),net=sourceFormat==='sale'?amount(record.subtotal,'neto de venta'):Money.sum([amount(record.subtotal,'subtotal de presupuesto'),-amount(record.descuentoAmt,'descuento de presupuesto')]);
  if(sourceFormat==='budget')equal(subtotal,record.subtotal,'subtotal de presupuesto');
  const discount=Money.sum([subtotal,-net]);
  if(discount<0||discount>subtotal)throw Error('Descuento inválido.');
  if(sourceFormat==='sale'){
   const gross=Money.sum(items.map(item=>Money.product(item.qty??item.cantidad??1,item.punit??item.precio)));
   if(record.descuento!==undefined)equal(record.descuento,Money.sum([gross,-net]),'descuento total de venta');
  }
  const metadata=record.descuentoGeneral??record.descuentoPct??record.porcentajeDescuento??(sourceFormat==='budget'?record.descuento:undefined);
  const percent=metadata===undefined?(subtotal===0?0:discount/subtotal*100):Number(metadata);
  if(!Number.isFinite(percent)||percent<0||percent>100)throw Error('Porcentaje inválido.');
  equal(Money.percentage(subtotal,percent),discount,'descuento general');
  const iva=amount(record.iva,'IVA'),total=amount(record.total,'total');
  equal(iva,record.conIva?Money.percentage(net,21):0,'IVA');equal(total,Money.sum([net,iva]),'total');
  return {...copy(record),subtotal,descuento:percent,descuentoGeneral:percent,descuentoPct:percent,descuentoAmt:discount,iva,total,conIva:record.conIva,transicionEconomica:{schema:1,sourceFormat,subtotalItems:subtotal,neto:net,descuentoGeneralMonto:discount,descuentoGeneralPorcentaje:percent,porcentajeDerivado:metadata===undefined}};
 }
 function validateEconomicTransition(sale,budget){
  const expected=toBudget(sale,{sourceFormat:'sale'}),actual=toBudget(budget,{sourceFormat:'budget'});
  for(const field of ['subtotal','descuentoAmt','iva','total'])equal(actual[field],expected[field],field);
  if(actual.conIva!==expected.conIva||actual.descuentoGeneral!==expected.descuentoGeneral)throw Error('La conversión cambió IVA o porcentaje.');
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
  if(!budget.transicionEconomica||JSON.stringify(stable(budget.transicionEconomica))!==JSON.stringify(stable(expected.transicionEconomica)))throw Error('Los metadatos económicos no coinciden con la venta original.');
  if(JSON.stringify(stable(actual.items))!==JSON.stringify(stable(expected.items)))throw Error('La conversión cambió ítems, identidad o costos originales.');
  return actual;
 }
 function reopenOriginal(sale,original,saleKey,uid,at){
  const numbers=[sale.id,sale.numero].filter(Boolean).map(String);
  const budgetNumbers=[original?.id,original?.numero].filter(Boolean).map(String);
  const links=[original?.ventaFbKey,original?.ventaGeneradaFbKey].filter(Boolean);
  const visibleLinks=[original?.ventaId,original?.ventaGeneradaId].filter(Boolean).map(String);
  if(!original||original.estado!=='convertido'||!links.length||links.some(key=>key!==saleKey)
   ||visibleLinks.some(id=>!numbers.includes(id))||![sale.pptoOrigen,sale.presupuestoId].filter(Boolean).every(id=>budgetNumbers.includes(String(id)))
   ||original.conversionEnCurso||!Number.isSafeInteger(at)||at<=0)throw Error('El vínculo con el presupuesto original cambió o requiere revisión.');
  const reopened={...original,estado:'enviado',ventaOrigenFbKey:saleKey,ventaOrigenId:sale.id||sale.numero};
  for(const key of ['ventaFbKey','ventaGeneradaFbKey','ventaId','ventaGeneradaId'])delete reopened[key];
  const prior=original.audit||[];
  const event={fecha:new Date(at).toISOString(),usuario:uid,accion:'Reabierto desde venta '+reopened.ventaOrigenId,ts:at};
  reopened.audit=Array.isArray(prior)?prior.concat(event):{...prior,['retorno_'+at]:event};
  return reopened;
 }
 return Object.freeze({toBudget,validateEconomicTransition,reopenOriginal});
});
