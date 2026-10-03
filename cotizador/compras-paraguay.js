'use strict';
const { normalizarFicha } = require('./ficha-producto');
function esHostComprasParaguay(host) {
  return /^(?:www\.|mobile\.)?comprasparaguai\.com\.br$/.test(host);
}
function urlMovilComprasParaguay(valor) {
  const u = new URL(valor);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !esHostComprasParaguay(u.hostname)) throw new Error('URL pública de Compras Paraguay inválida');
  u.hostname = 'mobile.comprasparaguai.com.br';
  return u;
}
function mismaOfertaComprasParaguay(a, b) {
  try {
    const x = urlMovilComprasParaguay(a), y = urlMovilComprasParaguay(b);
    return x.pathname.replace(/\/+$/, '') === y.pathname.replace(/\/+$/, '') && x.search === y.search;
  } catch (_) { return false; }
}
function textoHtml(valor) {
  return String(valor || '').replace(/<[^>]*>/g, ' ').replace(/&(?:quot|amp|lt|gt|apos|nbsp);|&#(?:\d+|x[0-9a-f]+);/gi, x => {
    const conocidos = {'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&apos;':"'",'&nbsp;':' '};
    if (conocidos[x.toLowerCase()]) return conocidos[x.toLowerCase()];
    const n = x.startsWith('&#x') ? parseInt(x.slice(3),16) : parseInt(x.slice(2),10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/\s+/g, ' ').trim();
}
function datosComprasParaguay(html, url) {
  const productos = [];
  const leer = x => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(leer);
    if ([].concat(x['@type'] || []).includes('Product')) productos.push(x);
    if (x['@graph']) leer(x['@graph']);
    if (x.mainEntity) leer(x.mainEntity);
  };
  for (const m of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { leer(JSON.parse(m[1])); } catch (_) {}
  }
  const titulo = textoHtml((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i) || [])[1]);
  const coincidentes = productos.filter(p => [].concat(p.offers || []).some(o => mismaOfertaComprasParaguay(o.url, url)));
  if (coincidentes.length !== 1 || !titulo) throw new Error('Compras Paraguay no confirmó una ficha única del producto');
  const p = coincidentes[0];
  const nombre = textoHtml(p.name);
  if (nombre !== titulo && !nombre.startsWith(titulo + ' na loja ')) throw new Error('El título de Compras Paraguay no coincide con la oferta');
  return {productos, titulo, url, ficha:normalizarFicha({nombre:titulo,marca:p.brand && p.brand.name,detalle:textoHtml(p.description),imagenUrl:[].concat(p.image || [])[0],fuente:'compras_paraguay_oferta_tienda'}, url)};
}
async function leerPaginaComprasParaguay(url, comprobarDestino) {
  let destino = urlMovilComprasParaguay(url);
  const signal = AbortSignal.timeout(20000);
  for (let i = 0; i < 3; i++) {
    await comprobarDestino(destino.hostname);
    const res = await fetch(destino.href, {redirect:'manual',signal,headers:{Accept:'text/html'}});
    if ([301,302,303,307,308].includes(res.status)) {
      const siguiente = new URL(res.headers.get('location'), destino);
      await res.body?.cancel();
      if (!mismaOfertaComprasParaguay(url, siguiente.href)) throw new Error('Compras Paraguay redirigió a otro producto');
      destino = urlMovilComprasParaguay(siguiente.href);
      continue;
    }
    if (!res.ok) { await res.body?.cancel(); throw new Error('Compras Paraguay no permitió leer la ficha pública (HTTP ' + res.status + ')'); }
    let size = 0;
    const partes = [];
    for await (const parte of res.body) {
      size += parte.length;
      if (size > 2 * 1024 * 1024) throw new Error('La ficha de Compras Paraguay supera el tamaño permitido');
      partes.push(Buffer.from(parte));
    }
    return {html:Buffer.concat(partes).toString('utf8'),url:destino.href};
  }
  throw new Error('Compras Paraguay redirigió demasiadas veces');
}
function esProveedorPublicoComprasParaguay(proveedor) {
  try { urlMovilComprasParaguay(proveedor.web); return true; } catch (_) { return false; }
}
function urlApiComprasParaguay(valor) {
  const url = urlMovilComprasParaguay(valor);
  if (!/^\/[^/]+__\d+\/$/.test(url.pathname) || url.search) throw new Error('Compras Paraguay requiere la URL exacta de una oferta de producto');
  url.hostname = 'api.comprasparaguai.com.br';
  return url;
}
function datosApiComprasParaguay(data, origen) {
  const api = urlApiComprasParaguay(origen);
  if (!data || Array.isArray(data) || typeof data !== 'object' || typeof data.url !== 'string') throw new Error('La API de Compras Paraguay no informó una ficha única');
  const devuelta = new URL(data.url, api);
  if (devuelta.origin !== api.origin || devuelta.pathname !== api.pathname || devuelta.search || devuelta.hash) throw new Error('La API de Compras Paraguay devolvió otro producto');
  const nombre = typeof data.nome === 'string' ? textoHtml(data.nome) : '', tienda = typeof data.loja?.nome === 'string' ? textoHtml(data.loja.nome) : '';
  if (!nombre || !tienda || data.ocultar_preco !== false || typeof data.preco_dolar !== 'number' || !Number.isFinite(data.preco_dolar) || data.preco_dolar <= 0 || typeof data.disponivel !== 'boolean') throw new Error('La API de Compras Paraguay no confirmó tienda, disponibilidad y precio público en USD');
  const detalle = [textoHtml(data.descricao), ...(Array.isArray(data.caracteristicas) ? data.caracteristicas.filter(c => c && typeof c.nome === 'string' && typeof c.valor === 'string').map(c => textoHtml(c.nome)+': '+textoHtml(c.valor)) : [])].filter(Boolean).join('\n');
  return {titulo:nombre,url:origen,productos:[{name:nombre,offers:{'@type':'Offer',url:origen,priceCurrency:'USD',price:data.preco_dolar,seller:{name:tienda},availability:'https://schema.org/'+(data.disponivel ? 'InStock' : 'OutOfStock')}}],ficha:normalizarFicha({nombre,marca:data.marca,detalle,imagenUrl:data.imagem_url && data.imagem_url.large,fuente:'compras_paraguay_api_publica'},origen)};
}
async function leerApiComprasParaguay(origen, comprobarDestino) {
  const destino = urlApiComprasParaguay(origen);
  await comprobarDestino(destino.hostname);
  if (process.env.COMPRAS_PARAGUAY_PROXY_URL) return leerApiConProxy(origen, destino, comprobarDestino);
  const res = await fetch(destino.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  if (!res.ok || !/application\/json/i.test(res.headers.get('content-type') || '')) { await res.body?.cancel(); throw new Error('La API pública de Compras Paraguay no entregó la ficha (HTTP '+res.status+')'); }
  let size=0; const partes=[];
  for await (const parte of res.body) { size += parte.length; if(size > 2*1024*1024) throw new Error('La ficha de Compras Paraguay supera el tamaño permitido'); partes.push(Buffer.from(parte)); }
  return datosApiComprasParaguay(JSON.parse(Buffer.concat(partes).toString('utf8')),origen);
}
function configuracionProxyComprasParaguay(valor) {
  try {
    const url = new URL(valor);
    if (!['http:','https:'].includes(url.protocol) || (url.pathname && url.pathname !== '/') || url.search || url.hash) throw new Error();
    return {host:url.hostname,proxy:{server:url.origin,username:decodeURIComponent(url.username),password:decodeURIComponent(url.password)}};
  } catch (_) { throw new Error('La conexión externa de Compras Paraguay está mal configurada'); }
}
async function leerApiConProxy(origen, destino, comprobarDestino) {
  const config = configuracionProxyComprasParaguay(process.env.COMPRAS_PARAGUAY_PROXY_URL);
  await comprobarDestino(config.host);
  let cliente;
  try {
    cliente = await require('playwright').request.newContext({proxy:config.proxy,ignoreHTTPSErrors:false,timeout:20000,maxRedirects:0});
    const response = await cliente.get(destino.href,{headers:{Accept:'application/json'},maxRedirects:0});
    if (!response.ok() || !/application\/json/i.test(response.headers()['content-type'] || '')) throw new Error();
    const body = await response.body();
    if (body.length > 2*1024*1024) throw new Error();
    return datosApiComprasParaguay(JSON.parse(body.toString('utf8')),origen);
  } catch (_) {
    // Los errores de transporte pueden contener el usuario/clave del proxy.
    throw new Error('No se pudo obtener una ficha válida mediante la conexión externa de Compras Paraguay');
  } finally { if(cliente)await cliente.dispose(); }
}
module.exports = {esHostComprasParaguay,urlMovilComprasParaguay,mismaOfertaComprasParaguay,datosComprasParaguay,leerPaginaComprasParaguay,esProveedorPublicoComprasParaguay,urlApiComprasParaguay,datosApiComprasParaguay,leerApiComprasParaguay,configuracionProxyComprasParaguay};
