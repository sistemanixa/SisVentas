'use strict';
// Read-only presentation projection. v3.19.6 guardarPresupuesto/getPpItems
// persist these documentary fields; no catalog, customer lookup or global FX.
const Money=require('./commercial-models/commercial-money');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const invalid=field=>{throw Object.assign(Error('Faltan datos documentales válidos para la presentación.'),{code:'BUDGET_PRESENTATION_INVALID',field});};
const validRate=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
function text(value,field,required=false){if(value===undefined||value===null){if(required)invalid(field);return '';}if(typeof value!=='string'||required&&!value.trim())invalid(field);return value.trim();}
function decimal(value,field){
 if(!(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))||!Number.isFinite(Number(value))||Number(value)<0)invalid(field);
 try{Money.decimal(value);}catch{invalid(field);}return value;
}
function equal(a,b){const x=Money.decimal(a),y=Money.decimal(b);return x.n*y.d===y.n*x.d;}
function number(record,aliases,field){
 const present=aliases.filter(key=>own(record,key)&&record[key]!==undefined&&record[key]!==null);
 if(!present.length)invalid(field);const values=present.map(key=>decimal(record[key],field));
 if(values.some(value=>!equal(value,values[0])))invalid(field);return values[0];
}
function sourceCurrency(record){
 const declared=['moneda','monedaOperativa'].filter(key=>own(record,key)&&record[key]!==undefined&&record[key]!==null&&record[key]!=='').map(key=>{
  if(typeof record[key]!=='string')invalid(key);const currency=record[key].trim().toUpperCase();if(!['ARS','USD'].includes(currency))invalid(key);return currency;
 });
 if(declared.some(value=>value!==declared[0]))invalid('moneda');
 // The active save path omits document currency and persists its ARS amounts.
 // Item monedaOriginal/cotizacionUsada never establish document denomination.
 return declared[0]||'ARS';
}
function itemsOf(record){
 const rows=Array.isArray(record.items)?record.items:object(record.items)?Object.values(record.items):null;
 if(!rows?.length)invalid('items');
 const rowsWithOrder=Array.from(rows,(item,index)=>{
  if(!object(item))invalid('items.'+index);
  let order=null;if(item.orden!==undefined&&item.orden!==null){const n=decimal(item.orden,'items.'+index+'.orden');if(!Number.isSafeInteger(Number(n))||Number(n)<=0)invalid('items.'+index+'.orden');order=Number(n);}
  const quantity=number(item,['qty','cantidad'],'items.'+index+'.qty');if(!(Number(quantity)>0)||Number(quantity)>Number.MAX_SAFE_INTEGER)invalid('items.'+index+'.qty');
  const custom=text(item.descripcionPersonalizada,'items.'+index+'.descripcionPersonalizada');
  const cod=text(item.cod??item.codigo,'items.'+index+'.cod'),desc=text(custom||(item.desc??item.descripcion??item.nombre),'items.'+index+'.desc',true);
  if(item.esManoDeObra!==undefined&&typeof item.esManoDeObra!=='boolean')invalid('items.'+index+'.esManoDeObra');
  return {index,order,cod,desc,qty:Number(quantity),service:item.esManoDeObra===true};
 });
 rowsWithOrder.sort((a,b)=>(a.order??Number.MAX_SAFE_INTEGER)-(b.order??Number.MAX_SAFE_INTEGER)||a.index-b.index);
 return Object.freeze(rowsWithOrder.map(row=>Object.freeze({code:row.cod,description:row.desc,quantity:row.qty,service:row.service})));
}
function build(record,options={}){
 if(!object(record))invalid('presupuesto');if(!object(options))invalid('options');
 const currency=sourceCurrency(record),items=itemsOf(record);
 const document={number:text(record.numero??record.id,'numero'),title:text(record.tituloSolucion,'tituloSolucion'),client:text(record.cliente,'cliente',true),address:text(record.direccionCliente,'direccionCliente'),observations:text(record.observaciones??record.obs,'observaciones')};
 const saved={subtotal:number(record,['subtotal'],'subtotal'),discount:number(record,['descuentoAmt','descuentoMonto','descuentoMontoTotal'],'descuentoAmt'),iva:number(record,['iva'],'iva'),total:number(record,['total'],'total')};
 const percent=number(record,['descuentoPct','descuentoGeneral','descuento'],'descuentoPct');if(Number(percent)>100)invalid('descuentoPct');
 for(const [field,value]of Object.entries(saved)){try{Money.amount(value);}catch{invalid(field);}}
 // Every opening/export carries the explicit visible-rate snapshot. USD
 // documents still validate it for the label but are never divided again.
 if(!validRate(options.exchangeRate))return Object.freeze({schema:1,status:'RATE_REQUIRED',code:'RATE_REQUIRED',requireRate:true,sourceCurrency:currency});
 const label=text(options.exchangeLabel,'exchangeLabel',true),ars={},usd={};
 for(const [field,value]of Object.entries(saved)){try{ars[field]=currency==='ARS'?Money.amount(value):Money.product(value,options.exchangeRate);usd[field]=currency==='USD'?Money.amount(value):Money.quotient(value,options.exchangeRate);}catch{invalid(field);}}
 return Object.freeze({schema:1,status:'READY',requireRate:false,...document,items,sourceCurrency:currency,money:Object.freeze({ars:Object.freeze(ars),usd:Object.freeze(usd),discountPct:Number(percent)}),exchange:Object.freeze({rate:options.exchangeRate,label})});
}
module.exports={build,validRate};
