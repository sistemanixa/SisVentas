const test=require('node:test');
const assert=require('node:assert/strict');
const {ofertaComprasParaguay}=require('../proveedor-automatico');
const {convertirPrecioProveedor}=require('../conversion-proveedor');
const {consultarAutomatico}=require('../proveedor-automatico');
const {urlMovilComprasParaguay,mismaOfertaComprasParaguay,datosComprasParaguay,leerPaginaComprasParaguay,datosApiComprasParaguay,urlApiComprasParaguay,esProveedorPublicoComprasParaguay}=require('../compras-paraguay');
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
const evoApi=()=>({url:new URL(evoUrl).pathname,nome:evoTitulo,marca:'Interbras',imagem_url:{large:'https://imagenes.example/evo.webp'},descricao:'Autonomia: 40 km',preco_dolar:597,loja:{nome:'Nissei'},disponivel:true,ocultar_preco:false});
test('consulta API pública exacta sin enviar credenciales ni depender de una sesión',async t=>{
  const llamadas=[];
  t.mock.method(globalThis,'fetch',async (url,opts)=>{llamadas.push({url,opts});return new Response(JSON.stringify(evoApi()),{status:200,headers:{'content-type':'application/json'}});});
  const r=await consultarAutomatico({web:'https://www.comprasparaguai.com.br',usuario:'no_enviar',password:'no_enviar'},evoUrl);
  assert.equal(r.precioOriginal,597);assert.equal(r.tituloProveedor,evoTitulo);assert.equal(r.url,evoUrl);
  assert.equal(llamadas.length,1);assert.equal(llamadas[0].url,urlApiComprasParaguay(evoUrl).href);
  assert.equal(JSON.stringify(llamadas).includes('no_enviar'),false);
});
test('mantiene el bloqueo real y rechaza redirecciones a otra ficha o dominio',async t=>{
  t.mock.method(globalThis,'fetch',async ()=>new Response('<title>Un momento…</title><h1>Verificación de seguridad en curso</h1>',{status:403,headers:{'content-type':'text/html'}}));
  await assert.rejects(()=>consultarAutomatico({web:'https://www.comprasparaguai.com.br'},evoUrl),/HTTP 403/);
  for(const location of ['https://otro.example/a',evoUrl.replace('5064641','5140343')]) {
    t.mock.method(globalThis,'fetch',async ()=>new Response(null,{status:302,headers:{location}}));
    await assert.rejects(()=>leerPaginaComprasParaguay(evoUrl,async()=>{}),/otro producto/);
  }
});
test('API ignora productos relacionados y valida URL, tienda, precio visible y disponibilidad',()=>{
  const data={...evoApi(),produtos_relacionados:[{preco_dolar:1,nome:'Otro'}],caracteristicas:[{nome:'Roda',valor:'10 pulgadas'}]};
  const result=datosApiComprasParaguay(data,evoUrl);assert.equal(ofertaComprasParaguay(result).precioOriginal,597);assert.match(result.ficha.detalle,/Roda: 10 pulgadas/);
  for(const bad of [{...data,url:'/otro__5140343/'},{...data,url:'https://otro.example/'+new URL(evoUrl).pathname},{...data,ocultar_preco:true},{...data,preco_dolar:0},{...data,preco_dolar:'597'},{...data,loja:{}},{...data,disponivel:undefined},[data,data]])assert.throws(()=>datosApiComprasParaguay(bad,evoUrl));
});
test('API sólo acepta HTTPS, dominio oficial y una oferta exacta sin destinos ajenos',()=>{
  assert.equal(esProveedorPublicoComprasParaguay({web:'https://www.comprasparaguai.com.br'}),true);
  for(const web of ['https://www.comprasparaguai.com.br.evil.com','https://u:pass@www.comprasparaguai.com.br','https://otro.example','http://www.comprasparaguai.com.br'])assert.equal(esProveedorPublicoComprasParaguay({web}),false);
  for(const bad of ['https://www.comprasparaguai.com.br/',evoUrl+'?otro=1',evoUrl.replace('__5064641','_5064641')])assert.throws(()=>urlApiComprasParaguay(bad));
});
test('conexión externa valida la misma oferta, no redirige y cierra el contexto',async t=>{
  const {request}=require('playwright');const previous=process.env.COMPRAS_PARAGUAY_PROXY_URL;
  process.env.COMPRAS_PARAGUAY_PROXY_URL='https://usuario-prueba:clave-prueba@proxy.example:8443';
  let options,requestOptions,closed=false;
  t.mock.method(request,'newContext',async o=>{options=o;return {get:async (url,o)=>{assert.equal(url,urlApiComprasParaguay(evoUrl).href);requestOptions=o;return {ok:()=>true,headers:()=>({'content-type':'application/json'}),body:async()=>Buffer.from(JSON.stringify(evoApi()))}},dispose:async()=>{closed=true}}});
  try {
    const {leerApiComprasParaguay}=require('../compras-paraguay');const checked=[];
    const result=await leerApiComprasParaguay(evoUrl,async h=>checked.push(h));
    assert.equal(ofertaComprasParaguay(result).precioOriginal,597);assert.deepEqual(checked,['api.comprasparaguai.com.br','proxy.example']);
    assert.equal(options.ignoreHTTPSErrors,false);assert.equal(options.proxy.server,'https://proxy.example:8443');assert.equal(requestOptions.maxRedirects,0);assert.equal(closed,true);
  } finally { if(previous===undefined)delete process.env.COMPRAS_PARAGUAY_PROXY_URL;else process.env.COMPRAS_PARAGUAY_PROXY_URL=previous; }
});
test('errores de conexión externa no revelan credenciales',async t=>{
  const {request}=require('playwright');const previous=process.env.COMPRAS_PARAGUAY_PROXY_URL;
  process.env.COMPRAS_PARAGUAY_PROXY_URL='https://usuario-prueba:clave-prueba@proxy.example';
  t.mock.method(request,'newContext',async()=>{throw Error('falló usuario-prueba:clave-prueba')});
  try {const {leerApiComprasParaguay}=require('../compras-paraguay');await assert.rejects(()=>leerApiComprasParaguay(evoUrl,async()=>{}),e=>/conexión externa/.test(e.message)&&!e.message.includes('clave-prueba'))}finally{if(previous===undefined)delete process.env.COMPRAS_PARAGUAY_PROXY_URL;else process.env.COMPRAS_PARAGUAY_PROXY_URL=previous;}
});
