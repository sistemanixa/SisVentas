(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./commercial-money.v1.js'):root.SVCommercialMoney);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVSaleEconomicsModel=api;})(typeof window==='object'?window:globalThis,function(Money){
 'use strict';
 function itemPrice(item){const value=item.punit??item.precio??item.precioUnitario;if(!['number','string'].includes(typeof value)||typeof value==='string'&&!value.trim()||!Number.isFinite(Number(value)))throw Error('Revisá el precio de la venta.');return Number(value);}
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 function calculate(record,baseline){
  const merged={...baseline,...record},items=Object.values(merged.items||{});
  if(!items.length)return record;
  const general=Number(merged.descuentoGeneral??merged.descuentoPct??merged.porcentajeDescuento??0);
  if(!Number.isFinite(general)||general<0||general>100)throw Error('Revisá el descuento general de la venta.');
  let gross=0,net=0,netCents=0;
  const normalize=item=>{const qty=Number(item.qty??item.cantidad??1),price=itemPrice(item),disc=Number(item.disc??item.descuento??0);if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||!Number.isFinite(disc)||disc<0||disc>100)throw Error('Revisá los ítems de la venta.');const sub=Money.line(qty,price,disc)/100;gross+=Money.line(qty,price,0)/100;net+=sub;netCents+=Money.line(qty,price,disc);return {...item,sub};};
  const calculatedItems=Array.isArray(merged.items)?merged.items.map(normalize):Object.fromEntries(Object.entries(merged.items).map(([key,item])=>[key,normalize(item)]));
  const subtotal=Money.discount(netCents,general)/100;
  const prior=baseline||record;
  const rate=merged.conIva===false?0:merged.conIva===true?.21:Number(prior.subtotal)>0?Number(prior.iva||0)/Number(prior.subtotal):0;
  if(!Number.isFinite(rate)||rate<0)throw Error('Revisá el IVA de la venta.');
  const iva=rate===.21?Money.vat(Money.cents(Money.decimal(subtotal)))/100:round(subtotal*rate);
  return {...record,items:calculatedItems,subtotal,iva,total:round(subtotal+iva),descuento:round(gross-subtotal)};
 }
 return Object.freeze({calculate,itemPrice});
});
