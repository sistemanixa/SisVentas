const { normalizarFicha, fichaDesdeApi, extraerFichaPagina, validarUrlFicha, identidadAlta, protegerNavegacionFicha } = require('./ficha-producto');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');
const admin = require('firebase-admin');

const PORT = parseInt(process.env.PORT || '8080', 10);
const FRONTEND_KEY = process.env.FRONTEND_KEY || '';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://nixa-sisventas-default-rtdb.firebaseio.com';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || 'https://ventas.sistemanixa.com';
// Puertos usados por la vista local de SisVentas. Se mantienen restringidos a
// loopback para no abrir el cotizador a sitios de terceros durante desarrollo.
const LOCAL_DEVELOPMENT_ORIGINS = new Set([
  'http://127.0.0.1:8080', 'http://localhost:8080',
  'http://127.0.0.1:4173', 'http://localhost:4173',
  'http://127.0.0.1:8765', 'http://localhost:8765'
]);
const REQUIRE_FIREBASE_AUTH = String(process.env.REQUIRE_FIREBASE_AUTH || '').toLowerCase() === 'true';
const ML_CLIENT_ID = process.env.ML_CLIENT_ID || '';
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET || '';
const ML_REDIRECT_URI = process.env.ML_REDIRECT_URI || 'https://cotizador-171899432710.southamerica-east1.run.app/mercadolibre/oauth/callback';
const ML_TOKEN_KEY = process.env.ML_TOKEN_KEY || '';
const ML_TOKEN_PATH = 'sisventas/_integraciones_server/mercadolibre/oauth';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: DATABASE_URL
  });
}

const db = admin.database();
const { consultarAutomatico, firmaAcceso, aplicarCondicionComercial } = require('./proveedor-automatico');
const verificacionesProveedor = new Map();
const { convertirPrecioProveedor, dolarSistema, validarGuarani } = require('./conversion-proveedor');
let consultaGuarani;
async function obtenerGuarani(forzar=false) {
  if (consultaGuarani) return consultaGuarani;
  consultaGuarani=(async()=>{
    const ref=db.ref('sisventas/config/guarani');
    const guardada=(await ref.get()).val();
    if(!forzar && guardada && Date.now()-guardada.consultadoEn<86400000) {
      try { validarGuarani({base:'USD',quote:'PYG',rate:guardada.pygPorUsd,date:guardada.fecha}); return guardada; } catch(_) {}
    }
    const res=await fetch('https://api.frankfurter.dev/v2/rate/USD/PYG?providers=BCP',{signal:AbortSignal.timeout(15000)});
    if(!res.ok) throw new Error('No se pudo consultar la cotización web del guaraní');
    const datos=validarGuarani(await res.json());await ref.set(datos);return datos;
  })();
  try {return await consultaGuarani;} finally {consultaGuarani=null;}
}
async function convertirMonedaProveedor(resultado) {
  if (!resultado || !resultado.requiereConversion) return resultado;
  const config=(await db.ref('sisventas/config/comprasParaguay').get()).val();
  if (!config?.habilitado) return convertirPrecioProveedor(resultado,config);
  const tipoCambio=(await db.ref('sisventas/config/tipoCambio').get()).val();
  const guarani=resultado.moneda==='PYG'?await obtenerGuarani():null;
  const convertido=convertirPrecioProveedor(resultado,{...config,arsPorUsd:dolarSistema(tipoCambio),pygPorUsd:guarani?.pygPorUsd||0});
  convertido.conversion.dolarTipo=tipoCambio?.dolarConversion||'oficial';
  if(guarani) convertido.conversion.guarani=guarani;
  return convertido;
}
async function verificarProveedor(body) {
  const key = String(body.proveedorKey || '');
  if (!key || /[.#$\[\]\/]/.test(key)) throw new Error('Proveedor inválido');
  if (verificacionesProveedor.has(key)) return verificacionesProveedor.get(key);
  const trabajo = (async () => {
    const ref = db.ref('sisventas/proveedores/' + key);
    const proveedor = (await ref.get()).val();
    if (!proveedor || proveedor.activo === false) throw new Error('Proveedor inexistente o inactivo');
    let url = String(body.url || proveedor.conexionAutomatica?.urlPrueba || '');
    if (!url) {
      const productos = (await db.ref('sisventas/productos').get()).val() || {};
      for (const p of Object.values(productos)) {
        const fila = (Array.isArray(p.proveedores) ? p.proveedores : []).find(x=>x && (x.proveedorKey === key || x.proveedorFbKey === key) && x.url);
        if (fila) { url = fila.url; break; }
      }
    }
    let estado;
    try {
      const tipo = tipoProveedor(proveedor, '');
      let resultado = tipo && url ? await cotizar({proveedorKey:key,url,incluirFicha:true,altaProducto:true}) : await consultarAutomatico(proveedor,url);
      if (resultado.requiereConversion) {
        try { resultado=await convertirMonedaProveedor(resultado); } catch(e) { resultado.conversionPendiente=e.message; }
      }
      if (!tipo) resultado=aplicarCondicionComercial(resultado,proveedor.condicionComercial);
      estado = {estado:resultado.ok ? 'verificado' : 'requiere_url',mensaje:resultado.ok ? 'Acceso y producto de prueba verificados' : 'Acceso comprobado. Falta una URL exacta de producto para verificar la cotización',urlPrueba:url,verificadoEn:Date.now(),firma: firmaAcceso(proveedor),automatico:!tipo};
      if (resultado.requiereConversion) {
        estado.estado='requiere_conversion';
        estado.mensaje='Lectura comprobada: ' + resultado.precioOriginal.toFixed(2) + ' ' + resultado.moneda + '. ' + (resultado.conversionPendiente || 'Conversión a pesos pendiente de configurar');
        estado.muestra={nombre:resultado.tituloProveedor,precioOriginal:resultado.precioOriginal,moneda:resultado.moneda};
      } else if (resultado.ok) estado.muestra = {nombre:resultado.ficha && resultado.ficha.nombre || resultado.tituloProveedor || '',precioArs:resultado.precioArs,moneda:resultado.moneda,sinIva:resultado.sinIva};
      if (resultado.condicionComercialAplicada) Object.assign(estado.muestra,{precioPublicadoArs:resultado.precioPublicadoArs,descuentoPorcentaje:resultado.descuentoProveedorPorcentaje});
      if (resultado.conversion) Object.assign(estado.muestra,{precioOriginal:resultado.precioOriginal,monedaOriginal:resultado.monedaOriginal,conversion:resultado.conversion});
    } catch (e) {
      estado = {estado:'requiere_revision',mensaje:String(e.message || 'No se pudo verificar el proveedor').slice(0,500),urlPrueba:url,verificadoEn:Date.now(),firma:firmaAcceso(proveedor)};
    }
    const actual = (await ref.get()).val();
    if (!actual || firmaAcceso(actual) !== firmaAcceso(proveedor)) throw new Error('Los accesos cambiaron durante la prueba. Volvé a verificar');
    await ref.child('conexionAutomatica').set(estado);
    return {ok:true,conexion:estado};
  })();
  verificacionesProveedor.set(key,trabajo);
  try { return await trabajo; } finally { verificacionesProveedor.delete(key); }
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function origenCorsPermitido(origen) {
  const valor = String(origen || '').trim();
  if (!valor) return ALLOW_ORIGIN;
  if (valor === ALLOW_ORIGIN || LOCAL_DEVELOPMENT_ORIGINS.has(valor)) return valor;
  return '';
}

function cors(req, res) {
  const origen = origenCorsPermitido(req && req.headers && req.headers.origin);
  if (origen) res.setHeader('Access-Control-Allow-Origin', origen);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Frontend-Key, Authorization');
}

const DOMINIOS_IMAGEN_PRODUCTO = [
  /(^|\.)mitiendanube\.com$/,
  /(^|\.)biosegur\.com\.ar$/,
  /(^|\.)ciardi\.com\.ar$/,
  /(^|\.)compragamer\.com$/,
  /(^|\.)free-electron\.com\.ar$/,
  /(^|\.)garnet\.com\.ar$/,
  /(^|\.)gstatic\.com$/,
  /(^|\.)licenciaspccl\.net$/,
  /(^|\.)mlstatic\.com$/,
  /(^|\.)rosarioseguridad\.com\.ar$/,
  /(^|\.)tecnoprices\.com$/,
  /(^|\.)sistemanixa\.com$/
];

function urlImagenProductoPermitida(valor) {
  try {
    const destino = new URL(String(valor || '').trim());
    return destino.protocol === 'https:' && DOMINIOS_IMAGEN_PRODUCTO.some((patron) => patron.test(destino.hostname.toLowerCase()))
      ? destino
      : null;
  } catch (_) {
    return null;
  }
}

async function servirImagenProducto(requestUrl, req, res) {
  const destino = urlImagenProductoPermitida(requestUrl.searchParams.get('url'));
  if (!destino) {
    send(res, 400, { ok:false, error:true, mensaje:'URL de imagen no permitida' });
    return;
  }
  const clave = String(req.headers['x-frontend-key'] || requestUrl.searchParams.get('key') || '');
  if (FRONTEND_KEY && clave !== FRONTEND_KEY) {
    send(res, 401, { ok:false, error:true, mensaje:'No autorizado' });
    return;
  }
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 12000);
  try {
    const respuesta = await fetch(destino, {
      redirect:'follow',
      signal:controlador.signal,
      headers:{ 'User-Agent':'SisVentas/2.2 (+https://ventas.sistemanixa.com)' }
    });
    const destinoFinal = urlImagenProductoPermitida(respuesta.url || destino.href);
    const tipo = String(respuesta.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!respuesta.ok || !destinoFinal || !tipo.startsWith('image/')) {
      send(res, 502, { ok:false, error:true, mensaje:'No se pudo recuperar una imagen válida' });
      return;
    }
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    if (!contenido.length || contenido.length > 5 * 1024 * 1024) {
      send(res, 413, { ok:false, error:true, mensaje:'La imagen supera el tamaño permitido' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': tipo,
      'Content-Length': contenido.length,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': origenCorsPermitido(req.headers.origin),
      'Vary': 'Origin'
    });
    res.end(contenido);
  } finally {
    clearTimeout(timeout);
  }
}

function claveMercadoLibre() {
  if (!ML_TOKEN_KEY) throw new Error('Falta configurar ML_TOKEN_KEY');
  return crypto.createHash('sha256').update(ML_TOKEN_KEY, 'utf8').digest();
}

function cifrarTokenMercadoLibre(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', claveMercadoLibre(), iv);
  cipher.setAAD(Buffer.from('sisventas-mercadolibre-oauth-v1'));
  const contenido = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: contenido.toString('base64url'),
    actualizadoEn: Date.now()
  };
}

function descifrarTokenMercadoLibre(registro) {
  if (!registro || registro.v !== 1 || !registro.iv || !registro.tag || !registro.data) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', claveMercadoLibre(), Buffer.from(registro.iv, 'base64url'));
  decipher.setAAD(Buffer.from('sisventas-mercadolibre-oauth-v1'));
  decipher.setAuthTag(Buffer.from(registro.tag, 'base64url'));
  const contenido = Buffer.concat([decipher.update(Buffer.from(registro.data, 'base64url')), decipher.final()]);
  return JSON.parse(contenido.toString('utf8'));
}

function asegurarConfiguracionMercadoLibre() {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI || !ML_TOKEN_KEY) {
    const error = new Error('La conexión con Mercado Libre todavía no está configurada');
    error.statusCode = 503;
    throw error;
  }
}

function firmarEstadoOAuthMercadoLibre() {
  asegurarConfiguracionMercadoLibre();
  const contenido = `${Date.now()}.${crypto.randomBytes(18).toString('base64url')}`;
  const firma = crypto.createHmac('sha256', claveMercadoLibre()).update(contenido).digest('base64url');
  return `${contenido}.${firma}`;
}

function validarEstadoOAuthMercadoLibre(estado) {
  const partes = String(estado || '').split('.');
  if (partes.length !== 3) return false;
  const contenido = `${partes[0]}.${partes[1]}`;
  const esperada = crypto.createHmac('sha256', claveMercadoLibre()).update(contenido).digest();
  let recibida;
  try { recibida = Buffer.from(partes[2], 'base64url'); } catch (_) { return false; }
  const emitidoEn = Number(partes[0]);
  return recibida.length === esperada.length &&
    crypto.timingSafeEqual(recibida, esperada) &&
    Number.isFinite(emitidoEn) &&
    Math.abs(Date.now() - emitidoEn) < 10 * 60 * 1000;
}

async function solicitarTokenMercadoLibre(parametros) {
  asegurarConfiguracionMercadoLibre();
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type':'application/x-www-form-urlencoded', accept:'application/json' },
    body: new URLSearchParams(parametros)
  });
  const datos = await response.json().catch(() => ({}));
  if (!response.ok || !datos.access_token) {
    const detalle = datos.message || datos.error_description || datos.error || `HTTP ${response.status}`;
    throw new Error(`Mercado Libre rechazó la autorización: ${detalle}`);
  }
  return {
    access_token: String(datos.access_token),
    refresh_token: String(datos.refresh_token || parametros.refresh_token || ''),
    token_type: String(datos.token_type || 'bearer'),
    user_id: Number(datos.user_id) || 0,
    scope: String(datos.scope || ''),
    expires_at: Date.now() + Math.max(60, Number(datos.expires_in) || 21600) * 1000
  };
}

