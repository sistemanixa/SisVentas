const http = require('http');
const { chromium } = require('playwright');
const admin = require('firebase-admin');

const PORT = parseInt(process.env.PORT || '8080', 10);
const FRONTEND_KEY = process.env.FRONTEND_KEY || '';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://nixa-sisventas-default-rtdb.firebaseio.com';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://ventas.sistemanixa.com';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: DATABASE_URL
  });
}

const db = admin.database();

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frontend-Key');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Solicitud demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function normalizarTexto(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizarUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function esBiosegur(proveedor, url) {
  const txt = `${proveedor.nombre || ''} ${proveedor.web || ''} ${url || ''}`.toLowerCase();
  return txt.includes('biosegur');
}

function tipoProveedor(proveedor, url) {
  const txt = `${proveedor.nombre || ''} ${proveedor.web || ''} ${url || ''}`.toLowerCase();
  if (txt.includes('biosegur')) return 'biosegur';
  if (txt.includes('free-electron') || txt.includes('free electron')) return 'free_electron';
  if (txt.includes('tecnoprices')) return 'tecnoprices';
  if (txt.includes('mercadolibre.com.ar') || txt.includes('mercado libre') || txt.includes('mercadolibre') || txt.includes('meli.la')) return 'mercado_libre';
  return '';
}

function esUrlMercadoLibre(url) {
  try {
    const host = new URL(normalizarUrl(url)).hostname.toLowerCase();
    return /(^|\.)mercadolibre\.com\.ar$/.test(host) || host === 'meli.la';
  }
  catch (_) { return false; }
}

function esDestinoMercadoLibreArgentina(url) {
  try { return /(^|\.)mercadolibre\.com\.ar$/.test(new URL(normalizarUrl(url)).hostname.toLowerCase()); }
  catch (_) { return false; }
}

function idsMercadoLibreDesdeUrl(url) {
  try {
    const parsed = new URL(normalizarUrl(url));
    const normalizarId = (valor) => String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const itemQuery = normalizarId(parsed.searchParams.get('wid') || parsed.searchParams.get('item_id'));
    const itemPath = normalizarId((parsed.pathname.match(/\/(MLA-?\d{6,})/i) || [])[1]);
    const productoPath = normalizarId((parsed.pathname.match(/\/p\/(MLA-?\d{6,})/i) || [])[1]);
    return {
      itemId: /^MLA\d{6,}$/.test(itemQuery) ? itemQuery : (/^MLA\d{6,}$/.test(itemPath) ? itemPath : ''),
      productoId: /^MLA\d{6,}$/.test(productoPath) ? productoPath : ''
    };
  } catch (_) {
    return { itemId:'', productoId:'' };
  }
}

