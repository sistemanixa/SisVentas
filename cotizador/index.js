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

async function cotizar(reqBody) {
  const proveedorKey = String(reqBody.proveedorKey || '').trim();
  const url = reqBody.url || reqBody.urlProducto || '';
  if (!proveedorKey) throw new Error('Falta proveedorKey');
  if (!url) throw new Error('Falta URL exacta del producto');

  const snap = await db.ref(`sisventas/proveedores/${proveedorKey}`).get();
  const proveedor = snap.val();
  if (!proveedor) throw new Error('Proveedor no encontrado en Firebase');
  if (proveedor.activo === false) throw new Error('Proveedor inactivo');

  if (esBiosegur(proveedor, url)) {
    return cotizarBiosegur({
      proveedor,
      url,
      codigo: reqBody.codigo || '',
      producto: reqBody.producto || '',
      debug: !!reqBody.debug
    });
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
    if (pathname !== '/' && pathname !== '/cotizar' && pathname !== '/biosegur') {
      send(res, 404, { ok: false, error: true, mensaje: 'Ruta no encontrada' });
      return;
    }
    const resultado = await cotizar(body);
    send(res, 200, resultado);
  } catch (e) {
    console.error('[cotizador]', e);
    send(res, 200, { ok: false, error: true, mensaje: e.message || 'Error cotizando proveedor', debug: { trace: e.trace || [] } });
  }
});

server.listen(PORT, () => {
  console.log(`Cotizador NIXA listo en puerto ${PORT}`);
});