async function guardarTokenMercadoLibre(token) {
  await db.ref(ML_TOKEN_PATH).set(cifrarTokenMercadoLibre(token));
}

async function cargarTokenMercadoLibre() {
  const snap = await db.ref(ML_TOKEN_PATH).get();
  return descifrarTokenMercadoLibre(snap.val());
}

async function obtenerAccessTokenMercadoLibre() {
  asegurarConfiguracionMercadoLibre();
  let token = await cargarTokenMercadoLibre();
  if (!token || !token.access_token) throw new Error('Mercado Libre necesita autorizarse una vez desde /mercadolibre/oauth/start');
  if (Number(token.expires_at) > Date.now() + 2 * 60 * 1000) return token.access_token;
  if (!token.refresh_token) throw new Error('Mercado Libre requiere una nueva autorización');
  token = await solicitarTokenMercadoLibre({
    grant_type: 'refresh_token',
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token: token.refresh_token
  });
  await guardarTokenMercadoLibre(token);
  return token.access_token;
}

async function estadoOAuthMercadoLibre() {
  const configurado = !!(ML_CLIENT_ID && ML_CLIENT_SECRET && ML_REDIRECT_URI && ML_TOKEN_KEY);
  if (!configurado) return { configurado:false, autorizado:false, mensaje:'Falta configurar OAuth de Mercado Libre en el servicio' };
  try {
    const token = await cargarTokenMercadoLibre();
    const venceEn = Number(token && token.expires_at) || 0;
    return {
      configurado:true,
      autorizado:!!(token && token.access_token),
      vigente:venceEn > Date.now() + 2 * 60 * 1000,
      venceEn:venceEn || null,
      mensaje:token && token.access_token ? 'OAuth de Mercado Libre disponible' : 'Mercado Libre requiere autorización'
    };
  } catch (error) {
    return { configurado:true, autorizado:false, vigente:false, mensaje:'No se pudo leer la autorización de Mercado Libre' };
  }
}

async function iniciarOAuthMercadoLibre(res) {
  const state = firmarEstadoOAuthMercadoLibre();
  const destino = new URL('https://auth.mercadolibre.com.ar/authorization');
  destino.searchParams.set('response_type', 'code');
  destino.searchParams.set('client_id', ML_CLIENT_ID);
  destino.searchParams.set('redirect_uri', ML_REDIRECT_URI);
  destino.searchParams.set('state', state);
  res.writeHead(302, { Location: destino.toString(), 'Cache-Control':'no-store' });
  res.end();
}

async function completarOAuthMercadoLibre(url, res) {
  asegurarConfiguracionMercadoLibre();
  const code = String(url.searchParams.get('code') || '');
  const state = String(url.searchParams.get('state') || '');
  if (!code || !validarEstadoOAuthMercadoLibre(state)) throw new Error('La autorización de Mercado Libre no es válida o venció');
  const token = await solicitarTokenMercadoLibre({
    grant_type: 'authorization_code',
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    code,
    redirect_uri: ML_REDIRECT_URI
  });
  await guardarTokenMercadoLibre(token);
  sendHtml(res, 200, '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mercado Libre conectado</title><body style="margin:0;background:#0f1117;color:#f5f7fb;font:16px system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:560px;padding:36px;border:1px solid #303644;border-radius:18px;background:#1a1e29;text-align:center"><h1 style="color:#39d98a">Mercado Libre conectado</h1><p>SisVentas ya puede consultar precios mediante la API oficial y renovar el acceso automáticamente.</p><p>Podés cerrar esta pestaña.</p></main></body></html>');
}

function extraerTokenBearer(authorization) {
  const match = String(authorization || '').match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : '';
}

