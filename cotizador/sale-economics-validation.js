'use strict';
const Money=require('./commercial-models/commercial-money');
const Costs=require('./sale-cost-correction');
const Economics=require('./commercial-models/sale-economics-model.v1.js');
const {isDeepStrictEqual:same}=require('node:util');
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_SALE_ECONOMICS_INVALID'});
const price=item=>item.punit??item.precio??item.precioUnitario;
const numeric=value=>['number','string'].includes(typeof value)&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
const lineTotals=['sub','subtotal','totalItem','importe','total'];
const signature=item=>[item.cod??item.codigo??item.pid??item.productoFbKey,item.qty??item.cantidad??1,price(item),item.disc??item.descuento??0,...lineTotals.map(field=>item[field])];
function validateSale(before,after){
 if(!after)return;
 const items=after.items&&typeof after.items==='object'?Object.entries(after.items):[];
 const header=record=>[record?.descuentoGeneral??record?.descuentoPct??record?.porcentajeDescuento??0,record?.conIva,record?.subtotal,record?.iva,record?.total,record?.descuento];
 const changedHeader=before&&(!same(header(before),header(after))||Object.keys(before.items||{}).some(index=>!Object.hasOwn(after.items||{},index)));
 const changed=items.filter(([index,item])=>!before||changedHeader||!before.items?.[index]||!same(signature(before.items[index]),signature(item)));
 if(before&&!changed.length&&!changedHeader)return;
 if(!items.length)throw fail('La venta necesita ítems con precio y costo.');
 for(const [,item]of changed){const value=price(item),qty=item.qty??item.cantidad??1,disc=item.disc??item.descuento??0;if(!numeric(value)||!numeric(qty)||Number(qty)<=0||!numeric(disc)||Number(disc)<0||Number(disc)>100)throw fail('Falta un precio, cantidad o descuento válido de la venta.');
  Money.line(qty,value,disc);
  const confirmed=Object.fromEntries(Costs.costFields.filter(field=>numeric(item[field])&&Number(item[field])>=0).map(field=>[field,item[field]])),cost=Costs.unit({...confirmed,qty:Number(qty)});
  if(item.comisionCostoHistoricoPendiente===true||!Object.keys(confirmed).length||cost===null||!Number.isFinite(cost)||cost<0)throw fail('Falta el costo confirmado de un ítem de venta.');
 }
 const canonical=Economics.calculate(after,before),equalAmount=(actual,expected)=>Money.isAmount(actual)&&Money.isAmount(expected)&&Money.cents(Money.decimal(actual))===Money.cents(Money.decimal(expected));
 for(const field of ['subtotal','iva','total','descuento'])if(!equalAmount(after[field],canonical[field]))throw fail('El importe '+field+' no coincide con el cálculo canónico de la venta.');
 for(const [index,item]of items){if(!equalAmount(item.sub,canonical.items[index].sub))throw fail('El subtotal del ítem no coincide con el cálculo canónico de la venta.');for(const field of lineTotals)if(Object.hasOwn(item,field)&&!equalAmount(item[field],canonical.items[index].sub))throw fail('El subtotal '+field+' del ítem no coincide con el cálculo canónico de la venta.');}
}
async function validate({patch,raw,get}){
 const roots=new Set();for(const path of Object.keys(patch)){if(path==='sisventas'||path==='sisventas/ventas'){const [before,after]=await Promise.all([raw('sisventas/ventas'),get('sisventas/ventas')]);for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))roots.add('sisventas/ventas/'+key);}else if(path.startsWith('sisventas/ventas/'))roots.add(path.split('/').slice(0,3).join('/'));}
 for(const path of roots)validateSale(await raw(path),await get(path));
}
module.exports={validate,validateSale};
