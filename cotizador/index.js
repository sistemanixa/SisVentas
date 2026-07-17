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
  return '';
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
  return parsePrecioArs(body);
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
    const bodyText = await page.locator('body').innerText({ timeout:15000 });
    if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('No se pudo iniciar sesión o la cuenta no permite ver precios');
    let textoPrecio = bodyText;
    if (tipo === 'free_electron') {
      textoPrecio = await page.locator('.product-prices .product-price').first().innerText({ timeout:10000 }).catch(() => bodyText);
    }
    const precioArs = parsePrecioArs(textoPrecio);
    if (!precioArs) throw new Error('No se encontró un precio visible en la página exacta');
    const disponibilidad = extraerDisponibilidadProveedor(bodyText);
    const impuestosIncluidos = /impuestos\s+incluidos|iva\s+incluido/i.test(bodyText);
    const sinIvaVisible = /\+\s*iva|sin\s+iva/i.test(bodyText);
    return {
      ok:true, proveedor:proveedor.nombre || (tipo === 'free_electron' ? 'FREE ELECTRON' : 'TECNOPRICES'),
      codigo:codigo || '', producto:producto || await page.title().catch(() => ''), url:urlExacta,
      precioArs, sinIva:impuestosIncluidos ? false : (sinIvaVisible ? true : tipo === 'tecnoprices'),
      disponibilidadProveedor:disponibilidad,
      disponibilidadProveedorTexto:disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
      fuente:tipo + '_login_url_exacta', fecha:new Date().toISOString(), debug:debug ? { trace } : undefined
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

    const title = await page.title().catch(() => '');
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
      debug: debug ? { trace } : undefined
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
        const bodyText = await page.locator('body').innerText({ timeout: 8000 });
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) {
          throw new Error('Producto no encontrado o desactivado en el proveedor');
        }
        if (/usuario.*clave|login/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
          throw new Error('La sesión de Biosegur se cerró durante el lote');
        }
        const precioArs = extraerPrecioBiosegur(bodyText);
        const disponibilidad = extraerDisponibilidadProveedor(bodyText);
        if (!precioArs) throw new Error('No se encontró un precio visible');
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
          fecha: new Date().toISOString()
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
        const bodyText=await page.locator('body').innerText({ timeout:8000 });
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) throw new Error('Producto no encontrado o desactivado en el proveedor');
        if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('La sesión no permite ver precios');
        let textoPrecio=bodyText;
        if (tipo==='free_electron') textoPrecio=await page.locator('.product-prices .product-price').first().innerText({timeout:5000}).catch(()=>bodyText);
        const precioArs=parsePrecioArs(textoPrecio);
        if (!precioArs) throw new Error('No se encontró un precio visible');
        const disponibilidad=extraerDisponibilidadProveedor(bodyText);
        const impuestosIncluidos=/impuestos\s+incluidos|iva\s+incluido/i.test(bodyText);
        const sinIvaVisible=/\+\s*iva|sin\s+iva/i.test(bodyText);
        resultados.push({ok:true,proveedor:proveedor.nombre||nombreTipo,codigo:item.codigo||'',producto:item.producto||item.nombre||'',url:urlExacta,precioArs,sinIva:impuestosIncluidos?false:(sinIvaVisible?true:tipo==='tecnoprices'),disponibilidadProveedor:disponibilidad,disponibilidadProveedorTexto:disponibilidad==='disponible'?'Disponible':disponibilidad==='sin_stock'?'Sin stock':'No verificado',fuente:tipo+'_lote_url_exacta',fecha:new Date().toISOString()});
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

server.listen(PORT, () => {
  console.log(`Cotizador NIXA listo en puerto ${PORT}`);
});