async function autenticarSolicitud(req) {
  if (!REQUIRE_FIREBASE_AUTH) return null;
  const token = extraerTokenBearer(req.headers.authorization);
  if (!token) {
    const error = new Error('Sesión Firebase requerida');
    error.statusCode = 401;
    throw error;
  }
  try {
    return await admin.auth().verifyIdToken(token, true);
  } catch (_) {
    const error = new Error('Sesión Firebase inválida o vencida');
    error.statusCode = 401;
    throw error;
  }
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
    const esCatalogo = (valor) => /^MLA[A-Z]*\d{6,}$/.test(valor);
    // Mercado Libre puede dejar wid luego del # en enlaces compartidos desde
    // resultados. Aunque no viaje al servidor web, sí identifica el item que
    // el usuario quiso cotizar y debe priorizarse sobre el catálogo genérico.
    const parametrosFragmento = new URLSearchParams(String(parsed.hash || '').replace(/^#/, ''));
    // Las publicaciones antiguas suelen redirigir a /up/MLAU... y Mercado
    // Libre conserva el artículo concreto dentro de pdp_filters=item_id:MLA….
    // Es el mismo rol que wid: no debe perderse al consultar el catálogo.
    const filtroItem = [
      parsed.searchParams.get('pdp_filters'),
      parsed.searchParams.get('filters'),
      parsed.searchParams.get('filter')
    ].filter(Boolean).join(' ').match(/item_id\s*[:=]\s*(MLA-?\d{6,})/i);
    const itemQuery = normalizarId(
      parsed.searchParams.get('wid') || parsed.searchParams.get('item_id') ||
      parametrosFragmento.get('wid') || parametrosFragmento.get('item_id') ||
      (filtroItem && filtroItem[1])
    );
    const productoPath = normalizarId((parsed.pathname.match(/\/(?:p|up)\/(MLA[A-Z]*-?\d{6,})/i) || [])[1]);
    // Una URL /p/MLA... identifica un producto de catálogo, no un item.
    // El mismo número no debe enviarse a /items porque Mercado Libre responde 403.
    const itemPath = productoPath ? '' : normalizarId((parsed.pathname.match(/\/(MLA-?\d{6,})/i) || [])[1]);
    return {
      itemId: /^MLA\d{6,}$/.test(itemQuery) ? itemQuery : (/^MLA\d{6,}$/.test(itemPath) ? itemPath : ''),
      productoId: esCatalogo(productoPath) ? productoPath : ''
    };
  } catch (_) {
    return { itemId:'', productoId:'' };
  }
}

function itemIdMercadoLibreDesdeHtml(html, productoId = '') {
  const texto = String(html || '')
    .replace(/&quot;/gi, '"')
    .replace(/\\u0026/gi, '&')
    .replace(/%3A/gi, ':')
    .replace(/%3D/gi, '=')
    .replace(/%2F/gi, '/');
  const producto = String(productoId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const patrones = [];
  if (/^MLA\d{6,}$/.test(producto)) {
    patrones.push(new RegExp(`itemId=(MLA-?\\d{6,})[^"'<>]{0,180}productId=${producto}`, 'i'));
  }
  patrones.push(
    /\/noindex\/services\/(MLA-?\d{6,})\/payments/i,
    /["']item_id["']\s*:\s*["'](MLA-?\d{6,})["']/i,
    /(?:itemId|item_id)=(MLA-?\d{6,})/i
  );
  for (const patron of patrones) {
    const match = texto.match(patron);
    const id = String(match && match[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^MLA\d{6,}$/.test(id)) return id;
  }
  return '';
}

async function descubrirItemMercadoLibreDesdePagina(urlExacta, productoId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(normalizarUrl(urlExacta), {
      headers: {
        accept:'text/html,application/xhtml+xml',
        'accept-language':'es-AR,es;q=0.9',
        'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132 Safari/537.36'
      },
      redirect:'follow',
      signal:controller.signal
    });
    if (!response.ok) throw new Error(`La página de Mercado Libre respondió ${response.status}`);
    const itemId = itemIdMercadoLibreDesdeHtml(await response.text(), productoId);
    if (!itemId) throw new Error('La página no informó la publicación vigente');
    return itemId;
  } finally {
    clearTimeout(timer);
  }
}

function filtrosMercadoLibreDesdeUrl(url) {
  try {
    const parsed = new URL(normalizarUrl(url));
    const filtros = [
      parsed.searchParams.get('pdp_filters'),
      parsed.searchParams.get('filters'),
      parsed.searchParams.get('filter')
    ].filter(Boolean).join(' ');
    const tienda = String(filtros).match(/official_store\s*[:=]\s*(\d+)/i);
    return { officialStoreId: tienda ? Number(tienda[1]) : 0 };
  } catch (_) {
    return { officialStoreId:0 };
  }
}

function publicacionesCompatiblesMercadoLibre(resultados, productoId, officialStoreId) {
  const productoNormalizado = String(productoId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tienda = Number(officialStoreId) || 0;
  return (Array.isArray(resultados) ? resultados : []).filter((item) => {
    if (!item || !(Number(item.price) > 0)) return false;
    if (item.currency_id && String(item.currency_id).toUpperCase() !== 'ARS') return false;
    if (item.status && String(item.status).toLowerCase() !== 'active') return false;
    const catalogo = String(item.catalog_product_id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (productoNormalizado && catalogo && catalogo !== productoNormalizado) return false;
    const tiendaItem = Number(item.official_store_id || (item.seller && item.seller.official_store_id)) || 0;
    if (tienda && tiendaItem !== tienda) return false;
    return true;
  });
}

function seleccionarPublicacionMercadoLibre(resultados, productoId, officialStoreId, ordenarPorPrecio = true) {
  const compatibles = publicacionesCompatiblesMercadoLibre(resultados, productoId, officialStoreId);
  if (ordenarPorPrecio) compatibles.sort((a, b) => Number(a.price) - Number(b.price));
  return compatibles[0] || null;
}

function seleccionarPublicacionConsensoMercadoLibre(resultados, productoId, officialStoreId) {
  const compatibles = publicacionesCompatiblesMercadoLibre(resultados, productoId, officialStoreId);
  if (!compatibles.length) return null;
  const frecuencias = new Map();
  compatibles.forEach((item, indice) => {
    const clave = Number(item.price).toFixed(2);
    const grupo = frecuencias.get(clave) || { cantidad:0, primerIndice:indice };
    grupo.cantidad += 1;
    frecuencias.set(clave, grupo);
  });
  const precioConsenso = [...frecuencias.entries()].sort((a, b) =>
    b[1].cantidad - a[1].cantidad || a[1].primerIndice - b[1].primerIndice
  )[0][0];
  return compatibles.find((item) => Number(item.price).toFixed(2) === precioConsenso) || compatibles[0];
}

async function resolverGanadorMercadoLibre(publicacion, trace, apiGet = obtenerJsonMercadoLibre) {
  const itemId = String(publicacion && (publicacion.item_id || publicacion.id) || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!/^MLA\d{6,}$/.test(itemId)) return publicacion || null;
  try {
    const competencia = await apiGet(`/items/${encodeURIComponent(itemId)}/price_to_win?siteId=MLA&version=v2`);
    const ganador = competencia && competencia.winner;
    const ganadorId = String(ganador && (ganador.item_id || ganador.id) || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!ganador || !(Number(ganador.price) > 0) || !/^MLA\d{6,}$/.test(ganadorId)) return publicacion;
    const detalle = await apiGet(`/items/${encodeURIComponent(ganadorId)}`).catch(() => null);
    trace.push({ step:'mercado_libre_ganador_competencia', at:new Date().toISOString(), itemId:ganadorId, precioArs:Number(ganador.price) });
    // Mantener los metadatos de la publicación de catálogo (en especial
    // catalog_product_id): price_to_win puede traer sólo id/precio.
    return { ...publicacion, ...(detalle || {}), ...ganador, id:ganadorId, item_id:ganadorId, price:Number(ganador.price) };
  } catch (errorCompetencia) {
    trace.push({ step:'mercado_libre_ganador_competencia_fallo', at:new Date().toISOString(), mensaje:errorCompetencia.message || String(errorCompetencia) });
    return publicacion;
  }
}

function numeroPrecioMercadoLibre(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function datosMercadoLibreDesdeFuente(fuente, producto) {
  if (!fuente) return null;
  const oferta = fuente.sale_price && typeof fuente.sale_price === 'object' ? fuente.sale_price : {};
  // En publicaciones con promoción Mercado Libre puede dejar el precio vigente
  // exclusivamente en sale_price.amount; price/base_price representan el valor
  // de lista. Siempre se toma primero el importe final de la oferta.
  const precioActualArs = numeroPrecioMercadoLibre(
    oferta.amount || oferta.price || fuente.price || fuente.base_price || fuente.original_price
  );
  const moneda = String(oferta.currency_id || fuente.currency_id || fuente.currency || '').toUpperCase();
  if (!precioActualArs) return null;
  if (moneda && moneda !== 'ARS') throw new Error(`La publicación informa moneda ${moneda}; no se guardará como pesos argentinos`);
  let precioOriginalArs = numeroPrecioMercadoLibre(
    oferta.regular_amount || oferta.original_amount || fuente.original_price || fuente.base_price || fuente.price
  ) || precioActualArs;
  if (precioOriginalArs < precioActualArs) precioOriginalArs = precioActualArs;
  const descuentoInformado = Number(oferta.discount_rate || oferta.discount_percentage || fuente.discount_rate) || 0;
  const porcentajeDescuento = descuentoInformado > 0
    ? descuentoInformado
    : precioOriginalArs > precioActualArs
      ? Math.round(((precioOriginalArs - precioActualArs) / precioOriginalArs) * 10000) / 100
      : 0;
  const enPromocion = precioOriginalArs > precioActualArs + 0.005 || porcentajeDescuento > 0;
  const estado = String(fuente.status || '').toLowerCase();
  const cantidad = Number(fuente.available_quantity);
  const disponibilidad = estado && estado !== 'active'
    ? 'sin_stock'
    : Number.isFinite(cantidad) && cantidad <= 0
      ? 'sin_stock'
      : Number.isFinite(cantidad) && cantidad > 0
        ? 'disponible'
        : 'no_verificado';
  return {
    ficha:fichaDesdeApi(fuente, producto || {}),
    // precioArs se conserva para los consumidores actuales del cotizador.
    precioArs:precioActualArs,
    precioActualArs,
    precioOriginalArs,
    enPromocion,
    porcentajeDescuento,
    disponibilidad,
    titulo:String(fuente.title || fuente.name || (producto && producto.name) || ''),
    moneda:moneda || 'ARS',
    itemId:String(fuente.id || fuente.item_id || ''),
    catalogProductId:String(fuente.catalog_product_id || (producto && producto.id) || '')
  };
}

function validarIdentidadMercadoLibreOficial(urlExacta, productoSolicitado, datos) {
  const titulo = String(datos && datos.titulo || '').trim();
  if (titulo) return validarIdentidadProducto(productoSolicitado, titulo);
  const ids = idsMercadoLibreDesdeUrl(urlExacta);
  const diagnostico = datos && datos.diagnosticoMercadoLibre || {};
  const normalizarId = (valor) => String(valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const itemCoincide = !!ids.itemId && normalizarId(diagnostico.itemIdUtilizado || datos && datos.itemId) === ids.itemId;
  const catalogoCoincide = !!ids.productoId && normalizarId(diagnostico.catalogProductId || datos && datos.catalogProductId) === ids.productoId;
  // En respuestas resumidas de la API oficial puede faltar el título. La
  // identidad sigue siendo comprobable cuando la API confirmó el item concreto
  // (wid) o el catálogo solicitado; no se aplica a la lectura visual ni a otros
  // proveedores.
  if (itemCoincide || catalogoCoincide) {
    return { ok:true, confianza:1, fuente:'mercado_libre_api_identificador_oficial' };
  }
  return validarIdentidadProducto(productoSolicitado, titulo);
}

async function obtenerJsonMercadoLibre(ruta) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const consultar = async (endpoint, accessToken) => fetch(`https://api.mercadolibre.com${endpoint}`, {
      headers: {
        accept:'application/json',
        'accept-language':'es-AR,es;q=0.9',
        'user-agent':'SisVentas-Nixa/2.0',
        ...(accessToken ? { authorization:`Bearer ${accessToken}` } : {})
      },
      signal:controller.signal
    });
    // Los datos públicos de ítems, catálogos y búsquedas no requieren OAuth.
    // Así una autorización vencida no desvía un precio válido al navegador.
    let response = await consultar(ruta, '');
    if ((response.status === 401 || response.status === 403) && !controller.signal.aborted) {
      const accessToken = await obtenerAccessTokenMercadoLibre();
      response = await consultar(ruta, accessToken);
    }
    // Mercado Libre mantiene oficialmente el endpoint multiget. Algunas
    // configuraciones rechazan /items/{id}, pero permiten la misma lectura
    // por /items?ids=...; sólo se usa para el mismo ID solicitado.
    const itemMatch = String(ruta || '').match(/^\/items\/(MLA\d{6,})$/i);
    if (!response.ok && itemMatch && !controller.signal.aborted) {
      const itemId = String(itemMatch[1]).toUpperCase();
      let multi = await consultar(`/items?ids=${encodeURIComponent(itemId)}&attributes=id,title,price,original_price,sale_price,currency_id,status,available_quantity,catalog_product_id,official_store_id,attributes,pictures,secure_thumbnail`, '');
      if ((multi.status === 401 || multi.status === 403) && !controller.signal.aborted) {
        const accessToken = await obtenerAccessTokenMercadoLibre();
        multi = await consultar(`/items?ids=${encodeURIComponent(itemId)}&attributes=id,title,price,original_price,sale_price,currency_id,status,available_quantity,catalog_product_id,official_store_id,attributes,pictures,secure_thumbnail`, accessToken);
      }
      if (multi.ok) {
        const lote = await multi.json();
        const entrada = Array.isArray(lote) ? lote[0] : null;
        if (entrada && Number(entrada.code) === 200 && entrada.body) return entrada.body;
      }
    }
    if (!response.ok) {
      // Mercado Libre suele acompañar un 401/403 con el motivo real en JSON.
      // Conservarlo permite diferenciar token rechazado, aplicación sin permiso
      // o publicación restringida, sin exponer nunca el access token.
      const detalle = await response.text().catch(() => '');
      const detalleSeguro = String(detalle || '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [oculto]')
        .slice(0, 320);
      throw new Error(`API Mercado Libre respondió ${response.status}${detalleSeguro ? `: ${detalleSeguro}` : ''}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function puntajeProductoMercadoLibre(urlExacta, producto) {
  let destino = '';
  try {
    destino = decodeURIComponent(new URL(normalizarUrl(urlExacta)).pathname);
  } catch (_) {
    destino = String(urlExacta || '');
  }
  const limpiar = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  const tokens = [...new Set(limpiar(`${producto && producto.name || ''} ${producto && producto.family_name || ''}`)
    .split(' ')
    .filter((token) => token.length > 2))];
  const textoDestino = limpiar(destino);
  return tokens.reduce((total, token) => total + (textoDestino.includes(token) ? 1 : 0), 0);
}

async function buscarGanadorEnHijosMercadoLibre(producto, urlExacta, officialStoreId, trace) {
  const idsPickers = (producto && producto.pickers || []).flatMap((picker) =>
    (picker && picker.products || []).map((variante) => variante && variante.product_id)
  );
  const ids = [...new Set([...(producto && producto.children_ids || []), ...idsPickers]
    .map((id) => String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter((id) => /^MLA\d{6,}$/.test(id)))].slice(0, 24);
  if (!ids.length) return null;

  trace.push({ step:'mercado_libre_api_hijos', at:new Date().toISOString(), cantidad:ids.length });
  const hijos = (await Promise.all(ids.map((id) =>
    obtenerJsonMercadoLibre(`/products/${encodeURIComponent(id)}`).catch(() => null)
  )))
    .filter(Boolean)
    .sort((a, b) => puntajeProductoMercadoLibre(urlExacta, b) - puntajeProductoMercadoLibre(urlExacta, a));

  for (const hijo of hijos) {
    const ganador = hijo && hijo.buy_box_winner;
    const itemId = String(ganador && (ganador.item_id || ganador.id) || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!/^MLA\d{6,}$/.test(itemId)) continue;
    const candidato = await obtenerJsonMercadoLibre(`/items/${encodeURIComponent(itemId)}`).catch(() => ganador || null);
    if (officialStoreId && Number(candidato && candidato.official_store_id) !== Number(officialStoreId)) continue;
    trace.push({
      step:'mercado_libre_ganador_hijo',
      at:new Date().toISOString(),
      productoId:hijo.id || '',
      itemId
    });
    return { item:candidato, producto:hijo };
  }
  return null;
}

async function extraerProductoMercadoLibreApi(urlExacta, trace = [], apiGet = obtenerJsonMercadoLibre) {
  const ids = idsMercadoLibreDesdeUrl(urlExacta);
  const filtros = filtrosMercadoLibreDesdeUrl(urlExacta);
  const diagnostico = {
    catalogProductId:ids.productoId || '',
    wid:ids.itemId || '',
    itemIdUtilizado:'',
    precioObtenidoPorApi:0,
    precioOriginalArs:0,
    enPromocion:false,
    porcentajeDescuento:0,
    causaFallo:''
  };
  trace.push({
    step:'mercado_libre_ids_resueltos',
    at:new Date().toISOString(),
    catalogProductId:diagnostico.catalogProductId,
    wid:diagnostico.wid
  });
  let item = null;
  let producto = null;

  if (ids.itemId) {
    trace.push({ step:'mercado_libre_api_item_prioritario', at:new Date().toISOString(), itemId:ids.itemId, wid:ids.itemId });
    try {
      item = await apiGet(`/items/${encodeURIComponent(ids.itemId)}`);
      const catalogoItem = String(item && item.catalog_product_id || '').toUpperCase();
      if (ids.productoId && catalogoItem && catalogoItem !== ids.productoId) {
        trace.push({ step:'mercado_libre_wid_catalogo_distinto', at:new Date().toISOString(), wid:ids.itemId, catalogProductId:ids.productoId, catalogProductIdItem:catalogoItem });
        item = null;
      } else {
        diagnostico.itemIdUtilizado = String(item && item.id || ids.itemId);
      }
    } catch (errorItem) {
      diagnostico.causaFallo = `No se pudo consultar wid ${ids.itemId}: ${errorItem.message || String(errorItem)}`;
      trace.push({ step:'mercado_libre_api_item_fallo', at:new Date().toISOString(), itemId:ids.itemId, mensaje:errorItem.message || String(errorItem) });
    }
  }

  if (!item && ids.productoId) {
    trace.push({ step:'mercado_libre_api_publicaciones_producto', at:new Date().toISOString(), productoId:ids.productoId, officialStoreId:filtros.officialStoreId || 0 });
    try {
      const publicaciones = await apiGet(`/products/${encodeURIComponent(ids.productoId)}/items`);
      trace.push({
        step:'mercado_libre_publicaciones_candidatas',
        at:new Date().toISOString(),
        candidatas:(Array.isArray(publicaciones && publicaciones.results) ? publicaciones.results : []).slice(0, 12).map((candidato) => ({
          itemId:candidato && (candidato.item_id || candidato.id) || '',
          precioArs:Number(candidato && candidato.price) || 0,
          tipo:candidato && candidato.listing_type_id || '',
          nivel:candidato && candidato.tier || '',
          tienda:Number(candidato && candidato.official_store_id) || 0,
          etiquetas:Array.isArray(candidato && candidato.tags) ? candidato.tags.slice(0, 8) : []
        }))
      });
      const candidatasCompatibles = publicacionesCompatiblesMercadoLibre(publicaciones && publicaciones.results, ids.productoId, filtros.officialStoreId);
      // Si /items/{wid} fue restringido, el catálogo sigue informando la misma
      // publicación concreta. Preferirla evita reemplazar el enlace pedido por
      // otra oferta del mismo catálogo.
      item = candidatasCompatibles.find((candidata) => String(candidata && (candidata.id || candidata.item_id) || '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '') === ids.itemId) ||
        seleccionarPublicacionConsensoMercadoLibre(candidatasCompatibles, ids.productoId, filtros.officialStoreId);
      if (item) {
        // /products/{catalogo}/items ya garantiza el catálogo de origen, pero
        // algunas respuestas resumidas omiten catalog_product_id.
        if (!item.catalog_product_id) item = { ...item, catalog_product_id:ids.productoId };
        item = await resolverGanadorMercadoLibre(item, trace, apiGet);
        // price_to_win también puede devolver un winner sin catalog_product_id;
        // conservar el catálogo confirmado por el endpoint de publicaciones.
        if (!item.catalog_product_id) item = { ...item, catalog_product_id:ids.productoId };
        producto = await apiGet(`/products/${encodeURIComponent(ids.productoId)}`).catch(() => null);
        trace.push({
          step:'mercado_libre_publicacion_producto_encontrada',
          at:new Date().toISOString(),
          itemId:item.id || item.item_id || '',
          precioArs:Number(item.price) || 0
        });
      } else {
        trace.push({ step:'mercado_libre_api_publicaciones_sin_resultado', at:new Date().toISOString() });
      }
    } catch (errorPublicaciones) {
      trace.push({ step:'mercado_libre_api_publicaciones_fallo', at:new Date().toISOString(), mensaje:errorPublicaciones.message || String(errorPublicaciones) });
    }
  }

  if (!item && ids.productoId) {
    const params = new URLSearchParams({ catalog_product_id:ids.productoId, limit:'50' });
    if (filtros.officialStoreId) params.set('official_store_id', String(filtros.officialStoreId));
    trace.push({ step:'mercado_libre_api_catalogo', at:new Date().toISOString(), productoId:ids.productoId, officialStoreId:filtros.officialStoreId || 0 });
    try {
      const busqueda = await apiGet(`/sites/MLA/search?${params.toString()}`);
      item = seleccionarPublicacionMercadoLibre(busqueda && busqueda.results, ids.productoId, filtros.officialStoreId);
      if (item) {
        trace.push({ step:'mercado_libre_publicacion_encontrada', at:new Date().toISOString(), itemId:item.id || '', precioArs:Number(item.price) || 0 });
      }
    } catch (errorBusqueda) {
      trace.push({ step:'mercado_libre_api_catalogo_fallo', at:new Date().toISOString(), mensaje:errorBusqueda.message || String(errorBusqueda) });
    }
  }

  if (!item && ids.productoId) {
    trace.push({ step:'mercado_libre_descubrir_publicacion', at:new Date().toISOString(), productoId:ids.productoId });
    try {
      const itemId = await descubrirItemMercadoLibreDesdePagina(urlExacta, ids.productoId);
      const candidato = await apiGet(`/items/${encodeURIComponent(itemId)}`);
      if (filtros.officialStoreId && Number(candidato && candidato.official_store_id) !== filtros.officialStoreId) {
        throw new Error('La publicación encontrada no pertenece a la tienda oficial indicada');
      }
      item = candidato;
      trace.push({ step:'mercado_libre_publicacion_descubierta', at:new Date().toISOString(), itemId });
    } catch (errorDescubrimiento) {
      trace.push({ step:'mercado_libre_descubrimiento_fallo', at:new Date().toISOString(), mensaje:errorDescubrimiento.message || String(errorDescubrimiento) });
    }
  }

  if (!item && ids.productoId) {
    trace.push({ step:'mercado_libre_api_producto_respaldo', at:new Date().toISOString(), productoId:ids.productoId });
    try {
      producto = await apiGet(`/products/${encodeURIComponent(ids.productoId)}`);
      const ganador = producto && producto.buy_box_winner;
      const itemIdGanador = String(ganador && (ganador.item_id || ganador.id) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^MLA\d{6,}$/.test(itemIdGanador)) {
        item = await apiGet(`/items/${encodeURIComponent(itemIdGanador)}`).catch(() => ganador || null);
      }
      if (!item) {
        const hallazgo = await buscarGanadorEnHijosMercadoLibre(producto, urlExacta, filtros.officialStoreId, trace);
        if (hallazgo) {
          item = hallazgo.item;
          producto = hallazgo.producto;
        }
      }
    } catch (errorProducto) {
      trace.push({ step:'mercado_libre_api_producto_fallo', at:new Date().toISOString(), mensaje:errorProducto.message || String(errorProducto) });
    }
  }

  const fuente = item || (producto && producto.buy_box_winner) || producto || null;
  const datos = datosMercadoLibreDesdeFuente(fuente, producto);
  if (!datos) {
    diagnostico.causaFallo = diagnostico.causaFallo || 'La API oficial no informó precio vigente para el item/catálogo resuelto';
    const error = new Error('La API oficial no informó un precio vigente');
    error.diagnosticoMercadoLibre = diagnostico;
    throw error;
  }
  diagnostico.itemIdUtilizado = datos.itemId || diagnostico.itemIdUtilizado || ids.itemId || '';
  diagnostico.catalogProductId = datos.catalogProductId || ids.productoId || '';
  diagnostico.precioObtenidoPorApi = datos.precioActualArs || datos.precioArs || 0;
  diagnostico.precioOriginalArs = datos.precioOriginalArs || diagnostico.precioObtenidoPorApi;
  diagnostico.enPromocion = !!datos.enPromocion;
  diagnostico.porcentajeDescuento = Number(datos.porcentajeDescuento) || 0;
  datos.fuente = 'mercado_libre_api_oficial';
  datos.diagnosticoMercadoLibre = diagnostico;
  return datos;
}

function precioMercadoLibreDesdeOgTitle(ogTitle) {
  const matchOg = String(ogTitle || '').match(/(?:^|\s[-–—]\s*)\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)(?:\s|$)/);
  if (!matchOg) return 0;
  const valorOg = matchOg[1];
  return /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(valorOg)
    ? Number(valorOg.replace(/\./g, '').replace(',', '.'))
    : Number(valorOg.replace(',', '.'));
}

function metaMercadoLibreDesdeHtml(html, propiedad) {
  const texto = String(html || '');
  const nombre = String(propiedad || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patrones = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nombre}["']`, 'i')
  ];
  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match && match[1]) return match[1].replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').trim();
  }
  return '';
}

function datosEstructuradosMercadoLibreDesdeHtml(html) {
  const scripts = String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const buscarProducto = (valor) => {
    if (!valor || typeof valor !== 'object') return null;
    if (String(valor['@type'] || '').toLowerCase() === 'product' && valor.offers) return valor;
    for (const clave of Object.keys(valor)) {
      const hallazgo = buscarProducto(valor[clave]);
      if (hallazgo) return hallazgo;
    }
    return null;
  };
  for (const script of scripts) {
    try {
      const producto = buscarProducto(JSON.parse(script[1]));
      if (!producto) continue;
      const oferta = Array.isArray(producto.offers) ? producto.offers[0] : producto.offers;
      const precioArs = Number(oferta && (oferta.price || oferta.lowPrice)) || 0;
      if (precioArs <= 0) continue;
      return {
        ficha:normalizarFicha({ nombre:producto.name || '', marca:typeof producto.brand === 'string' ? producto.brand : producto.brand && producto.brand.name || '', detalle:producto.description || '', imagenUrl:typeof producto.image === 'string' ? producto.image : Array.isArray(producto.image) ? (typeof producto.image[0] === 'string' ? producto.image[0] : producto.image[0] && producto.image[0].url) : producto.image && producto.image.url, fuente:'producto_jsonld' }),
        precioArs,
        titulo:String(producto.name || '').trim(),
        moneda:String(oferta && oferta.priceCurrency || 'ARS').toUpperCase(),
        disponibilidad:/instock/i.test(String(oferta && oferta.availability || '')) ? 'disponible' : 'no_verificado',
        catalogProductId:String(producto.productID || producto.sku || '').toUpperCase()
      };
    } catch (_) {}
  }
  return null;
}

async function extraerProductoMercadoLibreSeo(urlExacta) {
  const agentesSeo = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Googlebot/2.1 (+http://www.google.com/bot.html)'
  ];
  let ultimoError = null;
  for (const userAgent of agentesSeo) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(normalizarUrl(urlExacta), {
        headers: {
          accept:'text/html,application/xhtml+xml',
          'accept-language':'es-AR,es;q=0.9',
          // Los agentes de vista previa reciben los metadatos públicos de la
          // ficha sin necesitar la sesión de compra del usuario.
          'user-agent':userAgent
        },
        redirect:'follow',
        signal:controller.signal
      });
      if (!response.ok) throw new Error(`La página de Mercado Libre respondió ${response.status}`);
      const html = await response.text();
      if (/captcha|comprobemos que eres humano|verificaci[oó]n de seguridad|account-verification/i.test(html)) {
        throw new Error('Mercado Libre solicitó una verificación de seguridad');
      }
      if (/publicaci[oó]n pausada|publicaci[oó]n finalizada|producto no disponible/i.test(html)) {
        throw new Error('La publicación de Mercado Libre no está disponible');
      }
      const tituloOg = metaMercadoLibreDesdeHtml(html, 'og:title');
      const estructurado = datosEstructuradosMercadoLibreDesdeHtml(html);
      const precioOg = precioMercadoLibreDesdeOgTitle(tituloOg);
      const precioArs = precioOg || Number(estructurado && estructurado.precioArs) || 0;
      if (!precioArs) throw new Error('La ficha SEO no informó un precio vigente');
      return {
        precioArs,
        precioActualArs:precioArs,
        precioOriginalArs:precioArs,
        enPromocion:false,
        porcentajeDescuento:0,
        disponibilidad:estructurado && estructurado.disponibilidad === 'disponible'
          ? 'disponible'
          : (/stock disponible|comprar ahora|agregar al carrito/i.test(html) ? 'disponible' : extraerDisponibilidadProveedor(html)),
        titulo:(estructurado && estructurado.titulo) || tituloOg.replace(/\s[-–—]\s*\$\s*[\d.,]+\s*$/, '').trim(),
        moneda:(estructurado && estructurado.moneda) || metaMercadoLibreDesdeHtml(html, 'product:price:currency') || 'ARS',
        catalogProductId:estructurado && estructurado.catalogProductId || '',
        ficha:normalizarFicha({ ...(estructurado && estructurado.ficha || {}), nombre:estructurado && estructurado.titulo || tituloOg.replace(/\s[-–—]\s*\$\s*[\d.,]+\s*$/, '').trim(), detalle:estructurado && estructurado.ficha && estructurado.ficha.detalle || metaMercadoLibreDesdeHtml(html, 'og:description'), imagenUrl:estructurado && estructurado.ficha && estructurado.ficha.imagenUrl || metaMercadoLibreDesdeHtml(html, 'og:image'), fuente:'mercado_libre_seo' }, urlExacta),
        fuente:'mercado_libre_seo',
        selectorPrecio:precioOg ? 'meta[property="og:title"]' : 'script[type="application/ld+json"]'
      };
    } catch (error) {
      ultimoError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoError || new Error('La ficha SEO no informó un precio vigente');
}

async function extraerProductoMercadoLibre(page) {
  // En las fichas actuales el SEO de Mercado Libre ya contiene el precio
  // vigente en la respuesta inicial. Priorizarlo evita esperar el DOM de
  // compra, que a veces se demora o se entrega reducido a automatizaciones.
  const ogTitle = await page.locator('meta[property="og:title"]').first().getAttribute('content').catch(() => '');
  const precioOpenGraph = precioMercadoLibreDesdeOgTitle(ogTitle);
  if (precioOpenGraph > 0) {
    const textoInicial = await page.locator('body').innerText({ timeout:4000 }).catch(() => '');
    if (/captcha|comprobemos que eres humano|verificaci[oó]n de seguridad/i.test(textoInicial)) throw new Error('Mercado Libre solicitó una verificación de seguridad');
    if (/publicaci[oó]n pausada|publicaci[oó]n finalizada|producto no disponible/i.test(textoInicial)) throw new Error('La publicación de Mercado Libre no está disponible');
    const tituloOg = String(ogTitle || '').replace(/\s[-–—]\s*\$\s*[\d.,]+\s*$/, '').trim();
    return {
      precioArs:precioOpenGraph,
      disponibilidad:/stock disponible|cantidad:\s*\d+|comprar ahora|agregar al carrito/i.test(textoInicial) ? 'disponible' : extraerDisponibilidadProveedor(textoInicial),
      titulo:tituloOg,
      moneda:'ARS',
      fuente:'mercado_libre_pagina',
      selectorPrecio:'meta[property="og:title"]'
    };
  }
  const bodyText = await page.locator('body').innerText({ timeout:10000 });
  if (/captcha|comprobemos que eres humano|verificaci[oó]n de seguridad/i.test(bodyText)) throw new Error('Mercado Libre solicitó una verificación de seguridad');
  if (/publicaci[oó]n pausada|publicaci[oó]n finalizada|producto no disponible/i.test(bodyText)) throw new Error('La publicación de Mercado Libre no está disponible');
  const selectoresPrecio = [
    '.ui-pdp-price__main-container .andes-money-amount',
    '.ui-pdp-price__second-line .andes-money-amount',
    '.ui-pdp-container__row--price .andes-money-amount',
    '[data-testid="price-part"] .andes-money-amount',
    '[itemprop="offers"].andes-money-amount',
    '.ui-pdp-price__part.andes-money-amount',
    // Algunas fichas nuevas dibujan el importe como imagen accesible
    // (alt="5399 pesos") y no exponen el nodo andes-money-amount.
    'main img[alt*="pesos" i], main [aria-label*="pesos" i]'
  ];
  await page.locator(selectoresPrecio.join(', ')).first().waitFor({ state:'attached', timeout:12000 }).catch(() => {});
  let precioArs = 0;
  let selectorPrecio = '';
  for (const selector of selectoresPrecio) {
    const candidatos = page.locator(selector);
    const cantidad = Math.min(await candidatos.count().catch(() => 0), 8);
    for (let i = 0; i < cantidad; i += 1) {
      const candidato = candidatos.nth(i);
      if (!await candidato.isVisible().catch(() => false)) continue;
      precioArs = await candidato.evaluate((el) => {
        const fraccion = el.querySelector('.andes-money-amount__fraction');
        const centavos = el.querySelector('.andes-money-amount__cents');
        const entero = String(fraccion ? fraccion.textContent : '').replace(/[^0-9]/g, '');
        const decimal = String(centavos ? centavos.textContent : '').replace(/[^0-9]/g, '').slice(0, 2);
        if (entero) return Number(entero + (decimal ? '.' + decimal : ''));
        const texto = String(el.getAttribute('aria-label') || el.getAttribute('alt') || el.textContent || '');
        const match = texto.match(/([\d][\d.,\s]*)\s*pesos/i);
        if (!match) return 0;
        const valor = match[1].replace(/\s/g, '');
        if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(valor)) return Number(valor.replace(/\./g, '').replace(',', '.'));
        return Number(valor.replace(/,/g, '')) || 0;
      }).catch(() => 0);
      if (precioArs > 0) {
        selectorPrecio = selector;
        break;
      }
    }
    if (precioArs > 0) break;
  }
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
  if (!precioArs) {
    // Las fichas actuales de Mercado Libre siempre publican el precio vigente
    // en og:title ("Producto - $ 5.399"), aun cuando el DOM de compra se
    // entregue de forma reducida a un navegador automatizado. Es un respaldo
    // público, acotado a la ficha principal y no a precios de sugerencias.
    precioArs = precioMercadoLibreDesdeOgTitle(await page.locator('meta[property="og:title"]').first().getAttribute('content').catch(() => ''));
    if (precioArs > 0) {
      selectorPrecio = 'meta[property="og:title"]';
    }
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
  return { precioArs, disponibilidad, titulo:titulo || (schema && schema.name) || '', moneda:moneda || 'ARS', fuente:'mercado_libre_pagina', selectorPrecio };
}

function respuestaRevisionIdentidadMercadoLibre({ proveedor, urlExacta, codigo, producto, datos, identidad, trace, debug }) {
  const precioCandidatoArs = Number(datos && (datos.precioActualArs || datos.precioArs)) || 0;
  const diagnosticoMercadoLibre = datos && datos.diagnosticoMercadoLibre || undefined;
  return {
    ok:false,
    error:false,
    codigo:'PRODUCT_IDENTITY_REQUIRES_CONFIRMATION',
    requiereConfirmacionIdentidad:true,
    mensaje:'Mercado Libre informó un precio, pero no permitió comprobar automáticamente que la publicación corresponda al producto. Abrí la página y confirmalo antes de actualizar.',
    motivoIdentidad:identidad && identidad.mensaje || 'No se pudo verificar el título del producto',
    proveedor:proveedor && proveedor.nombre || 'MERCADO LIBRE',
    codigoProducto:codigo || '',
    producto:producto || '',
    productoEncontrado:String(datos && datos.titulo || ''),
    url:urlExacta,
    urlConfirmacion:urlExacta,
    precioCandidatoArs,
    precioActualArs:precioCandidatoArs,
    precioOriginalArs:Number(datos && datos.precioOriginalArs) || precioCandidatoArs,
    moneda:String(datos && datos.moneda || 'ARS'),
    disponibilidadProveedor:datos && datos.disponibilidad || 'no_verificado',
    disponibilidadProveedorTexto:datos && datos.disponibilidad === 'disponible' ? 'Disponible' : datos && datos.disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
    fuente:datos && datos.fuente || 'mercado_libre_revision_manual',
    diagnosticoMercadoLibre,
    identidad:identidad || { ok:false, confianza:0 },
    debug:debug ? { trace:trace || [], titulo:String(datos && datos.titulo || ''), fuente:datos && datos.fuente || '', diagnosticoMercadoLibre, identidad:identidad || null } : undefined
  };
}

async function cotizarMercadoLibre({ proveedor, url, codigo, producto, debug, confirmarIdentidadManual, incluirFicha = false, altaProducto = false }) {
  const urlExacta = normalizarUrl(url);
  if (!esUrlMercadoLibre(urlExacta)) throw new Error('La URL no corresponde a Mercado Libre Argentina');
  const trace = [{ step:'mercado_libre_inicio', at:new Date().toISOString(), urlExacta }];
  let browser = null, context = null;
  try {
    let datos = await extraerProductoMercadoLibreApi(urlExacta, trace).catch((errorApi) => {
      trace.push({ step:'mercado_libre_api_sin_resultado', at:new Date().toISOString(), mensaje:errorApi.message || String(errorApi) });
      return null;
    });
    if (!datos) {
      datos = await extraerProductoMercadoLibreSeo(urlExacta).catch((errorSeo) => {
        trace.push({ step:'mercado_libre_respaldo_seo_sin_resultado', at:new Date().toISOString(), mensaje:errorSeo.message || String(errorSeo) });
        return null;
      });
      if (datos) trace.push({ step:'mercado_libre_respaldo_seo_ok', at:new Date().toISOString(), precioArs:datos.precioArs });
    }
    if (!datos) {
      trace.push({ step:'mercado_libre_respaldo_visual', at:new Date().toISOString() });
      browser = await chromium.launch({ headless:true });
      context = await browser.newContext({
        locale:'es-AR',
        timezoneId:'America/Argentina/Buenos_Aires',
        userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        extraHTTPHeaders:{ 'accept-language':'es-AR,es;q=0.9' }
      });
      if (incluirFicha) await protegerNavegacionFicha(context, 'mercado_libre');
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(20000);
      // El respaldo Open Graph llega en la respuesta inicial; no esperar la
      // hidratación completa de Mercado Libre evita demoras por cada artículo.
      await page.goto(urlExacta, { waitUntil:'commit', timeout:15000 });
      if (!esDestinoMercadoLibreArgentina(page.url())) throw new Error('La URL redirigió fuera de Mercado Libre Argentina');
      // Una URL histórica puede redirigir a un catálogo actual. Reintentar la
      // API con la URL final conserva catalogo + item_id antes de leer el DOM.
      datos = await extraerProductoMercadoLibreApi(page.url(), trace).catch(() => null);
      if (!datos) datos = await extraerProductoMercadoLibre(page);
      if (incluirFicha) datos.ficha = await extraerFichaPagina(page);
      trace.push({ step:'mercado_libre_respaldo_visual_ok', at:new Date().toISOString(), precioArs:datos.precioArs, selectorPrecio:datos.selectorPrecio || '' });
    }
    const ids = idsMercadoLibreDesdeUrl(urlExacta);
    const itemExacto = String(datos.itemId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const catalogoExacto = String(datos.catalogProductId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    // La API oficial puede omitir title en algunos resultados de catálogo. Si
    // la URL trajo a la vez catálogo + wid y ambos coinciden con el item
    // consultado, esa referencia oficial es una validación de identidad más
    // fuerte que un título inexistente; no se debe descartar su precio válido.
    let identidad = !datos.titulo && ids.itemId && ids.productoId &&
      itemExacto === ids.itemId && catalogoExacto === ids.productoId
      ? { ok:true, confianza:1, metodo:'mercado_libre_wid_catalogo' }
      : identidadAlta(producto, datos.titulo, altaProducto, validarIdentidadProducto);
    if (!identidad.ok) {
      if (!confirmarIdentidadManual) {
        trace.push({ step:'mercado_libre_identidad_requiere_confirmacion', at:new Date().toISOString(), mensaje:identidad.mensaje || '' });
        return respuestaRevisionIdentidadMercadoLibre({ proveedor, urlExacta, codigo, producto, datos, identidad, trace, debug });
      }
      identidad = {
        ok:true,
        confianza:1,
        metodo:'confirmacion_manual_usuario',
        manual:true,
        motivoOriginal:identidad.mensaje || ''
      };
    }
    trace.push({ step:'mercado_libre_validado', at:new Date().toISOString(), precioArs:datos.precioArs, itemId:datos.itemId || '', metodo:identidad.metodo || 'titulo' });
    const diagnosticoMercadoLibre = datos.diagnosticoMercadoLibre || {
      catalogProductId:ids.productoId || '', wid:ids.itemId || '', itemIdUtilizado:datos.itemId || '',
      precioObtenidoPorApi:datos.precioActualArs || datos.precioArs || 0,
      precioOriginalArs:datos.precioOriginalArs || datos.precioArs || 0,
      enPromocion:!!datos.enPromocion, porcentajeDescuento:Number(datos.porcentajeDescuento) || 0,
      causaFallo:datos.fuente === 'mercado_libre_pagina' ? 'API oficial sin resultado; se usó respaldo visual' : ''
    };
    const ficha = incluirFicha ? normalizarFicha({ ...(datos.ficha || {}), nombre: datos.titulo || (datos.ficha && datos.ficha.nombre) || '' }, urlExacta) : undefined;
    return { ficha, ok:true, proveedor:proveedor.nombre || 'MERCADO LIBRE', codigo:codigo || '', producto:datos.titulo || producto || '', url:urlExacta, precioArs:datos.precioArs, precioActualArs:datos.precioActualArs || datos.precioArs, precioOriginalArs:datos.precioOriginalArs || datos.precioArs, enPromocion:!!datos.enPromocion, porcentajeDescuento:Number(datos.porcentajeDescuento) || 0, sinIva:false, ivaAlicuota:21, disponibilidadProveedor:datos.disponibilidad, disponibilidadProveedorTexto:datos.disponibilidad === 'disponible' ? 'Disponible' : datos.disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado', fuente:datos.fuente || 'mercado_libre_url_exacta', fecha:new Date().toISOString(), tituloProveedor:datos.titulo, urlFinal:urlExacta, textoPrecio:`ARS ${datos.precioArs}`, selectorPrecio:datos.fuente || 'mercado_libre', moneda:datos.moneda || 'ARS', identidad, diagnosticoMercadoLibre, debug:debug ? { trace, titulo:datos.titulo, fuente:datos.fuente || '', itemId:datos.itemId || '', diagnosticoMercadoLibre, identidad } : undefined };
  } catch (error) {
    error.trace = trace.concat([{ step:'mercado_libre_error', at:new Date().toISOString(), mensaje:error.message || String(error) }]);
    throw error;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

function parsePrecioArs(texto) {
  const s = String(texto || '');
  const matches = [...s.matchAll(/\$\s*([0-9][0-9.,\s]*)/g)];
  const valores = matches.map((m) => {
    let token = String(m[1] || '').replace(/\s/g, '').replace(/[.,]+$/, '');
    if (!token) return 0;
    const ultimaComa = token.lastIndexOf(',');
    const ultimoPunto = token.lastIndexOf('.');
    let separadorDecimal = '';

    if (ultimaComa >= 0 && ultimoPunto >= 0) {
      separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
    } else if (ultimaComa >= 0) {
      const decimales = token.length - ultimaComa - 1;
      if (decimales > 0 && decimales <= 2) separadorDecimal = ',';
    } else if (ultimoPunto >= 0) {
      const decimales = token.length - ultimoPunto - 1;
      const cantidadPuntos = (token.match(/\./g) || []).length;
      if (decimales > 0 && decimales <= 2 && cantidadPuntos === 1) separadorDecimal = '.';
    }

    if (!separadorDecimal) return parseFloat(token.replace(/[.,]/g, '')) || 0;
    const posicionDecimal = token.lastIndexOf(separadorDecimal);
    const entero = token.slice(0, posicionDecimal).replace(/[.,]/g, '');
    const decimal = token.slice(posicionDecimal + 1).replace(/[.,]/g, '');
    return parseFloat(`${entero || '0'}.${decimal || '0'}`) || 0;
  }).filter((n) => n > 0 && Number.isFinite(n));
  return valores.length ? valores[0] : 0;
}

function normalizarIdentidadProducto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\bPACK\s*(?:DE\s*)?X?\s*(\d+)\b/g, ' PACK$1 ')
    .replace(/\b(\d+)\s*[- ]*\s*PACK\b/g, ' PACK$1 ')
    .replace(/\bX\s*(\d+)\b/g, ' PACK$1 ')
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
  if (solicitado === titulo) return { ok:true, confianza:1 };

  const pedidos = [...new Set(tokensIdentidadProducto(solicitado))];
  const vistos = [...new Set(tokensIdentidadProducto(titulo))];
  const modelosPedidos = pedidos.filter((token) => /[A-Z]/.test(token) && /[0-9]/.test(token) && token.length >= 2);
  const modelosVistos = vistos.filter((token) => /[A-Z]/.test(token) && /[0-9]/.test(token) && token.length >= 2);
  const modelosFaltantes = modelosPedidos.filter((modelo) => !modelosVistos.includes(modelo));
  if (modelosFaltantes.length) {
    return {
      ok:false,
      confianza:0,
      coincidencias:[],
      mensaje:`El modelo o especificación no coincide (${modelosFaltantes.join(', ')})`
    };
  }

  const palabrasGenericas = new Set([
    'ACCESORIO', 'ALARMA', 'AMPLIFICADOR', 'BALUN', 'CABLE', 'CAMARA', 'CARGADOR',
    'CONTROL', 'CONVERSOR', 'DETECTOR', 'DISPOSITIVO', 'EXTENSOR', 'FUENTE',
    'INTERFAZ', 'KIT', 'MODULO', 'PANEL', 'PRODUCTO', 'RECEPTOR', 'SENSOR',
    'SISTEMA', 'SOPORTE', 'SWITCH', 'SWITCHING', 'TRANSMISOR', 'UNIDAD', 'VIDEO'
  ]);
  const distintivasPedidos = pedidos.filter((token) => /^[A-Z]+$/.test(token) && token.length >= 4 && !palabrasGenericas.has(token));
  const distintivasVistas = vistos.filter((token) => /^[A-Z]+$/.test(token) && token.length >= 4 && !palabrasGenericas.has(token));
  if (distintivasPedidos.length && distintivasVistas.length &&
      !distintivasPedidos.some((token) => distintivasVistas.includes(token))) {
    return {
      ok:false,
      confianza:0,
      coincidencias:[],
      mensaje:'La marca o característica principal no coincide con el producto solicitado'
    };
  }

  const comunes = pedidos.filter((tokenPedido) => {
    return vistos.some((tokenVisto) => tokenPedido === tokenVisto ||
      (tokenPedido.length >= 5 && tokenVisto.length >= 5 &&
        (tokenPedido.includes(tokenVisto) || tokenVisto.includes(tokenPedido))));
  });
  const modeloCoincidente = modelosPedidos.length > 0 && modelosPedidos.every((modelo) => vistos.includes(modelo));
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
    /(?:precio\s*(?:gremio|especial|web|contado|lista|sin\s+iva)?|contado|mayorista)[^\n\r$]{0,90}\$\s*([0-9][0-9.,\s]*)/i,
    /\$\s*([0-9][0-9.,\s]*?)\s*(?:\+\s*IVA|sin\s+IVA|impuestos?\s+incluidos?)/i
  ];
  for (const patron of patrones) {
    const coincidencia = body.match(patron);
    if (coincidencia) return parsePrecioArs(`$ ${coincidencia[1]}`);
  }
  return 0;
}

function extraerCondicionIva(texto) {
  const body = String(texto || '');
  const patronesAlicuota = [
    /IVA\s*[:(]?\s*([0-9]{1,2}(?:[.,][0-9]{1,2})?)\s*%/i,
    /([0-9]{1,2}(?:[.,][0-9]{1,2})?)\s*%\s*(?:de\s*)?IVA/i
  ];
  let ivaAlicuota = null;
  for (const patron of patronesAlicuota) {
    const coincidencia = body.match(patron);
    if (!coincidencia) continue;
    const valor = Number(String(coincidencia[1]).replace(',', '.'));
    if (Number.isFinite(valor) && valor >= 0 && valor <= 100) {
      ivaAlicuota = Math.round(valor * 100) / 100;
      break;
    }
  }
  const declaraSinIva = /precio\s+sin\s+iva|\+\s*iva|sin\s+iva/i.test(body);
  const declaraIncluido = /iva\s+incluido|impuestos?\s+incluidos?|precio\s+final(?:es)?\s+en\s+pesos/i.test(body);
  return {
    sinIva: declaraSinIva ? true : (declaraIncluido ? false : null),
    ivaAlicuota
  };
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
      codigo:'PRICE_VARIATION_REQUIRES_APPROVAL',
      precioAnteriorArs:anterior,
      precioCandidatoArs:nuevo,
      relacion,
      mensaje:`Precio bloqueado por variación anormal: anterior ARS ${anterior.toFixed(2)}, recibido ARS ${nuevo.toFixed(2)}`
    };
  }
  return { ok:true };
}

function validarResultadoPrecioIndividual(resultado, precioAnterior) {
  const validacion = validarSaltoPrecio(resultado && resultado.precioArs, precioAnterior);
  if (!validacion.ok) {
    const error = new Error(validacion.mensaje);
    Object.assign(error, validacion);
    throw error;
  }
  return resultado;
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

  // Estas tiendas mantienen conexiones de analítica abiertas y muchas veces
  // nunca alcanzan networkidle. DOM + una pausa breve es la señal útil.
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);

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

function extraerDisponibilidadFreeElectron(textoProductoPrincipal) {
  const principal = normalizarTexto(textoProductoPrincipal);
  if (!principal) return 'no_verificado';
  if (/sin\s+stock|agotado|no\s+disponible|fuera\s+de\s+stock/.test(principal)) return 'sin_stock';
  // Free Electron sólo agrega el cartel "Sin Stock" al artículo agotado. Si
  // la ficha principal existe con su referencia/precio y no contiene ese
  // cartel, el producto está publicado con stock.
  if (/referencia|impuestos\s+incluidos|consultar\s+disponibilidad/.test(principal)) return 'disponible';
  return 'no_verificado';
}

async function extraerDisponibilidadPaginaProveedor(page, tipo, bodyText) {
  if (tipo !== 'free_electron') return extraerDisponibilidadProveedor(bodyText);
  const textoPrincipal = await page.locator('.main-product-wrapper').first().innerText({ timeout:3000 }).catch(() => '');
  const disponibilidadPrincipal = extraerDisponibilidadFreeElectron(textoPrincipal);
  if (disponibilidadPrincipal !== 'no_verificado') return disponibilidadPrincipal;
  // La plantilla autenticada puede no conservar la clase del contenedor. El
  // encabezado del carrusel es el límite semántico estable de la ficha.
  const fichaSinRelacionados = String(bodyText || '').split(/\d+\s+otros\s+productos\s+en\s+la\s+misma\s+categor[ií]a\s*:/i)[0];
  return extraerDisponibilidadFreeElectron(fichaSinRelacionados);
}

const SESION_PROVEEDOR_TTL_MS = 15 * 60 * 1000;
const sesionesProveedorManual = new Map();

function claveSesionProveedorManual(proveedorKey, tipo) {
  return `${tipo}:${String(proveedorKey || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function respuestaRevisionIdentidadProveedor({ proveedor, urlExacta, codigo, producto, datos, identidad, trace, debug }) {
  const precioCandidatoArs = Number(datos && datos.precioArs) || 0;
  return {
    ok:false, error:false, codigo:'PRODUCT_IDENTITY_REQUIRES_CONFIRMATION',
    requiereConfirmacionIdentidad:true,
    mensaje:'El proveedor informó un precio, pero el nombre publicado requiere confirmación humana.',
    motivoIdentidad:identidad && identidad.mensaje || 'No se pudo verificar automáticamente la identidad del producto',
    proveedor:proveedor && proveedor.nombre || 'PROVEEDOR', codigoProducto:codigo || '',
    producto:producto || '', productoEncontrado:String(datos && datos.tituloProveedor || ''),
    tituloProveedor:String(datos && datos.tituloProveedor || ''), url:urlExacta, urlConfirmacion:urlExacta,
    precioCandidatoArs, precioActualArs:precioCandidatoArs, moneda:String(datos && datos.moneda || 'ARS'),
    disponibilidadProveedor:datos && datos.disponibilidadProveedor || 'no_verificado',
    disponibilidadProveedorTexto:datos && datos.disponibilidadProveedorTexto || 'No verificado',
    fuente:datos && datos.fuente || 'proveedor_revision_manual', sinIva:datos && datos.sinIva,
    ivaAlicuota:datos && datos.ivaAlicuota, identidad:identidad || { ok:false, confianza:0 },
    debug:debug ? { trace:trace || [], tituloProveedor:String(datos && datos.tituloProveedor || ''), identidad:identidad || null } : undefined
  };
}

function firmaCredencialesProveedor(usuario, password) {
  return crypto.createHash('sha256').update(`${usuario}\u0000${password}`).digest('hex');
}

function sesionProveedorManualVigente(clave, firma) {
  const sesion = sesionesProveedorManual.get(clave);
  if (!sesion || sesion.expiraEn <= Date.now() || sesion.firma !== firma) {
    sesionesProveedorManual.delete(clave);
    return null;
  }
  return sesion;
}

async function cotizarProveedorConLogin({ proveedor, proveedorKey, url, codigo, producto, debug, tipo, confirmarIdentidadManual, incluirFicha = false, altaProducto = false }) {
  const trace = [];
  const addTrace = (step, data = {}) => trace.push({ step, at:new Date().toISOString(), ...data });
  let browser = null;
  let context = null;
  try {
    const usuario = proveedor.usuario || proveedor.user || proveedor.email || '';
    const password = proveedor.password || proveedor.pass || proveedor.clave || '';
    if (!usuario || !password) throw new Error('El proveedor no tiene usuario y contraseña cargados');
    const claveSesion = claveSesionProveedorManual(proveedorKey, tipo);
    const firmaCredenciales = firmaCredencialesProveedor(usuario, password);
    let sesionGuardada = sesionProveedorManualVigente(claveSesion, firmaCredenciales);
    const urlExacta = normalizarUrl(url);
    if (/large_default|\.jpe?g(?:\?|$)|\.png(?:\?|$)|\.webp(?:\?|$)/i.test(urlExacta)) {
      throw new Error('La URL cargada corresponde a una imagen. Cambiala por la página exacta del producto');
    }
    browser = await chromium.launch({ headless:true });
    context = await browser.newContext({
      locale:'es-AR',
      timezoneId:'America/Argentina/Buenos_Aires',
      ...(sesionGuardada ? { storageState:sesionGuardada.storageState } : {})
    });
    if (incluirFicha) await protegerNavegacionFicha(context, tipo);
    const page = await context.newPage();
    async function iniciarSesionProveedor() {
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
      await page.waitForLoadState('domcontentloaded', { timeout:5000 }).catch(() => {});
      await page.waitForTimeout(500);
      addTrace('sesion_iniciada', { urlActual:page.url() });
      const storageState = await context.storageState();
      sesionesProveedorManual.set(claveSesion, {
        storageState,
        firma:firmaCredenciales,
        expiraEn:Date.now() + SESION_PROVEEDOR_TTL_MS
      });
    }
    if (sesionGuardada) addTrace('sesion_reutilizada', { tipo, expiraEn:new Date(sesionGuardada.expiraEn).toISOString() });
    else await iniciarSesionProveedor();
    await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:30000 });
    await page.waitForTimeout(350);
    const dominioFinal = new URL(page.url()).hostname.toLowerCase();
    const dominioValido = tipo === 'free_electron'
      ? /(^|\.)free-electron\.com\.ar$/.test(dominioFinal)
      : /(^|\.)tecnoprices\.com$/.test(dominioFinal);
    if (!dominioValido) throw new Error('La página redirigió fuera del proveedor esperado');
    let bodyText = await page.locator('body').innerText({ timeout:15000 });
    if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios|usuario.*clave/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
      if (!sesionGuardada) throw new Error('No se pudo iniciar sesión o la cuenta no permite ver precios');
      sesionesProveedorManual.delete(claveSesion);
      sesionGuardada = null;
      addTrace('sesion_cache_expirada', { tipo });
      await iniciarSesionProveedor();
      await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:30000 });
      await page.waitForTimeout(350);
      bodyText = await page.locator('body').innerText({ timeout:15000 });
      if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('No se pudo iniciar sesión o la cuenta no permite ver precios');
    }
    const evidenciaPrecio = await extraerPrecioPaginaProveedor(page, tipo, bodyText);
    const precioArs = evidenciaPrecio.precioArs;
    const disponibilidad = await extraerDisponibilidadPaginaProveedor(page, tipo, bodyText);
    const condicionIva = extraerCondicionIva(bodyText);
    const tituloProveedor = await tituloVisibleProducto(page, tipo);
    const ficha = incluirFicha ? await extraerFichaPagina(page) : undefined;
    let identidad = identidadAlta(producto, tituloProveedor, altaProducto, validarIdentidadProducto);
    const datosResultado = {
      ok:true, proveedor:proveedor.nombre || (tipo === 'free_electron' ? 'FREE ELECTRON' : 'TECNOPRICES'),
      codigo:codigo || '', producto:producto || await page.title().catch(() => ''), url:urlExacta,
      precioArs,
      sinIva:condicionIva.sinIva == null ? tipo === 'tecnoprices' : condicionIva.sinIva,
      ivaAlicuota:condicionIva.ivaAlicuota,
      disponibilidadProveedor:disponibilidad,
      disponibilidadProveedorTexto:disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
      fuente:tipo + '_login_url_exacta', fecha:new Date().toISOString(),
      tituloProveedor,
      ficha,
      urlFinal:page.url(),
      textoPrecio:evidenciaPrecio.textoPrecio,
      selectorPrecio:evidenciaPrecio.selectorPrecio,
      moneda:evidenciaPrecio.moneda,
      identidad,
      debug:debug ? { trace, tituloProveedor, evidenciaPrecio, identidad } : undefined
    };
    if (!identidad.ok && !confirmarIdentidadManual) {
      addTrace('identidad_requiere_confirmacion', { tituloProveedor, mensaje:identidad.mensaje || '' });
      return respuestaRevisionIdentidadProveedor({ proveedor, urlExacta, codigo, producto, datos:datosResultado, identidad, trace, debug });
    }
    if (!identidad.ok) {
      identidad = { ok:true, confianza:1, metodo:'confirmacion_manual_usuario', manual:true, motivoOriginal:identidad.mensaje || '' };
      datosResultado.identidad = identidad;
      if (datosResultado.debug) datosResultado.debug.identidad = identidad;
    }
    return datosResultado;
  } catch (e) {
    e.trace = trace;
    throw e;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function cotizarBiosegur({ proveedor, url, codigo, producto, debug, confirmarIdentidadManual, incluirFicha = false, altaProducto = false }) {
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
    if (incluirFicha) await protegerNavegacionFicha(context, 'biosegur');
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
    await page.waitForTimeout(400);
    addTrace('url_producto_abierta', { urlActual: page.url(), titulo: await page.title().catch(() => '') });
    if (!/(^|\.)biosegur\.com\.ar$/.test(new URL(page.url()).hostname.toLowerCase())) {
      throw new Error('La página redirigió fuera de Biosegur');
    }

    const bodyText = await page.locator('body').innerText({ timeout: 15000 });
    if (/el\s+art[ií]culo\s+solicitado\s+no\s+existe|producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) {
      const errorProducto = new Error('El producto ya no existe en Biosegur');
      errorProducto.codigo = 'PRODUCT_NOT_FOUND';
      throw errorProducto;
    }
    addTrace('texto_leido', {
      caracteres: bodyText.length,
      muestra: bodyText.slice(0, 900)
    });
    if (/usuario.*clave|login/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
      throw new Error('La URL exacta abrió sin sesión activa; no se puede leer el precio gremio');
    }

    const precioArs = extraerPrecioBiosegur(bodyText);
    const condicionIva = extraerCondicionIva(bodyText);
    const disponibilidad = extraerDisponibilidadProveedor(bodyText);
    addTrace('precio_extraido', { precioArs });
    if (!precioArs) {
      throw new Error('No se encontró precio visible en la URL exacta luego del login');
    }

    const title = await tituloVisibleProducto(page, 'biosegur');
    const ficha = incluirFicha ? await extraerFichaPagina(page) : undefined;
    let identidad = identidadAlta(producto, title, altaProducto, validarIdentidadProducto);
    const datosResultado = {
      ok: true,
      proveedor: proveedor.nombre || 'BIOSEGUR',
      codigo: codigo || '',
      producto: (typeof producto === 'string' && producto.trim()) ? producto : (title || ''),
      url: urlExacta,
      precioArs,
      sinIva: condicionIva.sinIva == null ? true : condicionIva.sinIva,
      ivaAlicuota: condicionIva.ivaAlicuota,
      precioConIva: Math.round(precioArs * (1 + ((condicionIva.ivaAlicuota == null ? 21 : condicionIva.ivaAlicuota) / 100)) * 100) / 100,
      disponibilidadProveedor: disponibilidad,
      disponibilidadProveedorTexto: disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
      fuente: 'biosegur_login_url_exacta',
      fecha: new Date().toISOString(),
      tituloProveedor:title,
      ficha,
      urlFinal:page.url(),
      textoPrecio:`$ ${precioArs.toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })} + IVA`,
      selectorPrecio:'precio_biosegur_mas_iva',
      moneda:'ARS',
      identidad,
      debug: debug ? { trace, tituloProveedor:title, identidad } : undefined
    };
    if (!identidad.ok && !confirmarIdentidadManual) {
      addTrace('identidad_requiere_confirmacion', { tituloProveedor:title, mensaje:identidad.mensaje || '' });
      return respuestaRevisionIdentidadProveedor({ proveedor, urlExacta, codigo, producto, datos:datosResultado, identidad, trace, debug });
    }
    if (!identidad.ok) {
      identidad = { ok:true, confianza:1, metodo:'confirmacion_manual_usuario', manual:true, motivoOriginal:identidad.mensaje || '' };
      datosResultado.identidad = identidad;
      if (datosResultado.debug) datosResultado.debug.identidad = identidad;
    }
    return datosResultado;
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
      let tituloProveedor = '';
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
        if (/el\s+art[ií]culo\s+solicitado\s+no\s+existe|producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) {
          const errorProducto = new Error('El producto ya no existe en Biosegur');
          errorProducto.codigo = 'PRODUCT_NOT_FOUND';
          throw errorProducto;
        }
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) {
          throw new Error('Producto no encontrado o desactivado en el proveedor');
        }
        if (/usuario.*clave|login/i.test(bodyText) && !/mi cuenta|salir/i.test(bodyText)) {
          throw new Error('La sesión de Biosegur se cerró durante el lote');
        }
        const precioArs = extraerPrecioBiosegur(bodyText);
        const condicionIva = extraerCondicionIva(bodyText);
        const disponibilidad = extraerDisponibilidadProveedor(bodyText);
        if (!precioArs) throw new Error('No se encontró un precio visible');
        tituloProveedor = await tituloVisibleProducto(page, 'biosegur');
        const identidad = validarIdentidadProducto(item.producto || item.nombre || '', tituloProveedor);
        if (!identidad.ok) {
          resultados.push(Object.assign(respuestaRevisionIdentidadProveedor({
            proveedor, urlExacta, codigo:item.codigo || '', producto:item.producto || item.nombre || '',
            datos:{ precioArs, tituloProveedor, moneda:'ARS', sinIva:condicionIva.sinIva == null ? true : condicionIva.sinIva,
              ivaAlicuota:condicionIva.ivaAlicuota, disponibilidadProveedor:disponibilidad,
              disponibilidadProveedorTexto:disponibilidad === 'disponible' ? 'Disponible' : disponibilidad === 'sin_stock' ? 'Sin stock' : 'No verificado',
              fuente:'biosegur_lote_revision_manual' }, identidad, trace:[], debug:false
          }), { codigoProducto:item.codigo || '' }));
          continue;
        }
        const validacionPrecio = validarSaltoPrecio(precioArs, item.precioAnteriorArs);
        if (!validacionPrecio.ok) {
          const errorPrecio = new Error(validacionPrecio.mensaje);
          Object.assign(errorPrecio, validacionPrecio);
          throw errorPrecio;
        }
        resultados.push({
          ok: true,
          proveedor: proveedor.nombre || 'BIOSEGUR',
          codigo: item.codigo || '',
          producto: item.producto || item.nombre || '',
          url: urlExacta,
          precioArs,
          sinIva: condicionIva.sinIva == null ? true : condicionIva.sinIva,
          ivaAlicuota: condicionIva.ivaAlicuota,
          precioConIva: Math.round(precioArs * (1 + ((condicionIva.ivaAlicuota == null ? 21 : condicionIva.ivaAlicuota) / 100)) * 100) / 100,
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
        // Aunque se rechace la identidad, el título leído es evidencia útil para
        // que el usuario pueda corregir el nombre sin volver a buscarlo.
        resultados.push({ ok:false, error:true, codigo:e.codigo || '', codigoProducto:item.codigo || '', url:urlExacta, mensaje:e.message || 'Error leyendo producto', tituloProveedor:String(tituloProveedor || '').trim(), precioAnteriorArs:Number(e.precioAnteriorArs)||0, precioCandidatoArs:Number(e.precioCandidatoArs)||0, relacion:Number(e.relacion)||0 });
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
      let tituloProveedor = '';
      try {
        if (!urlExacta || !dominioEsperado.test(new URL(urlExacta).hostname.toLowerCase())) throw new Error('La URL corresponde a otro proveedor; revisá la vinculación');
        await page.goto(urlExacta, { waitUntil:'domcontentloaded', timeout:15000 });
        if (!dominioEsperado.test(new URL(page.url()).hostname.toLowerCase())) throw new Error('La página redirigió fuera del proveedor esperado');
        const bodyText=await page.locator('body').innerText({ timeout:8000 });
        if (/producto\s+no\s+encontrado|no\s+existe\s+o\s+fue\s+desactivado|p[aá]gina\s+no\s+encontrada|error\s*404/i.test(bodyText)) throw new Error('Producto no encontrado o desactivado en el proveedor');
        if (/iniciar sesi[oó]n para ver precios|ingresar para ver precios/i.test(bodyText)) throw new Error('La sesión no permite ver precios');
        const evidenciaPrecio=await extraerPrecioPaginaProveedor(page,tipo,bodyText);
        const precioArs=evidenciaPrecio.precioArs;
        tituloProveedor=await tituloVisibleProducto(page,tipo);
        const identidad=validarIdentidadProducto(item.producto||item.nombre||'',tituloProveedor);
        if (!identidad.ok) {
          const disponibilidad=await extraerDisponibilidadPaginaProveedor(page,tipo,bodyText);
          const condicionIva=extraerCondicionIva(bodyText);
          resultados.push(Object.assign(respuestaRevisionIdentidadProveedor({
            proveedor, urlExacta, codigo:item.codigo||'', producto:item.producto||item.nombre||'',
            datos:{precioArs,tituloProveedor,moneda:evidenciaPrecio.moneda,sinIva:condicionIva.sinIva==null?tipo==='tecnoprices':condicionIva.sinIva,
              ivaAlicuota:condicionIva.ivaAlicuota,disponibilidadProveedor:disponibilidad,
              disponibilidadProveedorTexto:disponibilidad==='disponible'?'Disponible':disponibilidad==='sin_stock'?'Sin stock':'No verificado',fuente:tipo+'_lote_revision_manual'},
            identidad,trace:[],debug:false
          }),{codigoProducto:item.codigo||''}));
          continue;
        }
        const validacionPrecio=validarSaltoPrecio(precioArs,item.precioAnteriorArs);
        if (!validacionPrecio.ok) {
          const errorPrecio = new Error(validacionPrecio.mensaje);
          Object.assign(errorPrecio, validacionPrecio);
          throw errorPrecio;
        }
        const disponibilidad=await extraerDisponibilidadPaginaProveedor(page,tipo,bodyText);
        const condicionIva=extraerCondicionIva(bodyText);
        resultados.push({ok:true,proveedor:proveedor.nombre||nombreTipo,codigo:item.codigo||'',producto:item.producto||item.nombre||'',url:urlExacta,precioArs,sinIva:condicionIva.sinIva==null?tipo==='tecnoprices':condicionIva.sinIva,ivaAlicuota:condicionIva.ivaAlicuota,disponibilidadProveedor:disponibilidad,disponibilidadProveedorTexto:disponibilidad==='disponible'?'Disponible':disponibilidad==='sin_stock'?'Sin stock':'No verificado',fuente:tipo+'_lote_url_exacta',fecha:new Date().toISOString(),tituloProveedor,urlFinal:page.url(),textoPrecio:evidenciaPrecio.textoPrecio,selectorPrecio:evidenciaPrecio.selectorPrecio,moneda:evidenciaPrecio.moneda,identidad});
      } catch(e) { resultados.push({ok:false,error:true,codigo:e.codigo||'',codigoProducto:item.codigo||'',url:urlExacta,mensaje:e.message||'Error leyendo producto',tituloProveedor:String(tituloProveedor||'').trim(),precioAnteriorArs:Number(e.precioAnteriorArs)||0,precioCandidatoArs:Number(e.precioCandidatoArs)||0,relacion:Number(e.relacion)||0}); }
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
        let errorApiMercadoLibre = null;
        let datos = await extraerProductoMercadoLibreApi(urlExacta).catch((errorApi) => {
          errorApiMercadoLibre = errorApi;
          return null;
        });
        if (!datos) {
          datos = await extraerProductoMercadoLibreSeo(urlExacta).catch((errorSeo) => {
            errorApiMercadoLibre = errorApiMercadoLibre || errorSeo;
            return null;
          });
        }
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
          // La ficha SEO ya contiene título y precio vigente. Esperar el DOM
          // completo vuelve innecesariamente lento el lote cuando la API no
          // está disponible.
          await page.goto(urlExacta, { waitUntil:'commit', timeout:15000 });
          if (!esDestinoMercadoLibreArgentina(page.url())) throw new Error('La URL redirigió fuera de Mercado Libre Argentina');
          // Una publicación vieja puede resolver al catálogo vigente: la API
          // entiende esa URL final y conserva el item_id de los filtros.
          datos = await extraerProductoMercadoLibreApi(page.url()).catch((errorApi) => {
            errorApiMercadoLibre = errorApiMercadoLibre || errorApi;
            return null;
          });
          if (!datos) {
            try {
              datos = await extraerProductoMercadoLibre(page);
            } catch (errorVisual) {
              const diagnosticoApi = errorApiMercadoLibre && errorApiMercadoLibre.diagnosticoMercadoLibre || {};
              errorVisual.diagnosticoMercadoLibre = Object.assign({}, diagnosticoApi, {
                causaFallo:[
                  diagnosticoApi.causaFallo || '',
                  errorApiMercadoLibre ? 'API oficial: ' + (errorApiMercadoLibre.message || String(errorApiMercadoLibre)) : '',
                  'Respaldo visual: ' + (errorVisual.message || String(errorVisual))
                ].filter(Boolean).join(' · ')
              });
              throw errorVisual;
            }
          }
        }
        const identidad = item.confirmarIdentidadManual === true
          ? { ok:true, confianza:1, metodo:'confirmacion_manual_guardada', manual:true }
          : validarIdentidadProducto(item.producto||item.nombre||'', datos.titulo);
        if (!identidad.ok) {
          resultados.push(Object.assign(
            respuestaRevisionIdentidadMercadoLibre({
              proveedor,
              urlExacta,
              codigo:item.codigo||'',
              producto:item.producto||item.nombre||'',
              datos,
              identidad,
              trace:[],
              debug:false
            }),
            { codigoProducto:item.codigo||'' }
          ));
        } else {
          const validacionPrecio = validarSaltoPrecio(datos.precioArs, item.precioAnteriorArs);
          if (!validacionPrecio.ok) {
            const errorPrecio = new Error(validacionPrecio.mensaje);
            Object.assign(errorPrecio, validacionPrecio);
            throw errorPrecio;
          }
          const tituloProveedor = datos.titulo || '';
          resultados.push({ ok:true, proveedor:proveedor.nombre||'MERCADO LIBRE', codigo:item.codigo||'', producto:datos.titulo||item.producto||item.nombre||'', url:urlExacta, precioArs:datos.precioArs, precioActualArs:datos.precioActualArs || datos.precioArs, precioOriginalArs:datos.precioOriginalArs || datos.precioArs, enPromocion:!!datos.enPromocion, porcentajeDescuento:Number(datos.porcentajeDescuento) || 0, sinIva:false, ivaAlicuota:21, disponibilidadProveedor:datos.disponibilidad, disponibilidadProveedorTexto:datos.disponibilidad==='disponible'?'Disponible':datos.disponibilidad==='sin_stock'?'Sin stock':'No verificado', fuente:datos.fuente || 'mercado_libre_lote_url_exacta', fecha:new Date().toISOString(), tituloProveedor, urlFinal:urlExacta, textoPrecio:`ARS ${datos.precioArs}`, selectorPrecio:datos.fuente || 'mercado_libre', moneda:datos.moneda || 'ARS', diagnosticoMercadoLibre:datos.diagnosticoMercadoLibre || undefined, identidad });
        }
      } catch (e) {
        resultados.push({ ok:false, error:true, codigo:e.codigo||'', codigoProducto:item.codigo||'', url:urlExacta, mensaje:e.message||'Error leyendo la publicación', precioAnteriorArs:Number(e.precioAnteriorArs)||0, precioCandidatoArs:Number(e.precioCandidatoArs)||0, relacion:Number(e.relacion)||0, diagnosticoMercadoLibre:e.diagnosticoMercadoLibre || undefined });
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
  const tipoLote = tipoProveedor(proveedor, '');
  if (!tipoLote) {
    const items = Array.isArray(reqBody.items) ? reqBody.items : [];
    if (!items.length || items.length > 4) throw new Error('El lote automático requiere entre 1 y 4 productos');
    const conexion=proveedor.conexionAutomatica || {};
    if (conexion.estado !== 'verificado' || conexion.firma !== firmaAcceso(proveedor)) throw new Error('Verificá nuevamente la conexión del proveedor');
    const resultados=[];
    const jobId=String(reqBody.jobId || '');
    const progreso=/^[\w-]{1,80}$/.test(jobId) ? db.ref('sisventas/procesos/cotizador/' + jobId) : null;
    for (let i=0;i<items.length;i++) {
      const item=items[i];
      if(progreso) await progreso.update({estado:'procesando',proveedor:proveedor.nombre || '',producto:item.producto || '',codigo:item.codigo || '',url:item.url || '',procesados:(Number(reqBody.offset)||0)+i,total:Number(reqBody.total)||items.length,actualizadoEn:Date.now()});
      try {
        const r=await cotizar({...item,proveedorKey,incluirFicha:false,altaProducto:false});
        resultados.push({...r,codigoProducto:item.codigo || '',producto:r.tituloProveedor || item.producto || '',textoPrecio:'ARS ' + r.precioArs});
      } catch(e) { resultados.push({ok:false,url:item.url || '',codigoProducto:item.codigo || '',mensaje:e.message,precioAnteriorArs:Number(e.precioAnteriorArs)||0,precioCandidatoArs:Number(e.precioCandidatoArs)||0,relacion:Number(e.relacion)||0}); }
      if(progreso) await progreso.update({procesados:(Number(reqBody.offset)||0)+i+1,actualizadoEn:Date.now()});
    }
    return {ok:true,proveedor:proveedor.nombre,total:items.length,actualizados:resultados.filter(r=>r.ok).length,fallidos:resultados.filter(r=>!r.ok).length,resultados};
  }
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
  const resultado = await convertirMonedaProveedor(await cotizarSinCondicion(reqBody));
  const proveedor = (await db.ref('sisventas/proveedores/' + String(reqBody.proveedorKey)).get()).val();
  const final = aplicarCondicionComercial(resultado,proveedor && proveedor.condicionComercial);
  return final && final.requiereConfirmacionIdentidad ? final : validarResultadoPrecioIndividual(final,reqBody.precioAnteriorArs);
}

async function cotizarSinCondicion(reqBody) {
  const proveedorKey = String(reqBody.proveedorKey || '').trim();
  const url = reqBody.url || reqBody.urlProducto || '';
  if (!proveedorKey) throw new Error('Falta proveedorKey');
  if (!url) throw new Error('Falta URL exacta del producto');

  const snap = await db.ref(`sisventas/proveedores/${proveedorKey}`).get();
  const proveedor = snap.val();
  if (!proveedor) throw new Error('Proveedor no encontrado en Firebase');
  if (proveedor.activo === false) throw new Error('Proveedor inactivo');

  // La cuenta pertenece al proveedor registrado; la URL no puede cambiar
  // su identidad y enviar sus credenciales a otro comercio.
  const tipo = tipoProveedor(proveedor, '');
  const incluirFicha = reqBody.incluirFicha === true;
  const altaProducto = incluirFicha && reqBody.altaProducto === true;
  if (!tipo) {
    const conexion = proveedor.conexionAutomatica || {};
    if (conexion.estado !== 'verificado' || conexion.firma !== firmaAcceso(proveedor)) throw new Error('Verificá primero la conexión automática del proveedor');
    const resultado = await consultarAutomatico(proveedor,url);
    resultado.identidad = identidadAlta(reqBody.producto || '', resultado.tituloProveedor, altaProducto, validarIdentidadProducto);
    if (!resultado.identidad.ok) throw new Error('La ficha no coincide con el producto solicitado');
    return resultado;
  }
  validarUrlFicha(url, tipo);
  if (tipo === 'biosegur') {
    return cotizarBiosegur({
      proveedor,
      url,
      incluirFicha, altaProducto,
      codigo: reqBody.codigo || '',
      producto: reqBody.producto || '',
      debug: !!reqBody.debug,
      confirmarIdentidadManual:reqBody.confirmarIdentidadManual === true
    }).then((resultado) => resultado && resultado.requiereConfirmacionIdentidad ? resultado : validarResultadoPrecioIndividual(resultado, reqBody.precioAnteriorArs));
  }

  if (tipo === 'free_electron' || tipo === 'tecnoprices') {
    return cotizarProveedorConLogin({ incluirFicha, altaProducto, proveedor, proveedorKey, url, codigo:reqBody.codigo || '', producto:reqBody.producto || '', debug:!!reqBody.debug, tipo, confirmarIdentidadManual:reqBody.confirmarIdentidadManual === true })
      .then((resultado) => resultado && resultado.requiereConfirmacionIdentidad ? resultado : validarResultadoPrecioIndividual(resultado, reqBody.precioAnteriorArs));
  }

  if (tipo === 'mercado_libre') {
    return cotizarMercadoLibre({
      proveedor,
      url,
      incluirFicha, altaProducto,
      codigo:reqBody.codigo || '',
      producto:reqBody.producto || '',
      debug:!!reqBody.debug,
      confirmarIdentidadManual:reqBody.confirmarIdentidadManual === true
    }).then((resultado) => resultado && resultado.requiereConfirmacionIdentidad
      ? resultado
      : validarResultadoPrecioIndividual(resultado, reqBody.precioAnteriorArs));
  }

  throw new Error(`Proveedor no soportado todavía: ${proveedor.nombre || proveedorKey}`);
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const requestUrl = new URL(req.url, 'http://localhost');
  const pathname = requestUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/mercadolibre/oauth/start') {
    try { await iniciarOAuthMercadoLibre(res); }
    catch (e) { sendHtml(res, e.statusCode || 500, `<h1>No se pudo iniciar la conexión</h1><p>${String(e.message || e).replace(/[<>&]/g, '')}</p>`); }
    return;
  }

  if (req.method === 'GET' && pathname === '/mercadolibre/oauth/callback') {
    try { await completarOAuthMercadoLibre(requestUrl, res); }
    catch (e) { sendHtml(res, e.statusCode || 500, `<h1>No se pudo conectar Mercado Libre</h1><p>${String(e.message || e).replace(/[<>&]/g, '')}</p>`); }
    return;
  }

  if (req.method === 'GET' && pathname === '/mercadolibre/oauth/status') {
    send(res, 200, await estadoOAuthMercadoLibre());
    return;
  }

  if (req.method === 'GET' && pathname === '/imagen-producto') {
    try { await servirImagenProducto(requestUrl, req, res); }
    catch (e) {
      console.error('[imagen-producto]', e);
      send(res, 502, { ok:false, error:true, mensaje:'No se pudo recuperar la imagen' });
    }
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
    await autenticarSolicitud(req);
    const body = await readBody(req);
    if (pathname !== '/' && pathname !== '/cotizar' && pathname !== '/biosegur' && pathname !== '/cotizar-lote' && pathname !== '/verificar-proveedor' && pathname !== '/cotizacion-guarani') {
      send(res, 404, { ok: false, error: true, mensaje: 'Ruta no encontrada' });
      return;
    }
    const resultado = pathname === '/cotizacion-guarani' ? {ok:true,cotizacion:await obtenerGuarani(body.forzar===true)} : pathname === '/verificar-proveedor' ? await verificarProveedor(body) : pathname === '/cotizar-lote' ? await cotizarLote(body) : await cotizar(body);
    send(res, 200, resultado);
  } catch (e) {
    console.error('[cotizador]', e);
    send(res, e.statusCode || 200, {
      ok: false,
      error: true,
      codigo: e.codigo || '',
      mensaje: e.message || 'Error cotizando proveedor',
      precioAnteriorArs: Number(e.precioAnteriorArs) || 0,
      precioCandidatoArs: Number(e.precioCandidatoArs) || 0,
      relacion: Number(e.relacion) || 0,
      diagnosticoMercadoLibre: e.diagnosticoMercadoLibre || undefined,
      debug: { trace: e.trace || [] }
    });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Cotizador NIXA listo en puerto ${PORT}`);
  });
}

