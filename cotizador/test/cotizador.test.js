const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.ML_CLIENT_ID = '123456';
process.env.ML_CLIENT_SECRET = 'secreto-de-prueba';
process.env.ML_TOKEN_KEY = 'clave-de-prueba-con-suficiente-entropia';
process.env.ML_REDIRECT_URI = 'https://example.test/mercadolibre/oauth/callback';

const cargarOriginal = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'playwright') return { chromium:{} };
  if (request === 'firebase-admin') {
    return {
      apps:[{}],
      initializeApp:function(){},
      credential:{ applicationDefault:function(){ return {}; } },
      database:function(){ return { ref:function(){ return {}; } }; }
    };
  }
  return cargarOriginal.call(this, request, parent, isMain);
};
const {
  parsePrecioArs,
  extraerPrecioBiosegur,
  extraerPrecioEtiquetado,
  extraerCondicionIva,
  idsMercadoLibreDesdeUrl,
  itemIdMercadoLibreDesdeHtml,
  filtrosMercadoLibreDesdeUrl,
  seleccionarPublicacionMercadoLibre,
  seleccionarPublicacionConsensoMercadoLibre,
  datosMercadoLibreDesdeFuente,
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
  origenCorsPermitido
} = require('../index');
Module._load = cargarOriginal;

test('interpreta formato argentino sin multiplicar por dólar', () => {
  assert.equal(parsePrecioArs('$ 4.933,50'), 4933.5);
  assert.equal(parsePrecioArs('$ 107.071,90'), 107071.9);
  assert.equal(parsePrecioArs('$ 83660.20'), 83660.2);
  assert.equal(parsePrecioArs('$ 133399059.00'), 133399059);
  assert.equal(parsePrecioArs('$ 4.933'), 4933);
  assert.equal(parsePrecioArs('$ 33,023.93'), 33023.93);
  assert.equal(parsePrecioArs('$ 36,491.44'), 36491.44);
});

