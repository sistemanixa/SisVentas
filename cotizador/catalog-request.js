'use strict';
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const round=value=>Math.round((value+Number.EPSILON)*100)/100;
function validateItems(items){
 if(!Array.isArray(items)||!items.length||items.length>40)throw fail(400,'Seleccioná entre 1 y 40 productos.');
 const seen=new Set();return items.map(item=>{
  if(!item||typeof item.id!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(item.id)||seen.has(item.id)||!Number.isInteger(item.cantidad)||item.cantidad<1||item.cantidad>999)throw fail(400,'Revisá los productos y sus cantidades.');
  seen.add(item.id);return {id:item.id,cantidad:item.cantidad};
 });
}
function canonicalQuote(items,products,offer,code,now){
 const rows=validateItems(items),key=String(code||'').trim().toUpperCase();
 if(key&&(!/^[A-Z0-9_-]{1,40}$/.test(key)||!offer||offer.codigo!==key||offer.activa!==true||!(now>=offer.inicio&&now<offer.fin)||!Number.isFinite(offer.porcentaje)||offer.porcentaje<1||offer.porcentaje>100||!['pedido','productos'].includes(offer.alcance)))throw fail(400,'La palabra de oferta no está vigente.');
 return rows.map(item=>{
  const p=products[item.id],base=Number(p?.precioUSD);
  if(!p||!Number.isFinite(base)||base<=0||base>1e9)throw fail(400,'Un producto ya no está disponible con precio. Revisá tu lista.');
  const applies=key&&(offer.alcance==='pedido'||Array.isArray(offer.productos)&&offer.productos.includes(item.id));
  return {...item,nombre:String(p.nombre||'').slice(0,250),precioUSD:applies?round(base*(1-offer.porcentaje/100)):base,...(applies?{precioOriginalUSD:base,oferta:key,descuentoPorcentaje:offer.porcentaje}:{})};
 });
}
function contact(body){
 const result={};for(const [key,max] of [['nombre',100],['lista',100],['telefono',40],['email',160]]){
  if(typeof body[key]!=='string'||body[key].length>max)throw fail(400,'Revisá tus datos de contacto.');result[key]=body[key].trim();
 }
 if(!result.nombre||!result.lista||(!result.telefono&&!result.email)||result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw fail(400,'Completá tu nombre, lista y un contacto válido.');
 return result;
}
function createCatalogRequest({db,periodsAPI,now=Date.now}){
 async function persist(id,payload){
  const result=await db.ref('sv_catalogo_solicitudes/'+id).transaction(current=>current?(isDeepStrictEqual(current,payload)?current:undefined):payload);
  if(!result.committed)throw fail(409,'Identificador ya utilizado.');
  return payload;
 }
 async function limit(kind,key,max){
  const bucket=Math.floor(now()/600000),ref=db.ref('sv_server_catalog_limits/'+kind+'/'+hash(key)+'/'+bucket);
  const result=await ref.transaction(value=>Number(value||0)>=max?undefined:Number(value||0)+1);
  if(!result.committed)throw fail(429,'Demasiados intentos. Esperá unos minutos y reintentá.');
 }
 async function quote(body){
  validateItems(body.items);
  const code=String(body.codigo||'').trim().toUpperCase();if(code&&!/^[A-Z0-9_-]{1,40}$/.test(code))throw fail(400,'Palabra de oferta inválida.');
  const products={};await Promise.all(body.items.map(async item=>{
   const [publicSnapshot,masterSnapshot]=await Promise.all([db.ref('sv_catalogo_publico/'+item.id).get(),db.ref('sisventas/productos/'+item.id).get()]);
   const master=masterSnapshot.val();
   if(master&&master.categoria==='COMPRAS PARAGUAY'&&master.catalogoVisible!==false&&master.activo!==false&&!['Inactivo','inactivo'].includes(master.estado)&&master.esManoDeObra!==true)products[item.id]=publicSnapshot.val();
  }));
  const offer=code?(await db.ref('sv_catalogo_ofertas/'+code).get()).val():null;
  return canonicalQuote(body.items,products,offer,code,now());
 }
 async function submit(body){
  if(typeof body.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.id))throw fail(400,'Identificador de solicitud inválido.');
  const data=contact(body),items=validateItems(body.items);
  const signature=hash(JSON.stringify({data,items,code:String(body.codigo||'').trim().toUpperCase(),prices:body.items.map(p=>p.precioUSD)}));
  const receipt=db.ref('sv_server_catalog_receipts/'+body.id),previous=(await receipt.get()).val();
  if(previous){if(previous.signature!==signature)throw fail(409,'Este envío ya fue utilizado.');return persist(body.id,previous.payload);}
  const periods=(await db.ref('sv_catalogo_periodos').get()).val();
  if(!periodsAPI.monthlyWindow(now(),periods?.periodos??periodsAPI.defaultPeriods).abierto)throw fail(403,'La recepción de pedidos está cerrada. Tu lista queda conservada.');
  const quoted=await quote(body);
  if(quoted.some((p,i)=>!Number.isFinite(body.items[i].precioUSD)||Math.abs(p.precioUSD-body.items[i].precioUSD)>0.005))throw fail(409,'Cambió el precio o la oferta. Volvé a revisar los productos antes de enviar.');
  if((await db.ref('sv_catalogo_solicitudes/'+body.id).get()).exists())throw fail(409,'Identificador ya utilizado.');
  await limit('contact',data.email.toLowerCase()||data.telefono,5);
  await limit('requests','all',100);
  const payload={...data,contenido:JSON.stringify(quoted),creadaEn:now()};
  const reserved=await receipt.transaction(current=>current?undefined:{signature,payload});
  if(!reserved.committed){const existing=reserved.snapshot.val();if(existing.signature!==signature)throw fail(409,'Este envío ya fue utilizado.');}
  const saved=reserved.committed?payload:reserved.snapshot.val().payload;
  // Una reserva permite reintentar exactamente el mismo snapshot tras un fallo de red.
  return persist(body.id,saved);
 }
 return {quote,submit,limit};
}
module.exports={canonicalQuote,validateItems,contact,createCatalogRequest};