module.exports = {
  verificarProveedor,
  cotizarLote,
  cotizarBiosegur,
  parsePrecioArs,
  extraerPrecioBiosegur,
  extraerPrecioEtiquetado,
  extraerCondicionIva,
  extraerDisponibilidadFreeElectron,
  idsMercadoLibreDesdeUrl,
  itemIdMercadoLibreDesdeHtml,
  filtrosMercadoLibreDesdeUrl,
  seleccionarPublicacionMercadoLibre,
  seleccionarPublicacionConsensoMercadoLibre,
  datosMercadoLibreDesdeFuente,
  validarIdentidadMercadoLibreOficial,
  respuestaRevisionIdentidadMercadoLibre,
  respuestaRevisionIdentidadProveedor,
  obtenerJsonMercadoLibre,
  estadoOAuthMercadoLibre,
  precioMercadoLibreDesdeOgTitle,
  metaMercadoLibreDesdeHtml,
  datosEstructuradosMercadoLibreDesdeHtml,
  extraerProductoMercadoLibreSeo,
  extraerProductoMercadoLibreApi,
  puntajeProductoMercadoLibre,
  validarIdentidadProducto,
  validarMonedaPrecio,
  validarSaltoPrecio,
  validarResultadoPrecioIndividual,
  extraerTokenBearer,
  cifrarTokenMercadoLibre,
  descifrarTokenMercadoLibre,
  firmarEstadoOAuthMercadoLibre,
  validarEstadoOAuthMercadoLibre,
  origenCorsPermitido,
  urlImagenProductoPermitida
};
