// Datos descriptivos de la misma página utilizada para cotizar. Nunca busca
// otros productos ni usa las instrucciones que pueda contener una página.
const { isIP } = require('node:net');
const dominiosProveedor = { biosegur: /(^|\.)biosegur\.com\.ar$/, free_electron: /(^|\.)free-electron\.com\.ar$/, tecnoprices: /(^|\.)tecnoprices\.com$/, mercado_libre: /(^|\.)(mercadolibre\.com\.ar|meli\.la)$/ };

async function protegerNavegacionFicha(context, tipo) {
  await context.route('**/*', route => {
    const request = route.request();
    if (!request.isNavigationRequest()) return route.continue();
    const url = urlPublica(request.url());
    return url && dominiosProveedor[tipo] && dominiosProveedor[tipo].test(new URL(url).hostname)
      ? route.continue() : route.abort('blockedbyclient');
  });
}

function textoFicha(valor, limite = 12000) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limite);
}

function urlPublica(valor, base) {
  if (!valor || typeof valor !== 'string') return '';
  try {
    const url = new URL(valor, base || undefined);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return '';
    const host = url.hostname.toLowerCase();
    if (isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return '';
    return url.href;
  } catch (_) { return ''; }
}

function normalizarFicha(datos = {}, url = '') {
  const ficha = {
    nombre: textoFicha(datos.nombre, 300),
    marca: textoFicha(datos.marca, 120),
    detalle: textoFicha(datos.detalle),
    imagenUrl: urlPublica(datos.imagenUrl, url),
    urlOrigen: urlPublica(url),
    fuente: textoFicha(datos.fuente, 100) || 'pagina_producto'
  };
  ficha.faltantes = ['nombre', 'marca', 'detalle', 'imagenUrl'].filter(campo => !ficha[campo]);
  return ficha;
}

function fichaDesdeApi(fuente = {}, catalogo = {}) {
  const atributos = [...(Array.isArray(fuente.attributes) ? fuente.attributes : []), ...(Array.isArray(catalogo.attributes) ? catalogo.attributes : [])];
  const marca = atributos.find(a => a && a.id === 'BRAND');
  const fotos = Array.isArray(fuente.pictures) && fuente.pictures.length ? fuente.pictures : (Array.isArray(catalogo.pictures) ? catalogo.pictures : []);
  const foto = fotos[0] || {};
  return normalizarFicha({
    nombre: fuente.title || fuente.name || catalogo.name || '',
    marca: marca && (marca.value_name || '') || '',
    detalle: typeof fuente.description === 'string' ? fuente.description : fuente.description && fuente.description.plain_text || '',
    imagenUrl: foto.secure_url || foto.url || fuente.secure_thumbnail || '',
    fuente: 'api_producto'
  });
}

async function extraerFichaPagina(page) {
  const datos = await page.evaluate(() => {
    const texto = nodo => nodo ? String(nodo.getAttribute('content') || nodo.innerText || nodo.textContent || '').trim() : '';
    const meta = selector => texto(document.querySelector(selector));
    const principal = document.querySelector('[itemtype$="/Product"], #product, .product-detail, .product-info, main') || document;
    const primero = selectores => {
      for (const selector of selectores) {
        const nodo = principal.querySelector(selector);
        if (nodo && texto(nodo)) return texto(nodo);
      }
      return '';
    };
    const productos = [];
    const leer = valor => {
      if (!valor || typeof valor !== 'object') return;
      if (Array.isArray(valor)) { valor.forEach(leer); return; }
      if ([].concat(valor['@type'] || []).some(t => /(^|\/)Product$/i.test(t))) productos.push(valor);
      // No recorrer ItemList, accesorios, recomendaciones ni ofertas ajenas.
      if (valor['@graph']) leer(valor['@graph']);
      if (valor.mainEntity) leer(valor.mainEntity);
    };
    for (const nodo of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { leer(JSON.parse(nodo.textContent)); } catch (_) {}
    }
    const mismaPagina = valor => {
      try { const u = new URL(valor, location.href); return u.origin === location.origin && u.pathname === location.pathname && u.search === location.search; } catch (_) { return false; }
    };
    const tituloVisible = primero(['h1[itemprop="name"]', 'h1']);
    const comparar = valor => String(valor || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const unicoCompatible = productos.length === 1 && (!tituloVisible || comparar(productos[0].name) === comparar(tituloVisible));
    const schema = productos.find(p => mismaPagina(p.url || p['@id'])) || (unicoCompatible ? productos[0] : {}) || {};
    const nombre = tituloVisible || schema.name || meta('meta[property="og:title"]');
    let marca = typeof schema.brand === 'string' ? schema.brand : schema.brand && schema.brand.name || '';
    marca = marca || primero(['.product-code .marca_span', '[itemprop="brand"] [itemprop="name"]', '[itemprop="brand"]', '.product-manufacturer a']);
    if (!marca) {
      for (const fila of principal.querySelectorAll('tr')) {
        const celdas = fila.querySelectorAll('th,td');
        if (celdas.length === 2 && /^marca\s*:?$/i.test(texto(celdas[0]))) { marca = texto(celdas[1]); break; }
      }
    }
    const htmlPlano = valor => { const doc = new DOMParser().parseFromString(String(valor || ''), 'text/html'); doc.querySelectorAll('script,style').forEach(n => n.remove()); return doc.body.textContent || ''; };
    const detalle = schema.description ? htmlPlano(schema.description) : primero(['#Descripción', '[itemprop="description"]', '#description .product-description', '.product-description', '.ui-pdp-description__content']) || meta('meta[property="og:description"],meta[name="description"]');
    const imagenSchema = Array.isArray(schema.image) ? schema.image[0] : schema.image;
    const imagenNodo = principal.querySelector('[itemprop="image"], .product-cover img, .ui-pdp-gallery__figure img');
    const imagenUrl = typeof imagenSchema === 'string' ? imagenSchema : imagenSchema && (imagenSchema.url || imagenSchema.contentUrl) ||
      (imagenNodo && (imagenNodo.getAttribute('content') || imagenNodo.getAttribute('data-image-large-src') || imagenNodo.getAttribute('src'))) || meta('meta[property="og:image"]');
    return { nombre: String(nombre || ''), marca: String(marca || ''), detalle, imagenUrl, fuente: schema.name ? 'producto_jsonld' : 'pagina_producto' };
  });
  return normalizarFicha(datos, page.url());
}

function validarUrlFicha(valor, tipo) {
  const limpia = urlPublica(valor);
  if (!limpia) throw new Error('Ingresá una URL pública exacta del producto, sin credenciales en el enlace');
  const url = new URL(limpia);
  if (!dominiosProveedor[tipo] || !dominiosProveedor[tipo].test(url.hostname)) throw new Error('La URL no corresponde al proveedor seleccionado o todavía no tiene conexión disponible');
  if ((url.pathname === '/' && !url.search) || /\.(?:jpg|jpeg|png|webp|pdf)$/i.test(url.pathname) || /^\/(?:ingresar|login|mi-cuenta|categorias?)\/?$/i.test(url.pathname)) throw new Error('Usá la página exacta del producto, no la web inicial, una categoría o una imagen');
  return limpia;
}

function identidadAlta(producto, titulo, altaProducto, validarIdentidad) {
  if (altaProducto && !String(producto || '').trim()) {
    return textoFicha(titulo, 300) ? { ok: true, metodo: 'alta_desde_url_exacta', requiereRevisionFicha: true } : { ok: false, mensaje: 'La página no informó un nombre de producto' };
  }
  return validarIdentidad(producto, titulo);
}

module.exports = { normalizarFicha, fichaDesdeApi, extraerFichaPagina, validarUrlFicha, identidadAlta, protegerNavegacionFicha };
