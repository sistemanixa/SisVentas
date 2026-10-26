'use strict';
// Exact local port of the active product-cost helpers (new explicit product lines
// only). No HTTP, browser, timers or repricing of historical lines occurs here.
// Canonical source functions LF SHA256: af8cb8175d273964ec35c478d05b1876396f1badc2ac320f78243e0f949beb41
const fail=()=>Object.assign(Error('El producto requiere revisar su costo canónico antes de guardar.'),{statusCode:409,code:'SV_COMMERCIAL_PRODUCT_COST'});
const isLabor=p=>{const norm=v=>String(v==null?'':v).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-AR');return p.esManoDeObra===true||p.esManoDeObra===1||norm(p.esManoDeObra)==='true'||p.esManoObra===true||p.esManoObra===1||norm(p.esManoObra)==='true'||norm(p.categoria||p.catId||p.tipoProducto).includes('mano de obra')||/^mano de obra\b/.test(norm(p.nombre||p.descripcion));};
function calculate(product,config={}){
 if(!product||typeof product!=='object'||Array.isArray(product))throw fail();
 const window={TIPO_CAMBIO_CONFIG:structuredClone(config),SisVentas:{V3Bridge:{invoke(module,method,args,fallback){return method==='isLabor'?isLabor(args[0]):typeof fallback==='function'?fallback():fallback;}}}},proveedoresData=[],document={getElementById(){throw fail();}};
var _PRECIOS_CONTAMINADOS_CONFIRMADOS_20260721 = {
  'P-60853': { costo:93379345, venta:133399059, tc:1495 },
  'P-16403': { costo:46466170, venta:66380243, tc:1495 },
  'P-7209':  { costo:58244751, venta:83206781, tc:1495 }
};
function precioGremioARSDesdeProducto(p) {
  var favorito = (p && Array.isArray(p.proveedores) ? p.proveedores : []).find(function(pv){return proveedorProductoEsFavorito(pv,p);});
  if (favorito && costoUnitarioProveedorProducto(p,favorito)>0) return costoUnitarioProveedorProducto(p,favorito);
  p = p || {};
  var auditoriaProducto = detectarProductoArsDuplicadoPorDolar(p);
  if (auditoriaProducto && auditoriaProducto.costoCorregido > 0) return auditoriaProducto.costoCorregido;
  var legacyMoneda = detectarPrecioLegacyMonedaProducto(p);
  if (legacyMoneda && legacyMoneda.costoCorregido > 0) return legacyMoneda.costoCorregido;
  // Para metros, el proveedor es la fuente de la presentación y este valor
  // devuelve el costo por metro. Así ficha, buscador, presupuestos y ventas
  // nuevas comparten exactamente el mismo cálculo.
  if (String(p.unidad || '').toLowerCase() === 'metro') {
    var costoMetroProveedor = costoUnitarioProveedorPrincipalProducto(p);
    if (costoMetroProveedor > 0) return costoMetroProveedor;
  }
  var proveedorPrincipal = Array.isArray(p.proveedores) && p.proveedores.length ? p.proveedores[0] : null;
  var tc = obtenerDolarReferenciaProducto();
  // Los campos normalizados del producto son la fuente operativa. Antes se
  // priorizaba precioArsPublicado, por lo que un valor viejo del proveedor
  // podía ocultar una edición manual recién guardada en compraARS.
  var candidatos = [
    p.compraARS,
    p.precioGremio,
    p.compra,
    p.costoRealArs,
    p.precioArsPublicado,
    proveedorPrincipal && proveedorPrincipal.costoRealArs,
    proveedorPrincipal && proveedorPrincipal.precioArsPublicado,
    proveedorPrincipal && proveedorPrincipal.precio
  ];
  for (var i = 0; i < candidatos.length; i++) {
    var n = parseFloat(candidatos[i]);
    if (n > 0) {
      var monedaProv = String((proveedorPrincipal && (proveedorPrincipal.moneda || proveedorPrincipal.monedaPublicada || proveedorPrincipal.monedaPrecio)) || '').toUpperCase();
      var origenProv = String((proveedorPrincipal && proveedorPrincipal.actualizadoOrigen) || '').toLowerCase();
      var pareceUsdLegacy = tc.valor > 0 && n < 100 && (monedaProv === 'USD' || origenProv.indexOf('legacy') >= 0);
      return pareceUsdLegacy ? Math.round(n * tc.valor * 100) / 100 : n;
    }
  }
  var compraLegacy = parseFloat(p.compra) || 0;
  if (compraLegacy > 0 && String(p.moneda || '').toUpperCase() === 'USD' && tc.valor > 0) {
    return Math.round(compraLegacy * tc.valor * 100) / 100;
  }
  return compraLegacy || 0;
}

function proveedorProductoEsFavorito(pv, producto) {
  var favorita = urlFavoritaProducto(producto);
  if (!favorita || !pv || !pv.url) return false;
  try { var a=new URL(favorita), b=new URL(pv.url); a.hash=''; b.hash=''; return a.href===b.href; } catch (_) { return false; }
}

function costoUnitarioProveedorProducto(p, pv) {
  var costoPresentacion = costoRealProveedorProducto(pv, p && p.iva);
  if (!(costoPresentacion > 0)) return 0;
  var unidadesPorPresentacion = metrosPorPresentacionProducto(p);
  return Math.round((costoPresentacion / unidadesPorPresentacion) * 100) / 100;
}

function detectarProductoArsDuplicadoPorDolar(p) {
  p = p || {};
  var costoGuardado = _costoRaizProductoSinAuditar(p);
  var ventaGuardada = _primerNumeroPositivoProducto([p.ventaARS, p.precioArsPublicadoVenta, p.venta, p.precio_venta, p.precioVenta]);
  if (!(costoGuardado > 0) && !(ventaGuardada > 0)) return null;

  var migracionConfirmada = _migracionConfirmadaActualizador20260721(p, costoGuardado, ventaGuardada);
  if (migracionConfirmada) return migracionConfirmada;

  var migracionGeneral = _migracionGeneralActualizador20260721(p, costoGuardado, ventaGuardada);
  if (migracionGeneral) return migracionGeneral;

  var proveedor = (p && Array.isArray(p.proveedores) ? p.proveedores : []).find(function(pv){return proveedorProductoEsFavorito(pv,p);}) || _proveedorPrincipalProductoSinReconciliar(p);
  var costoProveedor = _costoProveedorProductoSinAuditar(p, proveedor);
  var tiposCambio = _tiposCambioAuditoriaProducto(p, proveedor);
  var ventaContaminadaAnterior = parseFloat(p.precioVentaCorregidoDuplicacionDolarAntes) || 0;
  var margen = parseFloat(p.margenDeseado);

  for (var i = 0; i < tiposCambio.length; i++) {
    var tc = tiposCambio[i];
    var costoDividido = costoGuardado > 0 ? Math.round((costoGuardado / tc) * 100) / 100 : 0;
    var ventaDividida = ventaGuardada > 0 ? Math.round((ventaGuardada / tc) * 100) / 100 : 0;
    var proveedorConfirma = costoProveedor > 0 && costoGuardado / costoProveedor > 50 && _relacionCercanaProducto(costoDividido, costoProveedor, 0.12);
    var repeticionConfirmada = ventaContaminadaAnterior > 0 && _relacionCercanaProducto(ventaGuardada, ventaContaminadaAnterior, 0.02);
    var parejaConfirma = costoDividido > 0 && ventaDividida > 0 && _precioVentaRazonableRespectoCosto(ventaDividida, costoDividido);
    var origenActualizador = /(?:biosegur|free_electron|tecnoprices|mercado_libre|proveedor).*?(?:lote|url_exacta|actualizador)/i.test(String(p.precioActualizadoOrigen || p.precioVentaActualizadoOrigen || ''));

    // Para una primera contaminación exigimos el costo anterior del proveedor.
    // Si el mismo importe ya había sido reparado, esa auditoría previa también
    // es una prueba inequívoca y permite recuperar costo y venta en conjunto.
    if (!proveedorConfirma && !repeticionConfirmada) continue;
    if (!parejaConfirma && !(ventaDividida > 0 && costoProveedor > 0 && _precioVentaRazonableRespectoCosto(ventaDividida, costoProveedor))) continue;
    if (!origenActualizador && !repeticionConfirmada) continue;

    var costoCorregido = proveedorConfirma ? Math.round(costoProveedor * 100) / 100 : costoDividido;
    var ventaCorregida = ventaDividida;
    if (!(ventaCorregida > 0) && costoCorregido > 0 && isFinite(margen) && margen >= 0) {
      ventaCorregida = Math.round(costoCorregido * (1 + margen / 100) * 100) / 100;
    }
    if (!(costoCorregido > 0) || !(ventaCorregida > 0) || !_precioVentaRazonableRespectoCosto(ventaCorregida, costoCorregido)) continue;
    return {
      costoGuardado: costoGuardado,
      costoCorregido: costoCorregido,
      ventaGuardada: ventaGuardada,
      ventaCorregida: ventaCorregida,
      tipoCambio: tc,
      proveedorConfirma: proveedorConfirma,
      origen: repeticionConfirmada ? 'reincidencia-actualizador' : 'proveedor-confirma-factor-dolar'
    };
  }
  return null;
}

function detectarPrecioLegacyMonedaProducto(p) {
  p = p || {};
  if (typeof esProductoManoDeObra === 'function' && esProductoManoDeObra(p)) return null;
  var costoGuardado = _costoRaizProductoSinAuditar(p);
  var ventaGuardada = _primerNumeroPositivoProducto([p.ventaARS, p.precioArsPublicadoVenta, p.venta, p.precio_venta, p.precioVenta]);
  var tcInfo = obtenerDolarReferenciaProducto();
  var tc = parseFloat(p.tcGuardado || p.dolarUsadoVenta || p.dolarUsado || (tcInfo && tcInfo.valor)) || 0;
  if (!(tc > 100)) return null;

  if (costoGuardado >= 5000000 && ventaGuardada >= 5000000) {
    var costoDividido = Math.round((costoGuardado / tc) * 100) / 100;
    var ventaDividida = Math.round((ventaGuardada / tc) * 100) / 100;
    if (costoDividido >= 100 && costoDividido <= 2000000 &&
        ventaDividida >= 100 && ventaDividida <= 5000000 &&
        _precioVentaRazonableRespectoCosto(ventaDividida, costoDividido)) {
      return {
        tipo:'ars_multiplicado_por_dolar',
        costoGuardado:costoGuardado,
        costoCorregido:costoDividido,
        ventaGuardada:ventaGuardada,
        ventaCorregida:ventaDividida,
        tipoCambio:tc,
        origen:'auditoria-matematica-costo-venta'
      };
    }
  }

  if (costoGuardado > 0 && costoGuardado < 5000 && ventaGuardada >= 100) {
    var costoConvertido = Math.round(costoGuardado * tc * 100) / 100;
    if (_precioVentaRazonableRespectoCosto(ventaGuardada, costoConvertido)) {
      return {
        tipo:'costo_usd_legacy',
        costoGuardado:costoGuardado,
        costoCorregido:costoConvertido,
        ventaGuardada:ventaGuardada,
        ventaCorregida:ventaGuardada,
        tipoCambio:tc,
        origen:'auditoria-matematica-costo-usd'
      };
    }
  }

  if (ventaGuardada > 0 && ventaGuardada < 5000 && costoGuardado >= 100) {
    var ventaConvertida = Math.round(ventaGuardada * tc * 100) / 100;
    var margen = parseFloat(p.margenDeseado);
    if (isFinite(margen) && margen >= 0 && margen <= 500) {
      ventaConvertida = Math.round(costoGuardado * (1 + margen / 100) * 100) / 100;
    }
    if (_precioVentaRazonableRespectoCosto(ventaConvertida, costoGuardado)) {
      return {
        tipo:'venta_usd_legacy',
        costoGuardado:costoGuardado,
        costoCorregido:costoGuardado,
        ventaGuardada:ventaGuardada,
        ventaCorregida:ventaConvertida,
        tipoCambio:tc,
        origen:'auditoria-matematica-venta-usd'
      };
    }
  }
  return null;
}

function costoUnitarioProveedorPrincipalProducto(p) {
  var proveedor = (p && Array.isArray(p.proveedores) ? p.proveedores : []).find(function(pv){return proveedorProductoEsFavorito(pv,p);}) || _proveedorPrincipalProductoSinReconciliar(p);
  // Los productos anteriores a la grilla de proveedores conservan proveedor,
  // precio y URL en campos legacy. proveedoresVinculadosProducto los normaliza
  // en memoria para que también reciban la misma conversión por metro.
  if (!proveedor) {
    var proveedoresLegacy = proveedoresVinculadosProducto(p);
    proveedor = proveedoresLegacy.length ? proveedoresLegacy[0] : null;
  }
  return proveedor ? costoUnitarioProveedorProducto(p, proveedor) : 0;
}

function obtenerDolarReferenciaProducto() {
  var cfg = window.TIPO_CAMBIO_CONFIG || {};
  var tipo = cfg.dolarConversion || 'oficial';
  var valor = parseFloat(cfg[tipo]) || parseFloat(cfg.oficial) || parseFloat(cfg.blue) || parseFloat(cfg.mep) || 0;
  if (!valor && window._tipoCambioActual && window._tipoCambioActual.venta) {
    tipo = 'venta';
    valor = parseFloat(window._tipoCambioActual.venta) || 0;
  }
  return { tipo: tipo, valor: valor };
}

function urlFavoritaProducto(p) {
  if (p) return String(p.codWeb || p.urlProveedor || '').trim();
  return String((document.getElementById('pf-cod-web') || {}).value || '').trim();
}

function costoRealProveedorProducto(pv, ivaProducto) {
  pv = pv || {};
  var guardado = parseFloat(pv.costoRealArs) || 0;
  if (guardado > 0) return guardado;
  var publicado = parseFloat(pv.precioArsPublicado || pv.precio) || 0;
  return publicado > 0 ? publicado * factorIvaProveedorProducto(pv, ivaProducto) + costoEnvioProveedorProducto(pv) : 0;
}

function metrosPorPresentacionProducto(p) {
  p = p || {};
  if (String(p.unidad || '').toLowerCase() !== 'metro') return 1;
  var metros = parseFloat(p.metrosPorPresentacion || p.cantidadPorPresentacion || p.contenidoPresentacion || 0);
  return metros > 0 ? metros : 1;
}

function _costoRaizProductoSinAuditar(p) {
  p = p || {};
  return _primerNumeroPositivoProducto([p.compraARS, p.precioGremio, p.compra, p.costoRealArs, p.precioArsPublicado]);
}

function _primerNumeroPositivoProducto(valores) {
  for (var i = 0; i < valores.length; i++) {
    var n = parseFloat(valores[i]);
    if (n > 0 && isFinite(n)) return n;
  }
  return 0;
}

function _migracionConfirmadaActualizador20260721(p, costoGuardado, ventaGuardada) {
  var codigo = String((p && p.codigo) || '').trim().toUpperCase().replace(/\s+/g, '');
  var confirmado = _PRECIOS_CONTAMINADOS_CONFIRMADOS_20260721[codigo];
  if (!confirmado) return null;
  if (!_relacionCercanaProducto(costoGuardado, confirmado.costo, 0.005)) return null;
  if (!_relacionCercanaProducto(ventaGuardada, confirmado.venta, 0.005)) return null;
  return {
    costoGuardado: costoGuardado,
    costoCorregido: Math.round((costoGuardado / confirmado.tc) * 100) / 100,
    ventaGuardada: ventaGuardada,
    ventaCorregida: Math.round((ventaGuardada / confirmado.tc) * 100) / 100,
    tipoCambio: confirmado.tc,
    proveedorConfirma: false,
    forzarMigracion: true,
    origen: 'migracion-confirmada-actualizador-20260721'
  };
}

function _migracionGeneralActualizador20260721(p, costoGuardado, ventaGuardada) {
  if (!(costoGuardado >= 5000000) || !(ventaGuardada >= 5000000)) return null;
  var costoReferencia = parseFloat(p && p.compraUSD) || 0;
  var ventaReferencia = parseFloat(p && p.ventaUSD) || 0;
  if (!(costoReferencia > 0) || !(ventaReferencia > 0)) return null;

  var proveedor = (p && Array.isArray(p.proveedores) ? p.proveedores : []).find(function(pv){return proveedorProductoEsFavorito(pv,p);}) || _proveedorPrincipalProductoSinReconciliar(p);
  var origen = String((p && (p.precioActualizadoOrigen || p.precioVentaActualizadoOrigen)) || (proveedor && proveedor.actualizadoOrigen) || '').toLowerCase();
  var origenActualizador = /biosegur|free_electron|tecnoprices|mercado_libre|url_exacta|scraping|actualizador|proveedor/.test(origen);
  if (!origenActualizador) return null;

  var tiposCambio = _tiposCambioAuditoriaProducto(p, proveedor);
  for (var i = 0; i < tiposCambio.length; i++) {
    var tc = tiposCambio[i];
    var costoCorregido = Math.round((costoGuardado / tc) * 100) / 100;
    var ventaCorregida = Math.round((ventaGuardada / tc) * 100) / 100;
    if (!(costoCorregido >= 100) || costoCorregido > 2000000) continue;
    if (!(ventaCorregida >= 100) || ventaCorregida > 5000000) continue;
    if (!_relacionCercanaProducto(costoCorregido, costoReferencia, 0.03)) continue;
    if (!_relacionCercanaProducto(ventaCorregida, ventaReferencia, 0.03)) continue;
    if (!_precioVentaRazonableRespectoCosto(ventaCorregida, costoCorregido)) continue;
    return {
      costoGuardado: costoGuardado,
      costoCorregido: costoCorregido,
      ventaGuardada: ventaGuardada,
      ventaCorregida: ventaCorregida,
      tipoCambio: tc,
      proveedorConfirma: false,
      forzarMigracion: true,
      origen: 'auditoria-general-actualizador-20260721'
    };
  }
  return null;
}

function _proveedorPrincipalProductoSinReconciliar(p) {
  p = p || {};
  var lista = Array.isArray(p.proveedores) ? p.proveedores.filter(Boolean) : [];
  if (!lista.length) return null;
  var nombre = String(p.proveedor || p.nom_prov || '').trim().toLowerCase();
  var encontrado = nombre ? lista.find(function(pv) {
    return String((pv && (pv.nombre || pv.proveedor)) || '').trim().toLowerCase() === nombre;
  }) : null;
  if (encontrado) return encontrado;
  return lista.reduce(function(mejor, pv) {
    var costoPv = _primerNumeroPositivoProducto([pv.costoRealArs, pv.precioArsPublicado, pv.precio]);
    var costoMejor = _primerNumeroPositivoProducto([mejor && mejor.costoRealArs, mejor && mejor.precioArsPublicado, mejor && mejor.precio]);
    return costoPv > 0 && (!(costoMejor > 0) || costoPv < costoMejor) ? pv : mejor;
  }, lista[0]);
}

function _costoProveedorProductoSinAuditar(p, pv) {
  pv = pv || _proveedorPrincipalProductoSinReconciliar(p);
  if (!pv) return 0;
  var costo = parseFloat(pv.costoRealArs) || 0;
  if (costo > 0) return costo;
  var publicado = _primerNumeroPositivoProducto([pv.precioArsPublicado, pv.precio]);
  return publicado > 0 ? publicado * factorIvaProveedorProducto(pv, p && p.iva) + costoEnvioProveedorProducto(pv) : 0;
}

function _tiposCambioAuditoriaProducto(p, pv) {
  var actual = obtenerDolarReferenciaProducto();
  var valores = [
    p && p.tcGuardado,
    p && p.dolarUsadoVenta,
    p && p.dolarUsado,
    p && p.precioVentaCorregidoDuplicacionDolarTc,
    pv && pv.dolarUsado,
    actual && actual.valor
  ];
  return valores.map(function(x){ return parseFloat(x) || 0; }).filter(function(x, idx, arr) {
    return x > 100 && arr.findIndex(function(y){ return Math.abs(y - x) < 0.01; }) === idx;
  });
}

function _relacionCercanaProducto(valor, referencia, tolerancia) {
  valor = parseFloat(valor) || 0;
  referencia = parseFloat(referencia) || 0;
  if (!(valor > 0) || !(referencia > 0)) return false;
  var ratio = valor / referencia;
  return ratio >= 1 - tolerancia && ratio <= 1 + tolerancia;
}

function _precioVentaRazonableRespectoCosto(precio, costo) {
  var valor = parseFloat(precio) || 0;
  var costoArs = parseFloat(costo) || 0;
  if (!(valor > 0) || !(costoArs > 0)) return false;
  var relacion = valor / costoArs;
  return relacion >= 0.8 && relacion <= 10;
}

function esProductoManoDeObra(p) {
  p = p || {};
  var v3 = productosProveedoresV3Invocar('isLabor', [p], null);
  if (v3 !== null && v3 !== undefined) return v3 === true;
  if (p.esManoDeObra === true || String(p.esManoDeObra || '').toLowerCase() === 'true') return true;
  var categoria = String(p.categoria || p.catId || p.tipoProducto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  var nombre = String(p.nombre || p.descripcion || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return categoria.indexOf('mano de obra') >= 0 || /^mano de obra\b/.test(nombre);
}

function proveedoresVinculadosProducto(p) {
  p = p || {};
  if (Array.isArray(p.proveedores) && p.proveedores.length) {
    return p.proveedores.map(function(pv) { return Object.assign({}, pv || {}); });
  }
  var nombreLegacy = String(p.proveedor || p.nom_prov || '').trim();
  var urlLegacy = normalizarUrlProveedorProducto(p.codWeb || p.urlProveedor || p.url || '');
  if (!nombreLegacy && !urlLegacy) return [];
  var maestro = (proveedoresData || []).find(function(prov) {
    return String((prov && prov.nombre) || '').trim().toLowerCase() === nombreLegacy.toLowerCase();
  });
  return [{
    nombre: nombreLegacy || (maestro && maestro.nombre) || 'Proveedor',
    proveedorKey: (maestro && (maestro.fbKey || maestro.key || maestro.id)) || '',
    precio: parseFloat(p.precioArsPublicado || p.precioGremio || p.compraARS || p.compra || 0) || 0,
    precioArsPublicado: parseFloat(p.precioArsPublicado || p.precioGremio || p.compraARS || p.compra || 0) || 0,
    costoRealArs: parseFloat(p.costoRealArs || p.precioGremio || p.compraARS || p.compra || 0) || 0,
    sinIva: !!p.sinIva,
    url: urlLegacy,
    actualizado: p.fechaActualizacionPrecio || '',
    actualizadoEn: parseFloat(p.precioActualizadoEn || p.actualizadoEn || 0) || 0,
    actualizadoOrigen: 'legacy'
  }];
}

function factorIvaProveedorProducto(pv, ivaProducto) {
  return pv && pv.sinIva ? 1 + (alicuotaIvaProveedorProducto(pv, ivaProducto) / 100) : 1;
}

function costoEnvioProveedorProducto(pv) {
  pv = pv || {};
  try {
    if (!/^(?:www\.|mobile\.)?(?:comprasparaguai\.com\.br|comprasparaguay\.com\.ar|flytec\.com\.py|nissei\.com|shoppingchina\.com\.py)$/.test(new URL(pv.url).hostname)) return 0;
  } catch (_) { return 0; }
  var envio = Number.isFinite(pv.costoEnvioUSD) ? Math.round(pv.costoEnvioUSD * obtenerDolarReferenciaProducto().valor) : Number(pv.costoEnvioArs);
  return Number.isFinite(envio) && envio > 0 ? Math.round(envio * 100) / 100 : 0;
}

function productosProveedoresV3Invocar(metodo, argumentos, fallback) {
  var bridge = window.SisVentas && window.SisVentas.V3Bridge;
  if (!bridge || typeof bridge.invoke !== 'function') {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
  return bridge.invoke('productosProveedores', metodo, argumentos || [], fallback);
}

function normalizarUrlProveedorProducto(url, nombreProveedor) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  // Un código numérico no identifica al proveedor. Sólo Tecnoprices usa
  // oficialmente este atajo; en cualquier otra fila se conserva como código.
  if (/^\d+$/.test(u) && esProveedorTecnoprices(nombreProveedor)) {
    return 'https://www.tecnoprices.com/' + u;
  }
  return u;
}

function alicuotaIvaProveedorProducto(pv, ivaProducto) {
  pv = pv || {};
  var declarada = parseFloat(pv.ivaAlicuota);
  if (isFinite(declarada) && declarada >= 0 && declarada <= 100) return declarada;
  var producto = parseFloat(ivaProducto);
  if (isFinite(producto) && producto >= 0 && producto <= 100) return producto;
  return 21;
}

function esProveedorTecnoprices(nombreProveedor) {
  return /tecnoprices/i.test(String(nombreProveedor || '').trim());
}
 const value=precioGremioARSDesdeProducto(structuredClone(product));if(!Number.isFinite(value)||value<0||value===0&&!isLabor(product))throw fail();return value;
}
async function resolve(line,{read}={}){
 const ids=[line.productoFbKey,line.pid,line.productoKey].filter(value=>value!==undefined&&value!==null&&value!=='').map(String),id=ids[0];
 if(!id||new Set(ids).size!==1||id.length>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(id)||['__proto__','constructor','prototype'].includes(id)||typeof read!=='function')throw fail();
 const product=await read('sisventas/productos/'+id);if(!product||product.activo===false||String(line.cod||line.codigo||'')!==String(product.codigo||product.cod||''))throw fail();
 const config=await read('sisventas/config/tipoCambio')||{},cost=calculate(product,config),quantity=Number(line.qty??line.cantidad??line.cant??1);
 if(!Number.isFinite(quantity)||quantity<=0)throw fail();
 return {costoUnitarioCompra:Math.round(cost*100)/100,costoUnitarioPresupuestado:Math.round(cost*100)/100,costoTotalCompra:Math.round(cost*quantity*100)/100};
}
module.exports={calculate,resolve,canonicalFunctions:["precioGremioARSDesdeProducto","proveedorProductoEsFavorito","costoUnitarioProveedorProducto","detectarProductoArsDuplicadoPorDolar","detectarPrecioLegacyMonedaProducto","costoUnitarioProveedorPrincipalProducto","obtenerDolarReferenciaProducto","urlFavoritaProducto","costoRealProveedorProducto","metrosPorPresentacionProducto","_costoRaizProductoSinAuditar","_primerNumeroPositivoProducto","_migracionConfirmadaActualizador20260721","_migracionGeneralActualizador20260721","_proveedorPrincipalProductoSinReconciliar","_costoProveedorProductoSinAuditar","_tiposCambioAuditoriaProducto","_relacionCercanaProducto","_precioVentaRazonableRespectoCosto","esProductoManoDeObra","proveedoresVinculadosProducto","factorIvaProveedorProducto","costoEnvioProveedorProducto","productosProveedoresV3Invocar","normalizarUrlProveedorProducto","alicuotaIvaProveedorProducto","esProveedorTecnoprices"],canonicalFunctionsSHA256:'af8cb8175d273964ec35c478d05b1876396f1badc2ac320f78243e0f949beb41'};