async function obtenerJsonMercadoLibre(ruta) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`https://api.mercadolibre.com${ruta}`, {
      headers: {
        accept:'application/json',
        'accept-language':'es-AR,es;q=0.9',
        'user-agent':'SisVentas-Nixa/2.0'
      },
      signal:controller.signal
    });
    if (!response.ok) throw new Error(`API Mercado Libre respondió ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function extraerProductoMercadoLibreApi(urlExacta) {
  const ids = idsMercadoLibreDesdeUrl(urlExacta);
  let item = null;
  let producto = null;
  if (ids.itemId) item = await obtenerJsonMercadoLibre(`/items/${encodeURIComponent(ids.itemId)}`);
  if (!item && ids.productoId) {
    producto = await obtenerJsonMercadoLibre(`/products/${encodeURIComponent(ids.productoId)}`);
    const ganador = producto && producto.buy_box_winner;
    const itemIdGanador = String(ganador && (ganador.item_id || ganador.id) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^MLA\d{6,}$/.test(itemIdGanador)) {
      item = await obtenerJsonMercadoLibre(`/items/${encodeURIComponent(itemIdGanador)}`).catch(() => null);
    }
  }
  const fuente = item || (producto && producto.buy_box_winner) || producto || null;
  const precioArs = Number(fuente && (fuente.price || fuente.base_price || fuente.original_price)) || 0;
  const moneda = String(fuente && (fuente.currency_id || fuente.currency) || '').toUpperCase();
  if (!precioArs) throw new Error('La API oficial no informó un precio vigente');
  if (moneda && moneda !== 'ARS') throw new Error(`La publicación informa moneda ${moneda}; no se guardará como pesos argentinos`);
  const estado = String(fuente && fuente.status || '').toLowerCase();
  const cantidad = Number(fuente && fuente.available_quantity);
  const disponibilidad = estado && estado !== 'active'
    ? 'sin_stock'
    : Number.isFinite(cantidad) && cantidad <= 0
      ? 'sin_stock'
      : Number.isFinite(cantidad) && cantidad > 0
        ? 'disponible'
        : 'no_verificado';
  return {
    precioArs,
    disponibilidad,
    titulo:String(fuente && (fuente.title || fuente.name) || producto && producto.name || ''),
    moneda:moneda || 'ARS',
    fuente:'mercado_libre_api_oficial'
  };
}

async function extraerProductoMercadoLibre(page) {
  const precioPrincipal = page.locator('.ui-pdp-price__second-line .andes-money-amount').first();
  await precioPrincipal.waitFor({ state:'attached', timeout:10000 }).catch(() => {});
  const bodyText = await page.locator('body').innerText({ timeout:15000 });
  if (/captcha|comprobemos que eres humano|verificaci[oó]n de seguridad/i.test(bodyText)) throw new Error('Mercado Libre solicitó una verificación de seguridad');
  if (/publicaci[oó]n pausada|publicaci[oó]n finalizada|producto no disponible/i.test(bodyText)) throw new Error('La publicación de Mercado Libre no está disponible');
  let precioArs = await precioPrincipal.evaluate((el) => {
    const fraccion = el.querySelector('.andes-money-amount__fraction');
    const centavos = el.querySelector('.andes-money-amount__cents');
    const entero = String(fraccion ? fraccion.textContent : '').replace(/[^0-9]/g, '');
    const decimal = String(centavos ? centavos.textContent : '').replace(/[^0-9]/g, '').slice(0, 2);
    return entero ? Number(entero + (decimal ? '.' + decimal : '')) : 0;
  }).catch(() => 0);
  let schema = null;
  if (!precioArs) {
    precioArs = await page.locator('meta[property="product:price:amount"], meta[itemprop="price"]').first().getAttribute('content')
      .then((valor) => parseFloat(String(valor || '').replace(',', '.')) || 0)
      .catch(() => 0);
  }
  if (!precioArs) {
    schema = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => {
      const recorrer = (v) => {
        if (!v || typeof v !== 'object') return null;
        if (String(v['@type'] || '').toLowerCase() === 'product' && v.offers) return v;
        for (const k of Object.keys(v)) { const encontrado = recorrer(v[k]); if (encontrado) return encontrado; }
        return null;
      };
      for (const script of scripts) {
        try { const encontrado = recorrer(JSON.parse(script.textContent || '{}')); if (encontrado) return encontrado; } catch (_) {}
      }
      return null;
    }).catch(() => null);
    const oferta = schema && schema.offers ? (Array.isArray(schema.offers) ? schema.offers[0] : schema.offers) : null;
    precioArs = parseFloat(oferta && (oferta.price || oferta.lowPrice)) || 0;
  }
  if (!precioArs) throw new Error('No se encontró el precio principal de la publicación');
  const ofertaSchema = schema && schema.offers ? (Array.isArray(schema.offers) ? schema.offers[0] : schema.offers) : null;
  const moneda = await page.locator('meta[itemprop="priceCurrency"]').first().getAttribute('content').catch(() => '')
    || (ofertaSchema && ofertaSchema.priceCurrency)
    || '';
  if (moneda && String(moneda).toUpperCase() !== 'ARS') {
    throw new Error(`La publicación informa moneda ${moneda}; no se guardará como pesos argentinos`);
  }
  const disponibilidad = /stock disponible|cantidad:\s*\d+|comprar ahora|agregar al carrito/i.test(bodyText) ? 'disponible' : extraerDisponibilidadProveedor(bodyText);
  const titulo = await page.locator('h1.ui-pdp-title').first().innerText({ timeout:3000 }).catch(() => '');
  return { precioArs, disponibilidad, titulo:titulo || (schema && schema.name) || '', moneda:moneda || 'ARS', fuente:'mercado_libre_pagina' };
}

async function cotizarMercadoLibre({ proveedor, url, codigo, producto, debug }) {
  const urlExacta = normalizarUrl(url);
  if (!esUrlMercadoLibre(urlExacta)) throw new Error('La URL no corresponde a Mercado Libre Argentina');
  let browser = null, context = null;
  try {
    let datos = await extraerProductoMercadoLibreApi(urlExacta).catch(() => null);
    if (!datos) {
      browser = await chromium.launch({ headless:true });
      context = await browser.newContext({
        locale:'es-AR',
        timezoneId:'America/Argentina/Buenos_Aires',
        userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        extraHTTPHeaders:{ 'accept-language':'es-AR,es;q=0.9' }
      });
      const page = await context.newPage();
      await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:30000 });
      if (!esDestinoMercadoLibreArgentina(page.url())) throw new Error('La URL redirigió fuera de Mercado Libre Argentina');
      datos = await extraerProductoMercadoLibre(page);
    }
    const identidad = validarIdentidadProducto(producto, datos.titulo);
    if (!identidad.ok) throw new Error(identidad.mensaje);
    return { ok:true, proveedor:proveedor.nombre || 'MERCADO LIBRE', codigo:codigo || '', producto:datos.titulo || producto || '', url:urlExacta, precioArs:datos.precioArs, sinIva:false, disponibilidadProveedor:datos.disponibilidad, disponibilidadProveedorTexto:datos.disponibilidad === 'disponible' ? 'Disponible' : datos.disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado', fuente:datos.fuente || 'mercado_libre_url_exacta', fecha:new Date().toISOString(), tituloProveedor:datos.titulo, urlFinal:urlExacta, textoPrecio:`ARS ${datos.precioArs}`, selectorPrecio:datos.fuente || 'mercado_libre', moneda:datos.moneda || 'ARS', identidad, debug:debug ? { titulo:datos.titulo, fuente:datos.fuente || '', identidad } : undefined };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

function parsePrecioArs(texto) {
  const s = String(texto || '');
  const matches = [...s.matchAll(/\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)/g)];
  const valores = matches.map((m) => {
    const n = String(m[1]).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(n) || 0;
  }).filter((n) => n > 0);
  return valores.length ? valores[0] : 0;
}

function normalizarIdentidadProducto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function tokensIdentidadProducto(valor) {
  const ignoradas = new Set([
    'A', 'AL', 'CON', 'DE', 'DEL', 'EL', 'EN', 'LA', 'LAS', 'LOS', 'PARA',
    'POR', 'SIN', 'UN', 'UNA', 'Y', 'X', 'NUEVO', 'NUEVA', 'ORIGINAL'
  ]);
  return normalizarIdentidadProducto(valor).split(/\s+/).filter((token) => {
    return token.length >= 2 && !ignoradas.has(token);
  });
}

function validarIdentidadProducto(productoSolicitado, tituloProveedor) {
  const solicitado = normalizarIdentidadProducto(productoSolicitado);
  const titulo = normalizarIdentidadProducto(tituloProveedor);
  if (!solicitado) return { ok:false, confianza:0, mensaje:'Falta el nombre del producto para comprobar la identidad' };
  if (!titulo) return { ok:false, confianza:0, mensaje:'El proveedor no mostró un título de producto verificable' };
  if (solicitado.includes(titulo) || titulo.includes(solicitado)) return { ok:true, confianza:1 };

  const pedidos = [...new Set(tokensIdentidadProducto(solicitado))];
  const vistos = [...new Set(tokensIdentidadProducto(titulo))];
  const comunes = pedidos.filter((tokenPedido) => {
    return vistos.some((tokenVisto) => tokenPedido === tokenVisto ||
      (tokenPedido.length >= 5 && tokenVisto.length >= 5 &&
        (tokenPedido.includes(tokenVisto) || tokenVisto.includes(tokenPedido))));
  });
  const modelos = pedidos.filter((token) => /[A-Z]/.test(token) && /[0-9]/.test(token) && token.length >= 4);
  const modeloCoincidente = modelos.some((modelo) => vistos.includes(modelo));
  const confianza = pedidos.length ? comunes.length / pedidos.length : 0;
  const minimoComun = pedidos.length <= 2 ? 1 : 2;
  if (modeloCoincidente || (comunes.length >= minimoComun && confianza >= 0.34)) {
    return { ok:true, confianza:Math.round(confianza * 100) / 100, coincidencias:comunes };
  }
  return {
    ok:false,
    confianza:Math.round(confianza * 100) / 100,
    coincidencias:comunes,
    mensaje:`La página parece corresponder a otro producto (“${String(tituloProveedor || '').trim().slice(0, 120)}”)`
  };
}

async function textoVisiblePrimero(page, selectors) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (!await locator.count()) continue;
      const texto = String(await locator.innerText({ timeout:2500 })).trim();
      if (texto) return { texto, selector };
      const atributo = await locator.getAttribute('content');
      const content = atributo == null ? '' : String(atributo).trim();
      if (content) return { texto:`$ ${content}`, selector };
    } catch (_) {}
  }
  return { texto:'', selector:'' };
}

async function tituloVisibleProducto(page, tipo) {
  const selectores = tipo === 'mercado_libre'
    ? ['h1.ui-pdp-title']
    : ['h1.product-title', 'h1.h1', '.product-detail-name h1', '.product-name h1', '.product-name', 'main h1', 'h1'];
  const encontrado = await textoVisiblePrimero(page, selectores);
  return encontrado.texto || await page.title().catch(() => '');
}

function extraerPrecioEtiquetado(texto) {
  const body = String(texto || '');
  const patrones = [
    /(?:precio\s*(?:gremio|especial|web|contado|lista)?|contado|mayorista)[^\n\r$]{0,90}\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)/i,
    /\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(?:\+\s*IVA|sin\s+IVA|impuestos?\s+incluidos?)/i
  ];
  for (const patron of patrones) {
    const coincidencia = body.match(patron);
    if (coincidencia) return parsePrecioArs(`$ ${coincidencia[1]}`);
  }
  return 0;
}

function validarMonedaPrecio(texto, monedaDeclarada) {
  const moneda = String(monedaDeclarada || '').trim().toUpperCase();
  if (moneda && moneda !== 'ARS') {
    return { ok:false, mensaje:`El proveedor informa moneda ${moneda}; no se guardará como pesos argentinos` };
  }
  if (/(?:US\$|U\$S|USD|D[ÓO]LARES?)/i.test(String(texto || ''))) {
    return { ok:false, mensaje:'El precio visible está expresado en dólares; no se guardará como pesos argentinos' };
  }
  return { ok:true, moneda:'ARS' };
}

async function extraerPrecioPaginaProveedor(page, tipo, bodyText) {
  const selectores = tipo === 'free_electron'
    ? [
        '.product-prices .product-price',
        '.current-price .price',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]'
      ]
    : [
        '.product-price',
        '.precio-producto',
        '.precio',
        '[itemprop="price"]',
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]'
      ];
  const encontrado = await textoVisiblePrimero(page, selectores);
  const textoPrecio = encontrado.texto;
  const monedaDeclarada = await page.locator('meta[itemprop="priceCurrency"], meta[property="product:price:currency"]').first()
    .getAttribute('content').catch(() => '');
  const monedaValida = validarMonedaPrecio(textoPrecio, monedaDeclarada);
  if (!monedaValida.ok) throw new Error(monedaValida.mensaje);
  const precioArs = parsePrecioArs(textoPrecio) || extraerPrecioEtiquetado(bodyText);
  if (!precioArs) {
    throw new Error('No se encontró un precio principal verificable; se conservó el valor anterior');
  }
  return {
    precioArs,
    textoPrecio:textoPrecio || 'Precio identificado por etiqueta',
    selectorPrecio:encontrado.selector || 'etiqueta_de_precio',
    moneda:'ARS'
  };
}

function validarSaltoPrecio(precioNuevo, precioAnterior) {
  const nuevo = Number(precioNuevo) || 0;
  const anterior = Number(precioAnterior) || 0;
  if (!(nuevo > 0)) return { ok:false, mensaje:'El proveedor devolvió un precio inválido' };
  if (!(anterior > 0)) return { ok:true };
  const relacion = nuevo / anterior;
  // Un actualizador diario nunca debe reemplazar silenciosamente un costo por
  // otro que cuadruplica (o reduce a la cuarta parte) el valor anterior. Esos
  // casos quedan para revisión manual y conservan el precio conocido.
  if (relacion > 4 || relacion < (1 / 4)) {
    return {
      ok:false,
      mensaje:`Precio bloqueado por variación anormal: anterior ARS ${anterior.toFixed(2)}, recibido ARS ${nuevo.toFixed(2)}`
    };
  }
  return { ok:true };
}

async function clickSiExiste(page, selectors, timeout = 2500) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
      return true;
    } catch (_) {}
  }
  return false;
}

async function completarLoginBiosegur(page, proveedor) {
  const usuario = proveedor.usuario || proveedor.user || proveedor.email || '';
  const password = proveedor.password || proveedor.pass || proveedor.clave || '';
  if (!usuario || !password) {
    throw new Error('El proveedor BIOSEGUR no tiene usuario y contraseña cargados');
  }

  const loginAbierto = await clickSiExiste(page, [
    'a[onclick*="ajaxLogin"]:visible',
    '#login_sup a:has-text("Ingresar"):visible',
    'a:has-text("Ingresar"):visible',
    'button:has-text("Ingresar"):visible'
  ], 5000);
  if (!loginAbierto) {
    throw new Error('No se encontró el acceso visible para iniciar sesión en Biosegur');
  }
  await page.waitForTimeout(800);

  const passInput = page.locator('#ModalLogin input[type="password"]:visible, input[type="password"]:visible').first();
  await passInput.waitFor({ state: 'visible', timeout: 15000 });

  const userInput = page.locator(
    '.modal:visible input:not([type="password"]):not([type="hidden"]), ' +
    '[role="dialog"]:visible input:not([type="password"]):not([type="hidden"]), ' +
    'form:has(input[type="password"]) input:not([type="password"]):not([type="hidden"]), ' +
    'input[name*="usuario" i]:visible, input[name*="user" i]:visible, input[type="email"]:visible'
  ).first();

  await userInput.waitFor({ state: 'visible', timeout: 10000 });
  await userInput.fill(usuario);
  await passInput.fill(password);

  const clicked = await clickSiExiste(page, [
    'button:has-text("Login")',
    'input[type="submit"]',
    'button:has-text("Ingresar")',
    'text=/Login/i'
  ], 4000);

  if (!clicked) {
    await passInput.press('Enter');
  }

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  if (/usuario.*clave|login/i.test(body) && !/mi cuenta|salir/i.test(body)) {
    throw new Error('No se pudo confirmar el inicio de sesión en Biosegur');
  }
}

function extraerPrecioBiosegur(texto) {
  const body = String(texto || '');
  const precioPrincipal = body.match(/\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})*,[0-9]{2})\s*(?:\n|\r|\s)*\+\s*IVA/i);
  if (precioPrincipal) return parsePrecioArs(`$ ${precioPrincipal[1]}`);
  const precioGremio = body.match(/(?:precio|gremio|lista)[^\n\r$]{0,80}\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})*,[0-9]{2})/i);
  if (precioGremio) return parsePrecioArs(`$ ${precioGremio[1]}`);
  return 0;
}

function extraerDisponibilidadProveedor(texto) {
  const body = normalizarTexto(texto);
  if (/sin\s+stock|agotado|no\s+disponible|fuera\s+de\s+stock/.test(body)) return 'sin_stock';
  if (/producto\s+con\s+stock|hay\s+stock|en\s+stock|disponible/.test(body)) return 'disponible';
  return 'no_verificado';
}

async function cotizarProveedorConLogin({ proveedor, url, codigo, producto, debug, tipo }) {
  const trace = [];
  const addTrace = (step, data = {}) => trace.push({ step, at:new Date().toISOString(), ...data });
  let browser = null;
  let context = null;
  try {
    const usuario = proveedor.usuario || proveedor.user || proveedor.email || '';
    const password = proveedor.password || proveedor.pass || proveedor.clave || '';
    if (!usuario || !password) throw new Error('El proveedor no tiene usuario y contraseña cargados');
    const urlExacta = normalizarUrl(url);
    if (/large_default|\.jpe?g(?:\?|$)|\.png(?:\?|$)|\.webp(?:\?|$)/i.test(urlExacta)) {
      throw new Error('La URL cargada corresponde a una imagen. Cambiala por la página exacta del producto');
    }
    browser = await chromium.launch({ headless:true });
    context = await browser.newContext({ locale:'es-AR', timezoneId:'America/Argentina/Buenos_Aires' });
    const page = await context.newPage();
    addTrace('iniciando_sesion', { tipo, urlExacta });
    if (tipo === 'free_electron') {
      await page.goto('https://www.free-electron.com.ar/mi-cuenta', { waitUntil:'domcontentloaded', timeout:30000 });
      await page.locator('form[action*="iniciar-sesion"] input[name="email"]').fill(usuario);
      await page.locator('form[action*="iniciar-sesion"] input[name="password"]').fill(password);
      await page.locator('form[action*="iniciar-sesion"] #submit-login').click();
    } else {
      await page.goto('https://www.tecnoprices.com/ingresar', { waitUntil:'domcontentloaded', timeout:30000 });
      await page.locator('form[action="control.php"] input[name="usuario"]').fill(usuario);
      await page.locator('form[action="control.php"] input[name="password"]').fill(password);
      await page.locator('form[action="control.php"] button[type="submit"]').click();
    }
    await page.waitForLoadState('networkidle', { timeout:15000 }).catch(() => {});
    addTrace('sesion_iniciada', { urlActual:page.url() });
    await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:30000 });
    await page.waitForLoadState('networkidle', { timeout:10000 }).catch(() => {});
    const dominioFinal = new URL(page.url()).hostname.toLowerCase();
    const dominioValido = tipo === 'free_electron'
      ? /(^|\.)free-electron\.com\.ar$/.test(dominioFinal)
      : /(^|\.)tecnoprices\.com$/.test(dominioFinal);
    if (!dominioValido) throw new Error('La página redirigió fuera del proveedor esperado');
    const bodyText = await page.locator('body').innerText({ timeout:15000 });
    if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('No se pudo iniciar sesión o la cuenta no permite ver precios');
    const tituloProveedor = await tituloVisibleProducto(page, tipo);
    const identidad = validarIdentidadProducto(producto, tituloProveedor);
    if (!identidad.ok) throw new Error(identidad.mensaje);
    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);
    const precioArs = evidenciaPrecio.precioArs;
    const disponibilidad = extraerDisponibilidadProveedor(bodyText);
    const impuestosIncluidos = /impuestos\s+incluidos|iva\s+incluido/i.test(bodyText);
    const sinIvaVisible = /\+\s*iva|sin\s+iva/i.test(bodyText);
    return {
      ok:true, proveedor:proveedor.nombre || (tipo === 'free_electron' ? 'FREE ELECTRON' : 'TECNOPRICES'),
      codigo:codigo || '', producto:producto || await page.title().catch(() => ''), url:urlExacta,
      precioArs, sinIva:impuestosIncluidos ? false : (sinIvaVisible ? true : tipo === 'tecnoprices'),
      disponibilidadProveedor:disponibilidad,
      disponibilidadProveedorTexto:disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
      fuente:tipo + '_login_url_exacta', fecha:new Date().toISOString(),
      tituloProveedor,
      urlFinal:page.url(),
      textoPrecio:evidenciaPrecio.textoPrecio,
      selectorPrecio:evidenciaPrecio.selectorPrecio,
      moneda:evidenciaPrecio.moneda,
      identidad,
      debug:debug ? { trace, tituloProveedor, evidenciaPrecio, identidad } : undefined
    };
  } catch (e) {
    e.trace = trace;
    throw e;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function cotizarBiosegur({ proveedor, url, codigo, producto, debug }) {
  const trace = [];
  const addTrace = (step, data = {}) => {
    trace.push({ step, at: new Date().toISOString(), ...data });
  };
  let browser = null;
  let context = null;
  let page = null;

  try {
    addTrace('navegador_iniciando', { playwright: require('playwright/package.json').version });
    browser = await chromium.launch({ headless: true });
    addTrace('navegador_iniciado');
    context = await browser.newContext({
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires'
    });
    page = await context.newPage();
    const home = normalizarUrl(proveedor.web || 'https://www.biosegur.com.ar/');
    const urlExacta = normalizarUrl(url);
    if (!urlExacta) throw new Error('Falta URL exacta del producto');
    addTrace('inicio', {
      proveedor: proveedor.nombre || 'BIOSEGUR',
      home,
      urlExacta,
      tieneUsuario: !!(proveedor.usuario || proveedor.user || proveedor.email),
      tienePassword: !!(proveedor.password || proveedor.pass || proveedor.clave)
    });

    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    addTrace('home_abierto', { urlActual: page.url() });
    await completarLoginBiosegur(page, proveedor);
    addTrace('login_completado', { urlActual: page.url() });

    await page.goto(urlExacta, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    addTrace('url_producto_abierta', { urlActual: page.url(), titulo: await page.title().catch(() => '') });
    if (!/(^|\.)biosegur\.com\.ar$/.test(new URL(page.url()).hostname.toLowerCase())) {
      throw new Error('La página redirigió fuera de Biosegur');
    }

    const bodyText = await page.locator('body').innerText({ timeout: 15000 });
    addTrace('texto_leido', {
      caracteres: bodyText.length,
      muestra: bodyText.slice(0, 900)
    });
    if (/usuario.*clave|login/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
      throw new Error('La URL exacta abriÃ³ sin sesiÃ³n activa; no se puede leer precio gremio');
    }

    const precioArs = extraerPrecioBiosegur(bodyText);
    const disponibilidad = extraerDisponibilidadProveedor(bodyText);
    addTrace('precio_extraido', { precioArs });
    if (!precioArs) {
      throw new Error('No se encontró precio visible en la URL exacta luego del login');
    }

    const title = await tituloVisibleProducto(page, 'biosegur');
    const identidad = validarIdentidadProducto(producto, title);
    if (!identidad.ok) throw new Error(identidad.mensaje);
    return {
      ok: true,
      proveedor: proveedor.nombre || 'BIOSEGUR',
      codigo: codigo || '',
      producto: (typeof producto === 'string' && producto.trim()) ? producto : (title || ''),
      url: urlExacta,
      precioArs,
      sinIva: true,
      precioConIva: Math.round(precioArs * 1.21 * 100) / 100,
      disponibilidadProveedor: disponibilidad,
      disponibilidadProveedorTexto: disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
      fuente: 'biosegur_login_url_exacta',
      fecha: new Date().toISOString(),
      tituloProveedor:title,
      urlFinal:page.url(),
      textoPrecio:`$ ${precioArs.toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })} + IVA`,
      selectorPrecio:'precio_biosegur_mas_iva',
      moneda:'ARS',
      identidad,
      debug: debug ? { trace, tituloProveedor:title, identidad } : undefined
    };
  } catch (e) {
    e.trace = trace;
    throw e;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function cotizarLoteBiosegur({ proveedor, items, debug, jobId, offset = 0, totalGlobal = 0, iniciadoEn = 0 }) {
  const lote = Array.isArray(items) ? items.slice(0, 30) : [];
  if (!lote.length) throw new Error('El lote no contiene productos');
  const jobSeguro = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const progresoRef = jobSeguro ? db.ref(`sisventas/procesos/cotizador/${jobSeguro}`) : null;
  const inicioMs = parseInt(iniciadoEn, 10) || Date.now();
  const totalTrabajo = Math.max(parseInt(totalGlobal, 10) || 0, offset + lote.length);

  let browser = null;
  let context = null;
  const trace = [];
  const addTrace = (step, data = {}) => trace.push({ step, at: new Date().toISOString(), ...data });

  try {
    addTrace('lote_iniciando', { cantidad: lote.length });
    if (progresoRef) await progresoRef.set({ estado:'iniciando_navegador', proveedor:'BIOSEGUR', procesados:offset, total:totalTrabajo, inicioEn:inicioMs, actualizadoEn:Date.now() });
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(15000);
    const home = normalizarUrl(proveedor.web || 'https://www.biosegur.com.ar/');
    if (progresoRef) await progresoRef.update({ estado:'iniciando_sesion', actualizadoEn:Date.now() });
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await completarLoginBiosegur(page, proveedor);
    addTrace('lote_login_completado');

    const resultados = [];
    for (let i = 0; i < lote.length; i += 1) {
      const item = lote[i] || {};
      const urlExacta = normalizarUrl(item.url || item.urlProducto || '');
      if (progresoRef) await progresoRef.update({
        estado:'procesando',
        codigo:item.codigo || '',
        producto:item.producto || item.nombre || '',
        url:urlExacta,
        procesados:offset + i,
        total:totalTrabajo,
        actualizadoEn:Date.now()
      });
      if (!urlExacta) {
        resultados.push({ ok: false, error: true, codigo: item.codigo || '', mensaje: 'Falta URL exacta' });
        continue;
      }
      try {
        const hostProducto = new URL(urlExacta).hostname.toLowerCase();
        if (!/(^|\.)biosegur\.com\.ar$/.test(hostProducto)) {
          throw new Error('La URL corresponde a otro proveedor; revisá la vinculación');
        }
        await page.goto(urlExacta, { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (!/(^|\.)biosegur\.com\.ar$/.test(new URL(page.url()).hostname.toLowerCase())) {
          throw new Error('La página redirigió fuera de Biosegur');
        }
        const bodyText = await page.locator('body').innerText({ timeout: 8000 });
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) {
          throw new Error('Producto no encontrado o desactivado en el proveedor');
        }
        if (/usuario.*clave|login/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
          throw new Error('La sesión de Biosegur se cerró durante el lote');
        }
        const tituloProveedor = await tituloVisibleProducto(page, 'biosegur');
        const identidad = validarIdentidadProducto(item.producto || item.nombre || '', tituloProveedor);
        if (!identidad.ok) throw new Error(identidad.mensaje);
        const precioArs = extraerPrecioBiosegur(bodyText);
        const disponibilidad = extraerDisponibilidadProveedor(bodyText);
        if (!precioArs) throw new Error('No se encontró un precio visible');
        const validacionPrecio = validarSaltoPrecio(precioArs, item.precioAnteriorArs);
        if (!validacionPrecio.ok) throw new Error(validacionPrecio.mensaje);
        resultados.push({
          ok: true,
          proveedor: proveedor.nombre || 'BIOSEGUR',
          codigo: item.codigo || '',
          producto: item.producto || item.nombre || '',
          url: urlExacta,
          precioArs,
          sinIva: true,
          precioConIva: Math.round(precioArs * 1.21 * 100) / 100,
          disponibilidadProveedor: disponibilidad,
          disponibilidadProveedorTexto: disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
          fuente: 'biosegur_lote_url_exacta',
          fecha: new Date().toISOString(),
          tituloProveedor,
          urlFinal:page.url(),
          textoPrecio:`$ ${precioArs.toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })} + IVA`,
          selectorPrecio:'precio_biosegur_mas_iva',
          moneda:'ARS',
          identidad
        });
      } catch (e) {
        resultados.push({ ok: false, error: true, codigo: item.codigo || '', url: urlExacta, mensaje: e.message || 'Error leyendo producto' });
      }
      addTrace('lote_progreso', { procesados: i + 1, total: lote.length });
      if (progresoRef) {
        const procesadosGlobal = offset + i + 1;
        const transcurridoSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));
        const promedioSeg = transcurridoSeg / Math.max(1, procesadosGlobal);
        await progresoRef.update({
          procesados:procesadosGlobal,
          total:totalTrabajo,
          transcurridoSeg,
          estimadoRestanteSeg:Math.max(0, Math.round((totalTrabajo - procesadosGlobal) * promedioSeg)),
          actualizados:resultados.filter((r) => r.ok).length,
          fallidos:resultados.filter((r) => !r.ok).length,
          actualizadoEn:Date.now()
        });
      }
    }

    if (progresoRef) await progresoRef.update({ estado:'bloque_completado', codigo:'', producto:'', procesados:offset + lote.length, total:totalTrabajo, actualizadoEn:Date.now() });

    return {
      ok: true,
      proveedor: proveedor.nombre || 'BIOSEGUR',
      total: lote.length,
      actualizados: resultados.filter((r) => r.ok).length,
      fallidos: resultados.filter((r) => !r.ok).length,
      resultados,
      debug: debug ? { trace } : undefined
    };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function cotizarLoteProveedorLogin({ proveedor, items, tipo, jobId, offset = 0, totalGlobal = 0, iniciadoEn = 0 }) {
  const lote = Array.isArray(items) ? items.slice(0, 30) : [];
  if (!lote.length) throw new Error('El lote no contiene productos');
  const jobSeguro = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const progresoRef = jobSeguro ? db.ref(`sisventas/procesos/cotizador/${jobSeguro}`) : null;
  const inicioMs = parseInt(iniciadoEn, 10) || Date.now();
  const totalTrabajo = Math.max(parseInt(totalGlobal, 10) || 0, offset + lote.length);
  const nombreTipo = tipo === 'free_electron' ? 'FREE ELECTRON' : 'TECNOPRICES';
  const dominioEsperado = tipo === 'free_electron' ? /(^|\.)free-electron\.com\.ar$/ : /(^|\.)tecnoprices\.com$/;
  let browser = null, context = null;
  try {
    if (progresoRef) await progresoRef.set({ estado:'iniciando_navegador', proveedor:nombreTipo, procesados:offset, total:totalTrabajo, inicioEn:inicioMs, actualizadoEn:Date.now() });
    browser = await chromium.launch({ headless:true });
    context = await browser.newContext({ locale:'es-AR', timezoneId:'America/Argentina/Buenos_Aires' });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(15000);
    const usuario = proveedor.usuario || proveedor.user || proveedor.email || '';
    const password = proveedor.password || proveedor.pass || proveedor.clave || '';
    if (!usuario || !password) throw new Error(`${nombreTipo} no tiene usuario y contraseña cargados`);
    if (progresoRef) await progresoRef.update({ estado:'iniciando_sesion', proveedor:nombreTipo, actualizadoEn:Date.now() });
    if (tipo === 'free_electron') {
      await page.goto('https://www.free-electron.com.ar/mi-cuenta', { waitUntil:'domcontentloaded', timeout:15000 });
      await page.locator('form[action*="iniciar-sesion"] input[name="email"]').fill(usuario);
      await page.locator('form[action*="iniciar-sesion"] input[name="password"]').fill(password);
      await page.locator('form[action*="iniciar-sesion"] #submit-login').click();
    } else {
      await page.goto('https://www.tecnoprices.com/ingresar', { waitUntil:'domcontentloaded', timeout:15000 });
      await page.locator('form[action="control.php"] input[name="usuario"]').fill(usuario);
      await page.locator('form[action="control.php"] input[name="password"]').fill(password);
      await page.locator('form[action="control.php"] button[type="submit"]').click();
    }
    await page.waitForLoadState('domcontentloaded', { timeout:8000 }).catch(() => {});
    const resultados = [];
    for (let i=0; i<lote.length; i+=1) {
      const item=lote[i] || {}, urlExacta=normalizarUrl(item.url || item.urlProducto || '');
      if (progresoRef) await progresoRef.update({ estado:'procesando', proveedor:nombreTipo, codigo:item.codigo||'', producto:item.producto||item.nombre||'', url:urlExacta, procesados:offset+i, total:totalTrabajo, actualizadoEn:Date.now() });
      try {
        if (!urlExacta || !dominioEsperado.test(new URL(urlExacta).hostname.toLowerCase())) throw new Error('La URL corresponde a otro proveedor; revisá la vinculación');
        await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:15000 });
        if (!dominioEsperado.test(new URL(page.url()).hostname.toLowerCase())) throw new Error('La página redirigió fuera del proveedor esperado');
        const bodyText=await page.locator('body').innerText({ timeout:8000 });
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) throw new Error('Producto no encontrado o desactivado en el proveedor');
        if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('La sesión no permite ver precios');
        const tituloProveedor=await tituloVisibleProducto(page,tipo);
        const identidad=validarIdentidadProducto(item.producto||item.nombre||'',tituloProveedor);
        if (!identidad.ok) throw new Error(identidad.mensaje);
        const evidenciaPrecio=await extraerPrecioPaginaProveedor(page,tipo,bodyText);
        const precioArs=evidenciaPrecio.precioArs;
        const validacionPrecio=validarSaltoPrecio(precioArs,item.precioAnteriorArs);
        if (!validacionPrecio.ok) throw new Error(validacionPrecio.mensaje);
        const disponibilidad=extraerDisponibilidadProveedor(bodyText);
        const impuestosIncluidos=/impuestos\s+incluidos|iva\s+incluido/i.test(bodyText);
        const sinIvaVisible=/\+\s*iva|sin\s+iva/i.test(bodyText);
        resultados.push({ok:true,proveedor:proveedor.nombre||nombreTipo,codigo:item.codigo||'',producto:item.producto||item.nombre||'',url:urlExacta,precioArs,sinIva:impuestosIncluidos?false:(sinIvaVisible?true:tipo==='tecnoprices'),disponibilidadProveedor:disponibilidad,disponibilidadProveedorTexto:disponibilidad==='disponible'?'Disponible':disponibilidad==='sin_stock'?'Sin stock':'No verificado',fuente:tipo+'_lote_url_exacta',fecha:new Date().toISOString(),tituloProveedor,urlFinal:page.url(),textoPrecio:evidenciaPrecio.textoPrecio,selectorPrecio:evidenciaPrecio.selectorPrecio,moneda:evidenciaPrecio.moneda,identidad});
      } catch(e) { resultados.push({ok:false,error:true,codigo:item.codigo||'',url:urlExacta,mensaje:e.message||'Error leyendo producto'}); }
      if (progresoRef) {
        const procesadosGlobal=offset+i+1, transcurridoSeg=Math.max(1,Math.round((Date.now()-inicioMs)/1000)), promedioSeg=transcurridoSeg/Math.max(1,procesadosGlobal);
        await progresoRef.update({procesados:procesadosGlobal,total:totalTrabajo,transcurridoSeg,estimadoRestanteSeg:Math.max(0,Math.round((totalTrabajo-procesadosGlobal)*promedioSeg)),actualizados:resultados.filter(r=>r.ok).length,fallidos:resultados.filter(r=>!r.ok).length,actualizadoEn:Date.now()});
      }
    }
    if (progresoRef) await progresoRef.update({estado:'bloque_completado',codigo:'',producto:'',procesados:offset+lote.length,total:totalTrabajo,actualizadoEn:Date.now()});
    return {ok:true,proveedor:proveedor.nombre||nombreTipo,total:lote.length,actualizados:resultados.filter(r=>r.ok).length,fallidos:resultados.filter(r=>!r.ok).length,resultados};
  } finally {
    if (context) await context.close().catch(()=>{});
    if (browser) await browser.close().catch(()=>{});
  }
}

async function cotizarLoteMercadoLibre({ proveedor, items, jobId, offset = 0, totalGlobal = 0, iniciadoEn = 0 }) {
  const lote = Array.isArray(items) ? items.slice(0, 30) : [];
  if (!lote.length) throw new Error('El lote no contiene productos');
  const jobSeguro = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const progresoRef = jobSeguro ? db.ref(`sisventas/procesos/cotizador/${jobSeguro}`) : null;
  const inicioMs = parseInt(iniciadoEn, 10) || Date.now();
  const totalTrabajo = Math.max(parseInt(totalGlobal, 10) || 0, offset + lote.length);
  let browser = null, context = null, page = null;
  try {
    if (progresoRef) await progresoRef.set({ estado:'consultando_fuente_oficial', proveedor:'MERCADO LIBRE', procesados:offset, total:totalTrabajo, inicioEn:inicioMs, actualizadoEn:Date.now() });
    const resultados = [];
    for (let i=0; i<lote.length; i+=1) {
      const item = lote[i] || {}, urlExacta = normalizarUrl(item.url || item.urlProducto || '');
      if (progresoRef) await progresoRef.update({ estado:'procesando', proveedor:'MERCADO LIBRE', codigo:item.codigo||'', producto:item.producto||item.nombre||'', url:urlExacta, procesados:offset+i, total:totalTrabajo, actualizadoEn:Date.now() });
      try {
        if (!esUrlMercadoLibre(urlExacta)) throw new Error('La URL no corresponde a Mercado Libre Argentina');
        let datos = await extraerProductoMercadoLibreApi(urlExacta).catch(() => null);
        if (!datos) {
          if (!page) {
            if (progresoRef) await progresoRef.update({ estado:'iniciando_respaldo_visual', actualizadoEn:Date.now() });
            browser = await chromium.launch({ headless:true });
            context = await browser.newContext({
              locale:'es-AR',
              timezoneId:'America/Argentina/Buenos_Aires',
              userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
              extraHTTPHeaders:{ 'accept-language':'es-AR,es;q=0.9' }
            });
            page = await context.newPage();
            page.setDefaultTimeout(10000);
            page.setDefaultNavigationTimeout(20000);
          }
          await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:30000 });
          if (!esDestinoMercadoLibreArgentina(page.url())) throw new Error('La URL redirigió fuera de Mercado Libre Argentina');
          datos = await extraerProductoMercadoLibre(page);
        }
        const identidad = validarIdentidadProducto(item.producto||item.nombre||'', datos.titulo);
        if (!identidad.ok) throw new Error(identidad.mensaje);
        const validacionPrecio = validarSaltoPrecio(datos.precioArs, item.precioAnteriorArs);
        if (!validacionPrecio.ok) throw new Error(validacionPrecio.mensaje);
        resultados.push({ ok:true, proveedor:proveedor.nombre||'MERCADO LIBRE', codigo:item.codigo||'', producto:datos.titulo||item.producto||item.nombre||'', url:urlExacta, precioArs:datos.precioArs, sinIva:false, disponibilidadProveedor:datos.disponibilidad, disponibilidadProveedorTexto:datos.disponibilidad==='disponible'?'Disponible':datos.disponibilidad==='sin_stock'?'Sin stock':'No verificado', fuente:datos.fuente || 'mercado_libre_lote_url_exacta', fecha:new Date().toISOString(), tituloProveedor:datos.titulo, urlFinal:urlExacta, textoPrecio:`ARS ${datos.precioArs}`, selectorPrecio:datos.fuente || 'mercado_libre', moneda:datos.moneda || 'ARS', identidad });
      } catch (e) {
        resultados.push({ ok:false, error:true, codigo:item.codigo||'', url:urlExacta, mensaje:e.message||'Error leyendo la publicación' });
      }
      if (progresoRef) {
        const procesadosGlobal=offset+i+1, transcurridoSeg=Math.max(1,Math.round((Date.now()-inicioMs)/1000)), promedioSeg=transcurridoSeg/Math.max(1,procesadosGlobal);
        await progresoRef.update({ procesados:procesadosGlobal, total:totalTrabajo, transcurridoSeg, estimadoRestanteSeg:Math.max(0,Math.round((totalTrabajo-procesadosGlobal)*promedioSeg)), actualizados:resultados.filter(r=>r.ok).length, fallidos:resultados.filter(r=>!r.ok).length, actualizadoEn:Date.now() });
      }
    }
    if (progresoRef) await progresoRef.update({ estado:'bloque_completado', codigo:'', producto:'', procesados:offset+lote.length, total:totalTrabajo, actualizadoEn:Date.now() });
    return { ok:true, proveedor:proveedor.nombre||'MERCADO LIBRE', total:lote.length, actualizados:resultados.filter(r=>r.ok).length, fallidos:resultados.filter(r=>!r.ok).length, resultados };
  } finally {
    if (context) await context.close().catch(()=>{});
    if (browser) await browser.close().catch(()=>{});
  }
}

async function cotizarLote(reqBody) {
  const proveedorKey = String(reqBody.proveedorKey || '').trim();
  if (!proveedorKey) throw new Error('Falta proveedorKey');
  const snap = await db.ref(`sisventas/proveedores/${proveedorKey}`).get();
  const proveedor = snap.val();
  if (!proveedor) throw new Error('Proveedor no encontrado en Firebase');
  if (proveedor.activo === false) throw new Error('Proveedor inactivo');
  const primeraUrl = Array.isArray(reqBody.items) && reqBody.items[0] ? (reqBody.items[0].url || '') : '';
  const tipoLote = tipoProveedor(proveedor, primeraUrl);
  if (tipoLote === 'free_electron' || tipoLote === 'tecnoprices') {
    return cotizarLoteProveedorLogin({ proveedor, items:reqBody.items, tipo:tipoLote, jobId:reqBody.jobId||'', offset:parseInt(reqBody.offset,10)||0, totalGlobal:parseInt(reqBody.total,10)||0, iniciadoEn:parseInt(reqBody.iniciadoEn,10)||0 });
  }
  if (tipoLote === 'mercado_libre') {
    return cotizarLoteMercadoLibre({ proveedor, items:reqBody.items, jobId:reqBody.jobId||'', offset:parseInt(reqBody.offset,10)||0, totalGlobal:parseInt(reqBody.total,10)||0, iniciadoEn:parseInt(reqBody.iniciadoEn,10)||0 });
  }
  if (!esBiosegur(proveedor, '')) throw new Error('El actualizador por lote está habilitado solamente para Biosegur');
  return cotizarLoteBiosegur({
    proveedor,
    items: reqBody.items,
    debug: !!reqBody.debug,
    jobId: reqBody.jobId || '',
    offset: parseInt(reqBody.offset, 10) || 0,
    totalGlobal: parseInt(reqBody.total, 10) || 0,
    iniciadoEn: parseInt(reqBody.iniciadoEn, 10) || 0
  });
}

async function cotizar(reqBody) {
  const proveedorKey = String(reqBody.proveedorKey || '').trim();
  const url = reqBody.url || reqBody.urlProducto || '';
  if (!proveedorKey) throw new Error('Falta proveedorKey');
  if (!url) throw new Error('Falta URL exacta del producto');

  const snap = await db.ref(`sisventas/proveedores/${proveedorKey}`).get();
  const proveedor = snap.val();
  if (!proveedor) throw new Error('Proveedor no encontrado en Firebase');
  if (proveedor.activo === false) throw new Error('Proveedor inactivo');

  const tipo = tipoProveedor(proveedor, url);
  if (tipo === 'biosegur') {
    return cotizarBiosegur({
      proveedor,
      url,
      codigo: reqBody.codigo || '',
      producto: reqBody.producto || '',
      debug: !!reqBody.debug
    });
  }

  if (tipo === 'free_electron' || tipo === 'tecnoprices') {
    return cotizarProveedorConLogin({ proveedor, url, codigo:reqBody.codigo || '', producto:reqBody.producto || '', debug:!!reqBody.debug, tipo });
  }

  if (tipo === 'mercado_libre') {
    return cotizarMercadoLibre({ proveedor, url, codigo:reqBody.codigo || '', producto:reqBody.producto || '', debug:!!reqBody.debug });
  }

  throw new Error(`Proveedor no soportado todavía: ${proveedor.nombre || proveedorKey}`);
}

const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: true, mensaje: 'Método no permitido' });
    return;
  }

  if (FRONTEND_KEY && req.headers['x-frontend-key'] !== FRONTEND_KEY) {
    send(res, 401, { ok: false, error: true, mensaje: 'No autorizado' });
    return;
  }

  try {
    const body = await readBody(req);
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname !== '/' && pathname !== '/cotizar' && pathname !== '/biosegur' && pathname !== '/cotizar-lote') {
      send(res, 404, { ok: false, error: true, mensaje: 'Ruta no encontrada' });
      return;
    }
    const resultado = pathname === '/cotizar-lote' ? await cotizarLote(body) : await cotizar(body);
    send(res, 200, resultado);
  } catch (e) {
    console.error('[cotizador]', e);
    send(res, 200, { ok: false, error: true, mensaje: e.message || 'Error cotizando proveedor', debug: { trace: e.trace || [] } });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Cotizador NIXA listo en puerto ${PORT}`);
  });
}

module.exports = {
  parsePrecioArs,
  extraerPrecioBiosegur,
  extraerPrecioEtiquetado,
  validarIdentidadProducto,
  validarMonedaPrecio,
  validarSaltoPrecio
};
