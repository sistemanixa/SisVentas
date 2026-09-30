const test=require('node:test');
const assert=require('node:assert/strict');
const {ofertaComprasParaguay}=require('../proveedor-automatico');
const {convertirPrecioProveedor}=require('../conversion-proveedor');
const url='https://www.comprasparaguai.com.br/cable__4894910/';
const offer={'@type':'Offer',url,priceCurrency:'USD',price:'115.0',seller:{name:'Cellshop'},availability:'https://schema.org/InStock'};
const product={name:'Cable Hikvision na loja Cellshop',offers:offer};
test('oferta concreta conserva tienda, USD y conversión del sistema',()=>{const r=ofertaComprasParaguay({url,productos:[product]});assert.equal(r.tiendaOrigen,'Cellshop');assert.equal(r.precioOriginal,115);assert.equal(convertirPrecioProveedor(r,{habilitado:true,arsPorUsd:1545}).precioArs,177675);});
test('rechaza ofertas múltiples, otro enlace, moneda distinta y tienda ausente',()=>{for(const productos of [[product,product],[{...product,offers:{...offer,url:url+'otro'}}],[{...product,offers:{...offer,priceCurrency:'BRL'}}],[{...product,offers:{...offer,seller:null}}],[{...product,offers:{...offer,'@type':'AggregateOffer'}}]])assert.throws(()=>ofertaComprasParaguay({url,productos}));});
