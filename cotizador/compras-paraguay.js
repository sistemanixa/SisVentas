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
module.exports = {esHostComprasParaguay,urlMovilComprasParaguay,mismaOfertaComprasParaguay,datosComprasParaguay,leerPaginaComprasParaguay};