test('permite producción y desarrollo local sin abrir CORS a otros orígenes', () => {
  assert.equal(origenCorsPermitido('https://ventas.sistemanixa.com'), 'https://ventas.sistemanixa.com');
  assert.equal(origenCorsPermitido('http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
  assert.equal(origenCorsPermitido('http://localhost:4173'), 'http://localhost:4173');
  assert.equal(origenCorsPermitido('https://sitio-no-autorizado.example'), '');
});

test('Biosegur sólo acepta el precio principal o etiquetado', () => {
  assert.equal(extraerPrecioBiosegur('Balun P401\n$ 4.933,50\n+ IVA 21%'), 4933.5);
  assert.equal(extraerPrecioBiosegur('USD referencia $ 1.500\nCuotas $ 20.000'), 0);
});

test('otros proveedores requieren una etiqueta de precio inequívoca', () => {
  assert.equal(extraerPrecioEtiquetado('Precio mayorista: $ 83.660,20\nOtros datos'), 83660.2);
  assert.equal(extraerPrecioEtiquetado('Precio sin IVA: $ 33,023.93\n(IVA 10.5%)'), 33023.93);
  assert.equal(extraerPrecioEtiquetado('Envío $ 8.000\nSaldo $ 5.000'), 0);
});

test('detecta condicion y alicuota de IVA sin depender del proveedor', () => {
  assert.deepEqual(extraerCondicionIva('Precio sin IVA: $ 33,023.93 (IVA 10.5%)'), { sinIva:true, ivaAlicuota:10.5 });
  assert.deepEqual(extraerCondicionIva('$ 4.933,50 + IVA 21%'), { sinIva:true, ivaAlicuota:21 });
  assert.deepEqual(extraerCondicionIva('IVA incluido. Precio final en pesos'), { sinIva:false, ivaAlicuota:null });
});

test('Mercado Libre interpreta catálogo, publicación y tienda oficial desde la URL', () => {
  const url = 'https://www.mercadolibre.com.ar/alarma/p/MLA63758636?pdp_filters=official_store%3A280888&wid=MLA2734412812';
  assert.deepEqual(idsMercadoLibreDesdeUrl(url), { itemId:'MLA2734412812', productoId:'MLA63758636' });
  assert.deepEqual(filtrosMercadoLibreDesdeUrl(url), { officialStoreId:280888 });
  assert.deepEqual(
    idsMercadoLibreDesdeUrl('https://www.mercadolibre.com.ar/alarma/p/MLA63758636?pdp_filters=official_store%3A280888'),
    { itemId:'', productoId:'MLA63758636' }
  );
  assert.deepEqual(
    idsMercadoLibreDesdeUrl('https://www.mercadolibre.com.ar/cerradura/up/MLAU2980341696#polycard_client=search-desktop&wid=MLA1473110405'),
    { itemId:'MLA1473110405', productoId:'MLAU2980341696' }
  );
});

test('Mercado Libre prioriza la variante que coincide con el nombre de la URL', () => {
  const url = 'https://www.mercadolibre.com.ar/teclado-inalambrico-alarma-casa-garnet-kpd-1000w-blanco/p/MLA63758636';
  const correcto = puntajeProductoMercadoLibre(url, { name:'Alarma Garnet KPD-1000W inalambrico blanco' });
  const distinto = puntajeProductoMercadoLibre(url, { name:'Alarma Garnet KPD-1000W cableado negro' });
  assert(correcto > distinto);
});

test('Mercado Libre descubre la publicación vigente dentro de una página de catálogo', () => {
  const html = '<a href="/syi/core/list/equals?itemId=MLA2734412812&productId=MLA63758636">Vender uno igual</a>';
  assert.equal(itemIdMercadoLibreDesdeHtml(html, 'MLA63758636'), 'MLA2734412812');
  assert.equal(itemIdMercadoLibreDesdeHtml('<a href="/noindex/services/MLA2734412812/payments">Pagos</a>'), 'MLA2734412812');
});

test('Mercado Libre elige la publicación activa ARS de la tienda solicitada', () => {
  const elegida = seleccionarPublicacionMercadoLibre([
    { id:'MLA1', catalog_product_id:'MLA63758636', official_store_id:111, price:90000, currency_id:'ARS', status:'active' },
    { id:'MLA2', catalog_product_id:'MLA63758636', official_store_id:280888, price:142010, currency_id:'ARS', status:'active' },
    { id:'MLA3', catalog_product_id:'MLA63758636', official_store_id:280888, price:124968.80, currency_id:'ARS', status:'active', available_quantity:25, title:'Alarma Garnet KPD-1000W' },
    { id:'MLA4', catalog_product_id:'MLA63758636', official_store_id:280888, price:100000, currency_id:'USD', status:'active' }
  ], 'MLA63758636', 280888);
  assert.equal(elegida.id, 'MLA3');
  assert.deepEqual(datosMercadoLibreDesdeFuente(elegida), {
    precioArs:124968.80,
    precioActualArs:124968.80,
    precioOriginalArs:124968.80,
    enPromocion:false,
    porcentajeDescuento:0,
    disponibilidad:'disponible',
    titulo:'Alarma Garnet KPD-1000W',
    moneda:'ARS',
    itemId:'MLA3',
    catalogProductId:'MLA63758636'
  });
  const ordenCatalogo = seleccionarPublicacionMercadoLibre([
    { item_id:'MLA10', price:260239, currency_id:'ARS', status:'active' },
    { item_id:'MLA11', price:252259, currency_id:'ARS', status:'active' }
  ], 'MLA63758636', 0, false);
  assert.equal(ordenCatalogo.item_id, 'MLA10');
  const consenso = seleccionarPublicacionConsensoMercadoLibre([
    { item_id:'MLA10', price:252259, currency_id:'ARS', status:'active' },
    { item_id:'MLA11', price:260239, currency_id:'ARS', status:'active' },
    { item_id:'MLA12', price:260239, currency_id:'ARS', status:'active' },
    { item_id:'MLA13', price:260239, currency_id:'ARS', status:'active' }
  ], 'MLA63758636', 0);
  assert.equal(consenso.item_id, 'MLA11');
});

test('Mercado Libre prioriza el wid y usa sale_price como precio vigente promocional', () => {
  const url = 'https://www.mercadolibre.com.ar/cerradura-inteligente-suono-smartlock-sturdy-digital-wifi-co/up/MLAU2980341696?wid=MLA1473110405';
  assert.deepEqual(idsMercadoLibreDesdeUrl(url), {
    itemId:'MLA1473110405', productoId:'MLAU2980341696'
  });
  const datos = datosMercadoLibreDesdeFuente({
    id:'MLA1473110405',
    catalog_product_id:'MLAU2980341696',
    title:'Cerradura Inteligente Suono Smartlock Sturdy',
    price:299999,
    currency_id:'ARS',
    status:'active',
    available_quantity:4,
    sale_price:{ amount:284999.05, regular_amount:299999, discount_rate:5, currency_id:'ARS' }
  });
  assert.equal(datos.precioArs, 284999.05);
  assert.equal(datos.precioActualArs, 284999.05);
  assert.equal(datos.precioOriginalArs, 299999);
  assert.equal(datos.enPromocion, true);
  assert.equal(datos.porcentajeDescuento, 5);
  assert.equal(datos.itemId, 'MLA1473110405');
  assert.equal(datos.catalogProductId, 'MLAU2980341696');
});

test('el resolver oficial consulta primero el wid del caso real y deja diagnóstico completo', async () => {
  const llamadas = [];
  const trace = [];
  const datos = await extraerProductoMercadoLibreApi(
    'https://www.mercadolibre.com.ar/cerradura-inteligente-suono-smartlock-sturdy-digital-wifi-co/up/MLAU2980341696?wid=MLA1473110405',
    trace,
    async (ruta) => {
      llamadas.push(ruta);
      assert.equal(ruta, '/items/MLA1473110405');
      return {
        id:'MLA1473110405', catalog_product_id:'MLAU2980341696', title:'Cerradura Inteligente Suono Smartlock Sturdy',
        price:299999, currency_id:'ARS', status:'active',
        sale_price:{ amount:284999.05, regular_amount:299999, discount_rate:5, currency_id:'ARS' }
      };
    }
  );
  assert.deepEqual(llamadas, ['/items/MLA1473110405']);
  assert.equal(datos.precioActualArs, 284999.05);
  assert.equal(datos.precioOriginalArs, 299999);
  assert.equal(datos.diagnosticoMercadoLibre.catalogProductId, 'MLAU2980341696');
  assert.equal(datos.diagnosticoMercadoLibre.wid, 'MLA1473110405');
  assert.equal(datos.diagnosticoMercadoLibre.itemIdUtilizado, 'MLA1473110405');
  assert.equal(datos.diagnosticoMercadoLibre.precioObtenidoPorApi, 284999.05);
  assert.equal(datos.diagnosticoMercadoLibre.porcentajeDescuento, 5);
});

test('Mercado Libre conserva el precio de una URL MLA tradicional sin promoción', () => {
  const url = 'https://articulo.mercadolibre.com.ar/MLA-1234567890-publicacion-tradicional';
  assert.deepEqual(idsMercadoLibreDesdeUrl(url), { itemId:'MLA1234567890', productoId:'' });
  const datos = datosMercadoLibreDesdeFuente({
    id:'MLA1234567890', title:'Publicación tradicional', price:156000, currency_id:'ARS', status:'active'
  });
  assert.equal(datos.precioArs, 156000);
  assert.equal(datos.precioOriginalArs, 156000);
  assert.equal(datos.enPromocion, false);
  assert.equal(datos.porcentajeDescuento, 0);
});

test('la identidad acepta el mismo modelo y rechaza otro producto', () => {
  assert.equal(validarIdentidadProducto(
    'BALUN HD HIKVISION 1H18S/E - PAR',
    'Balun Hd Hikvision 1H18S/E - 100% Cobre Alta Performance - Par'
  ).ok, true);
  assert.equal(validarIdentidadProducto(
    'BALUN HD HIKVISION 1H18S/E - PAR',
    'Fuente switching Dahua 12V 2A'
  ).ok, false);
  assert.equal(validarIdentidadProducto(
    'CAMARA IP HIKVISION',
    'CAMARA IP DAHUA'
  ).ok, false);
  assert.equal(validarIdentidadProducto(
    'CAMARA IP HIKVISION DS-2CD1023G0-I',
    'CAMARA IP HIKVISION DS-2CD1043G0-I'
  ).ok, false);
  assert.equal(validarIdentidadProducto(
    'FUENTE SWITCHING 12V 2A',
    'FUENTE SWITCHING 12V 5A'
  ).ok, false);
  assert.equal(validarIdentidadProducto(
    'CABLE UTP CAT6 EXTERIOR',
    'CABLE UTP CAT5 INTERIOR'
  ).ok, false);
  assert.equal(validarIdentidadProducto(
    'ACCES POINT TP-LINK DECO S7 PACK X3',
    'Sistema Wi-Fi Mesh TP-Link Deco S7 3-Pack AC1900'
  ).ok, true);
  assert.equal(validarIdentidadProducto(
    'ACCES POINT TP-LINK DECO S7 PACK X3',
    'Sistema Wi-Fi Mesh TP-Link Deco S7 Pack 2 AC1900'
  ).ok, false);
});

test('rechaza moneda USD aunque el importe tenga símbolo peso', () => {
  assert.equal(validarMonedaPrecio('$ 90,00', 'USD').ok, false);
  assert.equal(validarMonedaPrecio('Precio US$ 90,00', '').ok, false);
  assert.equal(validarMonedaPrecio('$ 90.000,00', 'ARS').ok, true);
});

test('el salto extremo queda bloqueado como última barrera', () => {
  assert.equal(validarSaltoPrecio(110000, 100000).ok, true);
  const suba = validarSaltoPrecio(500000, 100000);
  const baja = validarSaltoPrecio(10000, 100000);
  assert.equal(suba.ok, false);
  assert.equal(baja.ok, false);
  assert.equal(baja.codigo, 'PRICE_VARIATION_REQUIRES_APPROVAL');
  assert.equal(baja.precioAnteriorArs, 100000);
  assert.equal(baja.precioCandidatoArs, 10000);
  assert.equal(baja.relacion, 0.1);
});

test('la cotizacion individual conserva el precio ante un salto extremo', () => {
  assert.equal(validarResultadoPrecioIndividual({ precioArs:110000 }, 100000).precioArs, 110000);
  assert.throws(() => validarResultadoPrecioIndividual({ precioArs:500000 }, 100000), function(error) {
    return /variaci/i.test(error.message) &&
      error.codigo === 'PRICE_VARIATION_REQUIRES_APPROVAL' &&
      error.precioAnteriorArs === 100000 &&
      error.precioCandidatoArs === 500000;
  });
});

test('extrae únicamente un token Bearer bien formado', () => {
  assert.equal(extraerTokenBearer('Bearer token.firebase.valido'), 'token.firebase.valido');
  assert.equal(extraerTokenBearer('bearer otro-token'), 'otro-token');
  assert.equal(extraerTokenBearer('Basic abc123'), '');
  assert.equal(extraerTokenBearer('Bearer token con espacios'), '');
});

test('Mercado Libre cifra tokens y valida el estado OAuth sin exponerlos', () => {
  const token = { access_token:'access-test', refresh_token:'refresh-test', expires_at:Date.now() + 3600000 };
  const cifrado = cifrarTokenMercadoLibre(token);
  assert.equal(JSON.stringify(cifrado).includes('access-test'), false);
  assert.deepEqual(descifrarTokenMercadoLibre(cifrado), token);
  const estado = firmarEstadoOAuthMercadoLibre();
  assert.equal(validarEstadoOAuthMercadoLibre(estado), true);
  assert.equal(validarEstadoOAuthMercadoLibre(`${estado}alterado`), false);
});
