const test=require('node:test');
const assert=require('node:assert/strict');
const {ofertaComprasParaguay}=require('../proveedor-automatico');
const {convertirPrecioProveedor}=require('../conversion-proveedor');
const {consultarAutomatico}=require('../proveedor-automatico');
const {urlMovilComprasParaguay,mismaOfertaComprasParaguay,datosComprasParaguay,leerPaginaComprasParaguay}=require('../compras-paraguay');
const url='https://www.comprasparaguai.com.br/cable__4894910/';
const offer={'@type':'Offer',url,priceCurrency:'USD',price:'115.0',seller:{name:'Cellshop'},availability:'https://schema.org/InStock'};
const product={name:'Cable Hikvision na loja Cellshop',offers:offer};
test('oferta concreta conserva tienda, USD y conversión del sistema',()=>{const r=ofertaComprasParaguay({url,productos:[product]});assert.equal(r.tiendaOrigen,'Cellshop');assert.equal(r.precioOriginal,115);assert.equal(convertirPrecioProveedor(r,{habilitado:true,arsPorUsd:1545}).precioArs,177675);});
test('rechaza ofertas múltiples, otro enlace, moneda distinta y tienda ausente',()=>{for(const productos of [[product,product],[{...product,offers:{...offer,url:url+'otro'}}],[{...product,offers:{...offer,priceCurrency:'BRL'}}],[{...product,offers:{...offer,seller:null}}],[{...product,offers:{...offer,'@type':'AggregateOffer'}}]])assert.throws(()=>ofertaComprasParaguay({url,productos}));});

const evoUrl='https://www.comprasparaguai.com.br/patinete-eletrico-interbras-x-scooter-cross-evo-10-500-w-preto__5064641/';
const evoTitulo='Patinete Elétrico Interbras X-Scooter Cross Evo 10" 500 W - Preto';
const evoProducto={name:evoTitulo.replace('"','&quot;')+' na loja Nissei no Paraguai',brand:{name:'Interbras'},image:'https://imagenes.example/evo.webp',description:'Autonomia: 40 km',offers:{'@type':'Offer',url:urlMovilComprasParaguay(evoUrl).href,priceCurrency:'USD',price:'597.0',seller:{name:'Nissei'},availability:'https://schema.org/InStock'}};
const evoHtml=(p=evoProducto)=>'<title>'+evoTitulo+'</title><h1>'+evoTitulo.replace('"','&quot;')+'</h1><script type="application/ld+json">'+JSON.stringify({'@type':'Product',...p})+'</script><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>';
test('oferta Evo observada conserva USD 597, Nissei y título sin entidades HTML',()=>{
  const datos=datosComprasParaguay(evoHtml(),evoUrl), r=ofertaComprasParaguay(datos);
  assert.equal(r.precioOriginal,597);assert.equal(r.tiendaOrigen,'Nissei');assert.equal(datos.ficha.nombre,evoTitulo);
  assert.equal(convertirPrecioProveedor(r,{habilitado:true,arsPorUsd:1545}).precioArs,922365);
});
test('equivalencia móvil admite sólo el mismo producto en el dominio oficial',()=>{
  assert.equal(mismaOfertaComprasParaguay(evoUrl,evoProducto.offers.url),true);
  for(const otro of [evoUrl.replace('5064641','5140343'),evoUrl+'?otro=1',evoUrl.replace('www.','evil.'),evoUrl.replace('https:','http:')]) assert.equal(mismaOfertaComprasParaguay(evoUrl,otro),false);
  for(const otro of ['https://comprasparaguai.com.br.evil.com/a','https://usuario:clave@www.comprasparaguai.com.br/a','http://www.comprasparaguai.com.br/a']) assert.throws(()=>urlMovilComprasParaguay(otro));
});
test('rechaza una ficha cuyo título o URL no corresponde al producto',()=>{
  assert.throws(()=>datosComprasParaguay(evoHtml({...evoProducto,name:'Otro patinete'}),evoUrl));
  assert.throws(()=>datosComprasParaguay(evoHtml(),evoUrl.replace('5064641','5140343')));
});
test('consulta pública directa no envía credenciales ni confunde un script de seguridad con bloqueo',async t=>{
  const llamadas=[];
  t.mock.method(globalThis,'fetch',async (url,opts)=>{llamadas.push({url,opts});return new Response(evoHtml(),{status:200});});
  const r=await consultarAutomatico({web:'https://www.comprasparaguai.com.br',usuario:'no_enviar',password:'no_enviar'},evoUrl);
  assert.equal(r.precioOriginal,597);assert.equal(r.tituloProveedor,evoTitulo);assert.equal(r.url,evoUrl);
  assert.equal(llamadas.length,1);assert.equal(llamadas[0].url,evoProducto.offers.url);
  assert.equal(JSON.stringify(llamadas).includes('no_enviar'),false);
});
test('mantiene el bloqueo real y rechaza redirecciones a otra ficha o dominio',async t=>{
  t.mock.method(globalThis,'fetch',async ()=>new Response('<title>Un momento…</title><h1>Verificación de seguridad en curso</h1>',{status:200}));
  await assert.rejects(()=>consultarAutomatico({web:'https://www.comprasparaguai.com.br'},evoUrl),/seguridad/);
  for(const location of ['https://otro.example/a',evoUrl.replace('5064641','5140343')]) {
    t.mock.method(globalThis,'fetch',async ()=>new Response(null,{status:302,headers:{location}}));
    await assert.rejects(()=>leerPaginaComprasParaguay(evoUrl,async()=>{}),/otro producto/);
  }
});
