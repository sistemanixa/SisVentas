'use strict';
const dns = require('node:dns/promises');
const net = require('node:net');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { extraerFichaPagina } = require('./ficha-producto');
function firmaAcceso(p) { return crypto.createHash('sha256').update(JSON.stringify([p.web || '',p.usuario || '',p.password || '',p.condicionComercial || null])).digest('hex'); }
function aplicarCondicionComercial(resultado, condicion) {
  if (resultado.requiereConversion) return resultado;
  if (!resultado.ok || !condicion || condicion.activa !== true) return resultado;
  const descuento = Number(condicion.descuentoPorcentaje);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento >= 100) throw new Error('El descuento del proveedor debe estar entre 0 y menos de 100%');
  const precio = Number(resultado.precioArs);
  if (!(precio > 0)) throw new Error('Falta el precio publicado para aplicar la condición comercial');
  return Object.assign({},resultado,{
    precioPublicadoArs:precio,
    descuentoProveedorPorcentaje:descuento,
    precioArs:Math.round((precio * (1 - descuento / 100) + Number.EPSILON) * 100) / 100,
    sinIva:resultado.sinIva,
    condicionComercialAplicada:true
  });
}
function urlProveedor(valor, web) {
  const u = new URL(valor), base = new URL(web);
  const host = h => h.toLowerCase().replace(/^www\./,'');
  if (u.protocol !== 'https:' || base.protocol !== 'https:' || u.username || u.password || u.port || net.isIP(u.hostname) || !u.hostname.includes('.') || host(u.hostname) !== host(base.hostname)) throw new Error('La URL debe ser HTTPS y pertenecer a la web registrada del proveedor');
  return u;
}
async function destinoPublico(host) {
  const direcciones = await dns.lookup(host,{all:true});
  if (!direcciones.length || direcciones.some(x=>!direccionPublica(x.address))) throw new Error('La web no resolvió a un destino público admitido');
}
function direccionPublica(address) {
  if (net.isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0|10|20):/i.test(address) && !/^2002:/i.test(address);
  return net.isIP(address) === 4 && !/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01])|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])|22[4-9]|23\d|24\d|25\d)\./.test(address);
}
function precioFlytec(texto) {
  const match=String(texto || '').trim().match(/^U\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/);
  if(!match) throw new Error('Flytec no informó un precio inequívoco en USD');
  const precio=Number(match[1].replace(/\./g,'')+'.'+match[2]);
  if(!(precio>0)) throw new Error('Precio de Flytec inválido');
  return precio;
}
function validarOferta(datos) {
  const productos = datos.productos.filter(p=>p && p.name && (p.name.trim().toLowerCase() === datos.titulo.trim().toLowerCase() || p.url === datos.url));
  if (productos.length !== 1) throw new Error('No se pudo identificar una única ficha de producto. Requiere revisión');
  const p = productos[0], ofertas = [].concat(p.offers || []);
  if (ofertas.length !== 1 || ofertas[0]['@type'] === 'AggregateOffer') throw new Error('El producto no informa una única oferta verificable');
  const o = ofertas[0], precio = Number(o.price);
  if (!(precio > 0) || !Number.isFinite(precio) || o.priceCurrency !== 'ARS') throw new Error('No se pudo confirmar un precio único en pesos argentinos');
  const texto = datos.texto;
  let sin = /(?:precio|importe)[^\n]{0,35}(?:sin IVA|\+\s*IVA)|IVA\s+no\s+incluido/i.test(texto);
  let con = /(?:precio|importe)[^\n]{0,35}(?:IVA incluido|con IVA)|incluye IVA/i.test(texto);
  // Algunas tiendas presentan precio final + precio sin impuestos. Exigir
  // ambos juntos, después del título, y concordancia con la oferta principal;
  // así no se confunde el carrito, una cuota ni un producto recomendado.
  const inicio = texto.indexOf(datos.titulo.trim());
  const bloque = inicio >= 0 ? texto.slice(inicio + datos.titulo.trim().length, inicio + datos.titulo.trim().length + 500) : '';
  const par = bloque.match(/^\s*\$\s*([\d.,]+)\s*\n\s*Precio sin impuestos\s*:?\s*\$\s*([\d.,]+)/m);
  const importeArs = valor => Number(valor.replace(/\./g,'').replace(',','.'));
  if (par) {
    const final = importeArs(par[1]), neto = importeArs(par[2]);
    if (Math.abs(final - precio) < 0.01 && neto > 0 && neto < final) con = true;
  }
  if (sin && con) throw new Error('La página informa condiciones de IVA contradictorias. Requiere revisión');
  const ivaOrigen = !sin && !con ? 'incluido_por_defecto' : 'informado_por_proveedor';
  const tasa = texto.match(/IVA\s*[:(]?\s*(21|10[.,]5)\s*%/i);
  if (sin && !tasa) throw new Error('El precio no incluye IVA, pero no informa una alícuota verificable');
  return {precioArs:precio,moneda:'ARS',sinIva:sin,ivaOrigen,ivaAlicuota:tasa?Number(tasa[1].replace(',','.')):null,tituloProveedor:p.name,selectorPrecio:'Product.offers.price',disponibilidadProveedor:/\/InStock$/.test(o.availability || '')?'disponible':'no_verificado'};
}
async function consultarAutomatico(proveedor, url) {
  if (!String(proveedor.web || '').trim()) throw new Error('Falta cargar la web del proveedor');
  if (url && !/^https:\/\//i.test(url)) throw new Error('La URL de prueba debe ser un enlace HTTPS completo del producto');
  const web = /^https?:/.test(proveedor.web || '') ? proveedor.web : 'https://' + proveedor.web;
  const destino = urlProveedor(url || web,web);
  const compraGamer = destino.hostname.replace(/^www\./,'') === 'compragamer.com';
  const flytec = destino.hostname.replace(/^www\./,'') === 'flytec.com.py';
  await destinoPublico(destino.hostname);
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({serviceWorkers:'block'});
  const timer=setTimeout(()=>browser.close().catch(()=>{}),55000);
  try {
    const comprobados=new Set();
    await context.route('**/*',async route=>{
      try {
        const solicitada = new URL(route.request().url());
        const apiCompraGamer = compraGamer && !route.request().isNavigationRequest() && route.request().method() === 'GET' && solicitada.protocol === 'https:' && !solicitada.port && !solicitada.username && !solicitada.password && solicitada.hostname.endsWith('.compragamer.com');
        const u=apiCompraGamer ? solicitada : urlProveedor(route.request().url(),web);
        if (!comprobados.has(u.hostname)) { await destinoPublico(u.hostname); comprobados.add(u.hostname); }
        await route.continue();
      } catch (_) { await route.abort(); }
    });
    const page=await context.newPage();
    await page.goto(web,{waitUntil:'domcontentloaded',timeout:25000});
    const usuario=proveedor.usuario || '', password=proveedor.password || '';
    // CompraGamer publica ambos precios sin sesión. La preferencia de pago
    // selecciona ese precio público y no necesita entrar a la cuenta.
    if ((usuario || password) && !compraGamer) {
      if (!usuario || !password) throw new Error('Completá usuario y contraseña en Proveedores');
      if (!await page.locator('input[type="password"]:visible').count()) {
        const links=await page.locator('a').evaluateAll(nodes=>nodes.filter(n=>/^(ingresar|iniciar sesión|mi cuenta|acceder)$/i.test(n.textContent.trim())).map(n=>n.href));
        if (!links.length) throw new Error('No se encontró un acceso inequívoco. Requiere revisión del inicio de sesión');
        await page.goto(urlProveedor(links[0],web).href,{waitUntil:'domcontentloaded',timeout:15000});
      }
      const form=page.locator('form').filter({has:page.locator('input[type="password"]:visible')});
      if (await form.count() !== 1) throw new Error('No se pudo identificar el formulario de acceso');
      urlProveedor(await form.getAttribute('action') ? new URL(await form.getAttribute('action'),page.url()).href : page.url(),web);
      const user=form.locator('input[type="email"],input[name="username"],input[name="email"],input[name="usuario"]');
      const submit=form.locator('button[type="submit"],input[type="submit"]');
      if (await user.count() !== 1 || await submit.count() !== 1) throw new Error('El acceso necesita una configuración específica');
      await user.fill(usuario); await form.locator('input[type="password"]').fill(password);
      await submit.click();
      await page.waitForLoadState('domcontentloaded');
      if (!await page.getByText(/cerrar sesión|salir de mi cuenta|logout/i).count()) throw new Error('No se pudo confirmar la sesión. Revisá las credenciales, CAPTCHA o doble factor');
    }
    if (!url || destino.pathname === '/') return {acceso:true,requiereUrl:true};
    await page.goto(destino.href,{waitUntil:'domcontentloaded',timeout:20000});
    if (compraGamer) await page.locator('h1.product-details__info__title').waitFor({state:'visible',timeout:20000});
    if (new URL(page.url()).pathname !== destino.pathname || new URL(page.url()).search !== destino.search) throw new Error('La web redirigió a una página diferente del producto');
    if (flytec) {
      const codigo=(destino.pathname.match(/^\/produto\/[^/]+\/(\d+)\/?$/)||[])[1];
      if(!codigo) throw new Error('Falta la URL exacta de producto Flytec');
      const selector='.preco-card [data-preco-placeholder][data-codigo="'+codigo+'"]';
      await page.waitForFunction(sel=>{const n=document.querySelector(sel);return n && /U\$\s*\d/.test(n.textContent);},selector,{timeout:20000}).catch(()=>{throw new Error('Flytec no terminó de cargar el precio del producto. Volvé a intentar');});
      const datos=await page.locator(selector).evaluate(n=>{const copia=n.cloneNode(true);copia.querySelectorAll('small,s,del').forEach(x=>x.remove());return {precio:copia.textContent,titulo:document.querySelector('h1')?.textContent.trim(),codigo:document.body.innerText.match(/Código do Produto:\s*(\d+)/)?.[1]};});
      if(datos.codigo!==codigo || !datos.titulo) throw new Error('Flytec no confirmó la identidad del producto');
      const precioOriginal=precioFlytec(datos.precio);
      if(proveedor.monedaPrecios!=='USD') throw new Error('Flytec informa USD. Seleccioná USD en Moneda de precios del proveedor');
      return {ok:true,url:destino.href,precioOriginal,moneda:'USD',tituloProveedor:datos.titulo,ficha:await extraerFichaPagina(page),fuente:'flytec_precio_dinamico',requiereConversion:true};
    }
    const datos=await page.evaluate(()=>{
      const productos=[]; const leer=x=>{if(!x || typeof x!=='object')return;if(Array.isArray(x)){x.forEach(leer);return;}if([].concat(x['@type']||[]).includes('Product'))productos.push(x);if(x['@graph'])leer(x['@graph']);if(x.mainEntity)leer(x.mainEntity);};
      document.querySelectorAll('script[type="application/ld+json"]').forEach(n=>{try{leer(JSON.parse(n.textContent));}catch(_){}});
      return {productos,titulo:(document.querySelector('h1')||{}).textContent||'',url:location.href,texto:document.body.innerText};
    });
    let precioCompraGamer;
    if (compraGamer) {
      const medio = proveedor.condicionComercial && proveedor.condicionComercial.medioPago;
      if (!['transferencia','otros'].includes(medio)) throw new Error('Elegí depósito/transferencia u otros medios de pago en la configuración del proveedor');
      precioCompraGamer = await page.evaluate(() => {
        const h=document.querySelector('h1.product-details__info__title')?.cloneNode(true);
        if (h) h.querySelectorAll('button,.product-details__info__title__action-buttons').forEach(n=>n.remove());
        const leer=etiqueta=>{
          const nodos=Array.from(document.querySelectorAll('main span')).filter(n=>n.textContent.trim()===etiqueta);
          if(nodos.length!==1)return '';
          const precios=nodos[0].parentElement.querySelectorAll('cgw-price');
          return precios.length===1?precios[0].textContent:'';
        };
        return {titulo:h?.textContent.trim() || '',id:(document.querySelector('main')?.innerText.match(/\bID:\s*(\d+)/)||[])[1]||'',transferencia:leer('Mejor precio'),otros:leer('Otros medios de pago')};
      });
      const elegido=seleccionarPrecioCompraGamer(precioCompraGamer,destino.href,medio);
      datos.titulo=precioCompraGamer.titulo;
      datos.productos=[{name:datos.titulo,url:datos.url,offers:{'@type':'Offer',price:elegido,priceCurrency:'ARS'}}];
    }
    // Ciardi publica su ficha en HTML: verificar el código exacto antes de
    // leer únicamente el importe situado bajo PRECIO INTERNET.
    if (destino.hostname === 'clientes.ciardi.com.ar' && destino.pathname === '/producto.php' && !datos.productos.length) {
      const codigo=datos.texto.match(/C[oó]digo:\s*(\d+)/i);
      const precio=datos.texto.match(/PRECIO INTERNET\s*\$\s*([\d.]+)\s*,\s*(\d{2})(?!\d)/i);
      if (!codigo || codigo[1] !== destino.searchParams.get('p') || !precio || !datos.titulo.trim()) throw new Error('Ciardi no confirmó el código y el precio Internet de este producto');
      datos.productos=[{name:datos.titulo,url:datos.url,offers:{'@type':'Offer',price:Number(precio[1].replace(/\./g,'')+'.'+precio[2]),priceCurrency:'ARS'}}];
    }
    const oferta=validarOferta(datos), ficha=await extraerFichaPagina(page);
    if (compraGamer) {
      ficha.nombre=datos.titulo;
      oferta.selectorPrecio='cgw-price:' + proveedor.condicionComercial.medioPago;
      oferta.medioPagoProveedor=proveedor.condicionComercial.medioPago;
      oferta.precioYaIncluyePromocion=oferta.medioPagoProveedor==='transferencia';
    }
    return Object.assign({ok:true,url:destino.href,fuente:'proveedor_automatico_url_exacta',ficha,identidad:{ok:true,metodo:'producto_estructurado_url_exacta',requiereRevisionFicha:true}},oferta);
  } finally { clearTimeout(timer); await context.close().catch(()=>{}); await browser.close().catch(()=>{}); }
}
function seleccionarPrecioCompraGamer(datos,url,medio) {
  const id=(new URL(url).pathname.match(/_(\d+)\/?$/)||[])[1];
  if(!id || id!==datos.id || !datos.titulo)throw new Error('CompraGamer no confirmó el ID exacto del producto');
  if(!['transferencia','otros'].includes(medio))throw new Error('Medio de pago no configurado');
  const valor=String(datos[medio]||'').replace(/\s/g,'');
  if(!/^\$\d[\d.]*(?:,\d{2})?$/.test(valor))throw new Error('CompraGamer todavía no informó el precio del medio de pago elegido');
  const precio=Number(valor.slice(1).replace(/\./g,'').replace(',','.'));
  if(!(precio>0))throw new Error('Precio de CompraGamer inválido');
  return precio;
}
module.exports={consultarAutomatico,validarOferta,urlProveedor,firmaAcceso,aplicarCondicionComercial,seleccionarPrecioCompraGamer,direccionPublica,precioFlytec};
