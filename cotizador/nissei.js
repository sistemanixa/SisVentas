'use strict';

// Recursos públicos del verificador que Nissei incluye en su propia página.
// No habilita navegación principal a terceros ni envío de credenciales.
function recursoVerificacionNissei(url, metodo, tipo, principal, origenFrame = '') {
  try {
    const u=new URL(url);
    const lectura=metodo==='GET' && ['script','document','fetch','xhr','image','stylesheet'].includes(tipo);
    const comprobacion=metodo==='POST' && ['xhr','fetch'].includes(tipo) && origenFrame==='https://challenges.cloudflare.com' && u.pathname.startsWith('/cdn-cgi/challenge-platform/');
    const host=u.hostname==='challenges.cloudflare.com' || (u.hostname==='brunhild.challenges.cloudflare.com' && metodo==='GET' && ['fetch','xhr'].includes(tipo) && u.pathname.startsWith('/cdn-cgi/challenge-platform/'));
    return u.protocol==='https:' && host && !u.port && !u.username && !u.password && (lectura||comprobacion) && !principal && /^\/(?:turnstile\/v0\/|cdn-cgi\/challenge-platform\/)/.test(u.pathname);
  } catch (_) {return false;}
}

function ofertaNissei(datos, solicitada) {
  const original = new URL(solicitada), actual = new URL(datos.url);
  const valida = u => u.protocol === 'https:' && /^(www\.)?nissei\.com$/.test(u.hostname) && !u.username && !u.password && !u.port && u.pathname.startsWith('/py/');
  if (!valida(original) || !valida(actual) || original.pathname.split('/').filter(Boolean).pop() !== actual.pathname.split('/').filter(Boolean).pop()) throw Error('Nissei no confirmó la URL del producto');
  if (!datos.titulo?.trim() || !datos.sku?.trim() || datos.moneda !== 'PYG' || datos.precios?.length !== 1) throw Error('Nissei no confirmó una ficha única con precio en guaraníes');
  const p = datos.precios[0], visible = String(p.texto || '').trim().match(/^Gs\.\s*(\d{1,3}(?:\.\d{3})*|\d+)$/);
  const estructurado = Number(p.importe), meta = Number(datos.precioMeta);
  const precio = visible && Number(visible[1].replace(/\./g, ''));
  if (!(precio > 0) || !Number.isFinite(estructurado) || !Number.isFinite(meta) || Math.abs(precio-estructurado) > 0.51 || Math.abs(meta-estructurado) > 0.01) throw Error('El precio visible de Nissei no coincide con su oferta');
  return {ok:true,url:actual.href,precioOriginal:precio,moneda:'PYG',requiereConversion:true,tituloProveedor:datos.titulo.trim(),codigoProveedor:datos.sku.trim(),fuente:'nissei_precio_publico_pyg',selectorPrecio:'.product-info-main [data-price-type="finalPrice"]',disponibilidadProveedor:/^en stock$/i.test(datos.stock?.trim()||'')?'disponible':/^fuera de stock$/i.test(datos.stock?.trim()||'')?'sin_stock':'no_verificado'};
}

async function leerOfertaNissei(page, url) {
  const datos = await page.evaluate(() => ({
    url:location.href,
    titulo:document.querySelector('h1 [itemprop="name"]')?.textContent,
    sku:document.querySelector('.product-info-main [itemprop="sku"]')?.textContent,
    moneda:document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content'),
    precioMeta:document.querySelector('[itemprop="price"]')?.getAttribute('content'),
    precios:Array.from(document.querySelectorAll('.product-info-main [data-price-type="finalPrice"]')).map(n=>({texto:n.innerText,importe:n.getAttribute('data-price-amount')})),
    stock:document.querySelector('.product-info-main .stock')?.textContent
  }));
  return ofertaNissei(datos,url);
}
module.exports={ofertaNissei,leerOfertaNissei,recursoVerificacionNissei};
