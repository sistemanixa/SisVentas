'use strict';
// Proyección pura del contrato fiscal canónico de la aplicación activa.
// La prueba de paridad exige conservar las mismas funciones, descuentos e IVA.
function normalizarSolicitudEmisionFiscal(data, requerirTipo = false) {
  data = data || {};
  if (['consultar_cuit', 'consultar_comprobante', 'recuperar_identidad_fiscal', 'regenerar_pdf', 'vincular_emision'].includes(data.accion)) return data;
  var raw = data.tipoComprobante;
  if ((raw === undefined || raw === null || raw === '') && !requerirTipo) return data;
  var tipo = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim().toUpperCase().replace(/\s+/g, ' ') : '';
  var codigos = { '1':'FACTURA A', '6':'FACTURA B', '11':'FACTURA C', '3':'NOTA DE CREDITO A', '8':'NOTA DE CREDITO B', '13':'NOTA DE CREDITO C' };
  tipo = codigos[tipo.replace(/^0+/, '')] || tipo;
  function invalidar(mensaje) { throw Object.assign(new Error(mensaje), { statusCode:400 }); }
  if (!/^(FACTURA|NOTA DE CREDITO) [ABC]$/.test(tipo)) invalidar('El tipo de comprobante fiscal no es válido.');
  var esNotaCredito = tipo.startsWith('NOTA DE CREDITO ');
  if (data.esNotaCredito !== undefined && (typeof data.esNotaCredito !== 'boolean' || data.esNotaCredito !== esNotaCredito)) invalidar('El tipo de comprobante y la operación fiscal no coinciden.');
  return Object.assign({}, data, { tipoComprobante:tipo, esNotaCredito:esNotaCredito });
}

function normalizarNumeroExcel(texto) {
  if (!texto) return '';
  var t = String(texto).trim();
  // Quitar símbolo $ y espacios
  t = t.replace(/[$\s]/g, '');
  if (!t) return '';

  var tieneComa  = t.indexOf(',') !== -1;
  var tienePunto = t.indexOf('.') !== -1;

  if (tieneComa && tienePunto) {
    // Ambos presentes — el que está último es el decimal
    var posComa  = t.lastIndexOf(',');
    var posPunto = t.lastIndexOf('.');
    if (posComa > posPunto) {
      // Formato AR: 1.234,56 — punto=miles, coma=decimal
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US: 1,234.56 — coma=miles, punto=decimal
      t = t.replace(/,/g, '');
    }
  } else if (tienePunto && !tieneComa) {
    var partesPunto = t.split('.');
    var despuesPunto = partesPunto[partesPunto.length - 1];
    if (partesPunto.length > 2) {
      // Múltiples puntos — son separadores de miles (ej: 1.234.567)
      t = t.replace(/\./g, '');
    } else if (despuesPunto.length === 3) {
      // Exactamente 3 dígitos después del punto → miles (ej: 105.245)
      t = t.replace('.', '');
    }
    // 1 o 2 dígitos después → decimal (ej: 10.50, 10.5) — dejar como está
  } else if (tieneComa && !tienePunto) {
    var partesComa = t.split(',');
    var despuesComa = partesComa[partesComa.length - 1];
    if (partesComa.length > 2 || despuesComa.length === 3) {
      // Múltiples comas o 3 dígitos → separador de miles
      t = t.replace(/,/g, '');
    } else {
      // 1 o 2 dígitos → decimal
      t = t.replace(',', '.');
    }
  }

  var num = parseFloat(t);
  return isNaN(num) ? '' : String(num);
}

function pptoNumeroGuardado(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined || valor === '') return 0;
  var normalizado = typeof normalizarNumeroExcel === 'function' ? normalizarNumeroExcel(valor) : String(valor);
  return parseFloat(normalizado) || 0;
}

function descripcionVisibleItemDocumento(item) {
  item = item || {};
  return String(item.descripcionPersonalizada || item.desc || item.descripcion || item.nombre || item.producto || '').trim();
}

function pptoNormalizarItemGuardado(item) {
  item = item || {};
  var qty = pptoNumeroGuardado(item.qty ?? item.cantidad ?? item.cant ?? item.unidades ?? 1) || 1;
  var disc = pptoNumeroGuardado(item.disc ?? item.descuento ?? item.descuentoPct ?? item.porcentajeDescuento ?? 0);
  var punit = pptoNumeroGuardado(item.punit ?? item.precio ?? item.precioUnitario ?? item.precio_unitario ?? item.precioVenta ?? item.unitario ?? item.valorUnitario ?? 0);
  var subtotal = pptoNumeroGuardado(item.sub ?? item.subtotal ?? item.totalItem ?? item.importe ?? 0);
  if (!punit && subtotal && qty) {
    var factor = 1 - disc / 100;
    punit = factor > 0 ? subtotal / qty / factor : subtotal / qty;
  }
  return {
    ...(Number(item.costoUnitarioCompra)>0 ? {costoUnitarioCompra:Number(item.costoUnitarioCompra), origenCompra:item.origenCompra||'', porcentajeVentaCompra:item.porcentajeVentaCompra ?? null} : {}),
    cod: item.cod || item.codigo || item.sku || '',
    desc: descripcionVisibleItemDocumento(item),
    descripcionPersonalizada: item.descripcionPersonalizada || '',
    qty: qty,
    punit: punit,
    disc: disc,
    orden: parseInt(item.orden || item.order || item.posicion || 0, 10) || 0,
    monedaOriginal: item.monedaOriginal || item.moneda || '',
    precioUsdOriginal: pptoNumeroGuardado(item.precioUsdOriginal || item.precioUSD || 0),
    cotizacionUsada: pptoNumeroGuardado(item.cotizacionUsada || item.tipoCambio || 0),
    cotizacionTipo: item.cotizacionTipo || '',
    pid: item.pid || item.productoFbKey || item.productoKey || '',
    productoFbKey: item.productoFbKey || item.pid || item.productoKey || '',
    imagenUrl: item.imagenUrl || item.productoImagenUrl || ''
  };
}

function ventaSubtotalBruto(v) {
  if (!v) return 0;
  var items = Array.isArray(v.items) ? v.items : [];
  var brutoItems = items.reduce(function(s, it) {
    return s + ((parseFloat(it.qty) || 1) * (parseFloat(it.punit) || 0));
  }, 0);
  if (brutoItems > 0) return brutoItems;
  var subtotal = parseFloat(v.subtotal) || 0;
  var descuento = parseFloat(v.descuento) || 0;
  return Math.max(0, subtotal + descuento);
}

function ventaTieneDescuentoItem(v) {
  if (!v || !Array.isArray(v.items)) return false;
  return v.items.some(function(it) {
    return (parseFloat(it.disc || it.descuento) || 0) > 0;
  });
}

function ventaNormalizarDescuentoParaVista(v, descuento) {
  var valor = parseFloat(descuento) || 0;
  if (!(valor > 0)) return 0;
  if (v && Number(v.descuentoGeneral) === 0 && v.descuentoGeneral != null && Number(v.descuento) === 0 && v.descuento != null && !ventaTieneDescuentoItem(v)) return 0;
  var descuentoGeneral = parseFloat(v && v.descuentoGeneral) || 0;
  if (descuentoGeneral > 0 || ventaTieneDescuentoItem(v)) return Math.max(0, valor);
  return Math.abs(valor) <= 0.5 ? 0 : valor;
}

function ventaPorcentajeDescuentoEfectivo(v) {
  if (!v) return 0;
  var guardado = parseFloat(v.descuentoPctEfectivo);
  if (isFinite(guardado) && guardado >= 0) return Math.max(0, Math.min(100, guardado));
  var bruto = ventaSubtotalBruto(v);
  if (bruto <= 0) return 0;
  var descuento = parseFloat(v.descuento) || 0;
  if (descuento <= 0 && Array.isArray(v.items)) {
    descuento = v.items.reduce(function(s, it) {
      var brutoItem = (parseFloat(it.qty) || 1) * (parseFloat(it.punit) || 0);
      var netoItem = parseFloat(it.sub);
      if (!isFinite(netoItem)) netoItem = brutoItem * (1 - ((parseFloat(it.disc || it.descuento) || 0) / 100));
      return s + Math.max(0, brutoItem - netoItem);
    }, 0);
  }
  return Math.max(0, Math.min(100, (descuento / bruto) * 100));
}

function ventaEsSinCargo(v) {
  if (!v) return false;
  var bruto = ventaSubtotalBruto(v);
  var total = parseFloat(v.total) || 0;
  return bruto > 0 && Math.abs(total) <= 0.01 && ventaPorcentajeDescuentoEfectivo(v) >= 99.99;
}

function resumenEconomicoComprobanteVenta(venta) {
  venta = venta || {};
  var numero = function(valor) { return pptoNumeroGuardado(valor); };
  var items = Array.isArray(venta.items) ? venta.items : Object.values(venta.items || {});
  var subtotalBrutoItems = 0;
  var subtotalItemsConDescuento = 0;
  items.forEach(function(item) {
    var normalizado = pptoNormalizarItemGuardado(item);
    subtotalBrutoItems += normalizado.qty * normalizado.punit;
    subtotalItemsConDescuento += normalizado.qty * normalizado.punit * (1 - normalizado.disc / 100);
  });

  var total = numero(venta.total);
  var iva = numero(venta.iva ?? venta.totalIVA ?? venta.ivaMonto);
  var subtotalNeto = numero(venta.subtotal ?? venta.neto ?? venta.importeNeto);
  var aplicaIva = venta.conIva === true || iva > 0;

  if (!(subtotalNeto > 0) && total > 0) {
    if (iva > 0 && iva <= total) subtotalNeto = total - iva;
    else if (aplicaIva) {
      subtotalNeto = total / 1.21;
      iva = total - subtotalNeto;
    } else subtotalNeto = total;
  }
  if (!(subtotalNeto > 0)) subtotalNeto = subtotalItemsConDescuento;

  var descuento = numero(venta.descuentoMonto ?? venta.descuentoTotal ?? venta.descuento);
  if (!(descuento > 0) && subtotalBrutoItems > subtotalNeto) {
    descuento = subtotalBrutoItems - subtotalNeto;
  }

  if (!(iva > 0) && total > subtotalNeto) iva = total - subtotalNeto;
  if (!(total > 0)) total = subtotalNeto + iva;

  // En ventas históricas puede haberse persistido en `descuento` únicamente
  // el ajuste de redondeo de los ítems, aunque el total ya refleja un
  // descuento general real. Para la vista e impresión el total confirmado es
  // la fuente de verdad: se deriva el neto sólo si la diferencia es mayor a
  // 50 centavos, evitando clasificar redondeos como descuentos.
  var netoDesdeTotal = total > 0 ? Math.max(0, total - Math.max(0, iva)) : 0;
  var descuentoDesdeTotal = subtotalBrutoItems - netoDesdeTotal;
  if (subtotalBrutoItems > 0 && netoDesdeTotal > 0 && descuentoDesdeTotal > 0.5 &&
      (!(subtotalNeto > 0) || netoDesdeTotal < subtotalNeto - 0.01)) {
    subtotalNeto = netoDesdeTotal;
    descuento = Math.max(descuento, descuentoDesdeTotal);
  }

  descuento = ventaNormalizarDescuentoParaVista(venta, descuento);
  var descuentoGeneralPct = numero(venta.descuentoGeneral ?? venta.descuentoPct ?? venta.porcentajeDescuento);
  var ventaBonificadaCompleta = ventaEsSinCargo(venta) || descuentoGeneralPct >= 99.99;
  // Un cero confirmado es un valor válido, no un dato ausente. En las ventas
  // bonificadas al 100% no reconstruir el neto desde los ítems ni sumar otra
  // vez el descuento: eso duplicaba el bruto y mostraba un saldo inexistente.
  if (ventaBonificadaCompleta && subtotalBrutoItems > 0) {
    subtotalNeto = 0;
    descuento = subtotalBrutoItems;
    iva = 0;
    total = 0;
    descuentoGeneralPct = 100;
  }
  var subtotalBruto = ventaBonificadaCompleta ? subtotalBrutoItems : Math.max(subtotalBrutoItems, subtotalNeto + descuento);
  if (!(subtotalBruto > 0)) subtotalBruto = subtotalNeto;
  if (!(descuentoGeneralPct > 0) && subtotalBruto > 0 && descuento > 0) {
    descuentoGeneralPct = descuento / subtotalBruto * 100;
  }

  var redondear = function(valor) { return Math.round((numero(valor) + Number.EPSILON) * 100) / 100; };
  return {
    subtotalItems: redondear(subtotalItemsConDescuento),
    descuentoGeneralMonto: redondear(subtotalItemsConDescuento - subtotalNeto > 0.5 ? subtotalItemsConDescuento - subtotalNeto : 0),
    descuentoGeneralRealPct: subtotalItemsConDescuento > 0 && subtotalItemsConDescuento - subtotalNeto > 0.5 ? (subtotalItemsConDescuento - subtotalNeto) / subtotalItemsConDescuento * 100 : 0,
    subtotalBruto: redondear(subtotalBruto),
    descuento: redondear(Math.max(0, descuento)),
    descuentoGeneralPct: descuentoGeneralPct,
    subtotalNeto: redondear(subtotalNeto),
    iva: redondear(Math.max(0, iva)),
    aplicaIva: aplicaIva || iva > 0,
    total: redondear(total)
  };
}

function resumenFiscalParaComprobanteVenta(venta, tipoComprobante) {
  var comercial = resumenEconomicoComprobanteVenta(venta || {});
  var tipo = String(tipoComprobante || '').toUpperCase();
  var esComprobanteFiscal = /FACTURA|NOTA DE (CREDITO|DEBITO)/.test(tipo);
  var neto = comercial.subtotalNeto;
  var iva = comercial.iva;
  var aplicaIva = comercial.aplicaIva;

  if (esComprobanteFiscal && venta && venta.conIva === false) {
    neto = comercial.total;
    iva = Math.round((neto * 0.21 + Number.EPSILON) * 100) / 100;
    aplicaIva = true;
  }
  var total = Math.round(((neto + iva) + Number.EPSILON) * 100) / 100;
  return {
    subtotalBruto: comercial.subtotalBruto,
    descuento: comercial.descuento,
    descuentoGeneralPct: comercial.descuentoGeneralPct,
    subtotalNeto: Math.round((neto + Number.EPSILON) * 100) / 100,
    iva: Math.round((iva + Number.EPSILON) * 100) / 100,
    aplicaIva: aplicaIva,
    total: total,
    totalComercial: comercial.total
  };
}

function importeComprobanteVenta(valor) {
  return '$' + pptoNumeroGuardado(valor).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function prepararVentaParaFacturacion(venta, tipoComprobante) {
  venta = venta || {};
  var resumen = resumenEconomicoComprobanteVenta(venta);
  // Una venta marcada "Sin IVA" conserva el precio comercial neto. Al emitir
  // una factura electrónica gravada, ARCA debe recibir ese neto más su IVA;
  // nunca se debe forzar el total comercial a que parezca un total con IVA.
  var resumenFiscal = resumenFiscalParaComprobanteVenta(venta, tipoComprobante);
  var totalEsperado = Math.round((Number(resumenFiscal.total) + Number.EPSILON) * 100) / 100;
  var originales = Array.isArray(venta.items) ? venta.items : Object.values(venta.items || {});
  var lineas = originales.map(function(item, indice) {
    var normalizado = pptoNormalizarItemGuardado(item);
    var cantidad = normalizado.qty > 0 ? normalizado.qty : 1;
    var importeBase = cantidad * normalizado.punit * (1 - normalizado.disc / 100);
    return {
      original: item,
      indice: indice,
      cantidad: cantidad,
      importeBase: Math.max(0, importeBase)
    };
  }).filter(function(linea) { return linea.importeBase > 0; });

  var sumaBase = lineas.reduce(function(total, linea) { return total + linea.importeBase; }, 0);
  if (!(totalEsperado > 0)) throw new Error('La venta no tiene un total facturable válido');
  if (!(sumaBase > 0) || !lineas.length) throw new Error('La venta no tiene renglones facturables');

  var factor = totalEsperado / sumaBase;
  var itemsFiscal = lineas.map(function(linea) {
    var original = linea.original || {};
    var precioFinal = Math.round(((linea.importeBase * factor) / linea.cantidad + Number.EPSILON) * 100) / 100;
    return Object.assign({}, original, {
      qty: linea.cantidad,
      cantidad: linea.cantidad,
      punit: precioFinal,
      precio: precioFinal,
      precioUnitario: precioFinal,
      precio_unitario: precioFinal,
      disc: 0,
      descuento: 0,
      descuentoPct: 0,
      porcentajeDescuento: 0,
      sub: Math.round((linea.cantidad * precioFinal + Number.EPSILON) * 100) / 100
    });
  });

  var totalLineas = itemsFiscal.reduce(function(total, item) {
    return total + (Number(item.qty) || 0) * (Number(item.punit) || 0);
  }, 0);
  totalLineas = Math.round((totalLineas + Number.EPSILON) * 100) / 100;
  var diferencia = Math.round(((totalEsperado - totalLineas) + Number.EPSILON) * 100) / 100;

  // Se ajusta preferentemente un renglón de cantidad 1 para conservar el
  // precio unitario a dos decimales. Si todas las cantidades son múltiples,
  // la última unidad se separa del grupo y absorbe solamente los centavos de
  // redondeo. Así no se crean importes negativos ni renglones ficticios.
  if (Math.abs(diferencia) >= 0.01) {
    var indiceUnitario = -1;
    for (var i = itemsFiscal.length - 1; i >= 0; i--) {
      if (Number(itemsFiscal[i].qty) === 1) { indiceUnitario = i; break; }
    }
    if (indiceUnitario >= 0) {
      var corregido = Math.round(((Number(itemsFiscal[indiceUnitario].punit) || 0) + diferencia + Number.EPSILON) * 100) / 100;
      itemsFiscal[indiceUnitario].punit = corregido;
      itemsFiscal[indiceUnitario].precio = corregido;
      itemsFiscal[indiceUnitario].precioUnitario = corregido;
      itemsFiscal[indiceUnitario].precio_unitario = corregido;
      itemsFiscal[indiceUnitario].sub = corregido;
    } else {
      var indiceMultiple = itemsFiscal.length - 1;
      var itemMultiple = itemsFiscal[indiceMultiple];
      var cantidadMultiple = Number(itemMultiple.qty) || 0;
      var precioMultiple = Number(itemMultiple.punit) || 0;
      var precioUltimaUnidad = Math.round((precioMultiple + diferencia + Number.EPSILON) * 100) / 100;
      if (!(cantidadMultiple > 1) || !(precioUltimaUnidad > 0)) {
        throw new Error('No se pudo distribuir el ajuste fiscal de ' + importeComprobanteVenta(diferencia));
      }
      itemMultiple.qty = cantidadMultiple - 1;
      itemMultiple.cantidad = cantidadMultiple - 1;
      itemMultiple.sub = Math.round(((cantidadMultiple - 1) * precioMultiple + Number.EPSILON) * 100) / 100;
      itemsFiscal.splice(indiceMultiple + 1, 0, Object.assign({}, itemMultiple, {
        qty: 1,
        cantidad: 1,
        punit: precioUltimaUnidad,
        precio: precioUltimaUnidad,
        precioUnitario: precioUltimaUnidad,
        precio_unitario: precioUltimaUnidad,
        sub: precioUltimaUnidad
      }));
    }
  }

  var totalPreparado = itemsFiscal.reduce(function(total, item) {
    return total + (Number(item.qty) || 0) * (Number(item.punit) || 0);
  }, 0);
  totalPreparado = Math.round((totalPreparado + Number.EPSILON) * 100) / 100;
  if (Math.abs(totalPreparado - totalEsperado) > 0.009) {
    throw new Error('Los renglones fiscales suman ' + importeComprobanteVenta(totalPreparado) + ' y la venta totaliza ' + importeComprobanteVenta(totalEsperado));
  }

  // También se fija explícitamente el precio fiscal sin IVA que consumirá la
  // función del servidor. No se vuelve a inferir desde el precio con IVA: esa
  // ida y vuelta era la segunda fuente de diferencias de centavos.
  var netoFiscalBase = Math.round(((totalEsperado / 1.21) + Number.EPSILON) * 100) / 100;
  var netoFiscal = null;
  // No todos los totales se reconstruyen con el primer centavo que surge de
  // dividir por 1,21. Se prueban los centavos vecinos y se conserva el más
  // cercano que, al volver a aplicar IVA, reproduce exactamente la venta.
  for (var desplazamientoNeto = -3; desplazamientoNeto <= 3; desplazamientoNeto++) {
    var candidatoNeto = Math.round(((netoFiscalBase + desplazamientoNeto / 100) + Number.EPSILON) * 100) / 100;
    var totalCandidato = Math.round(((candidatoNeto * 1.21) + Number.EPSILON) * 100) / 100;
    if (Math.abs(totalCandidato - totalEsperado) <= 0.009 && (netoFiscal === null || Math.abs(candidatoNeto - totalEsperado / 1.21) < Math.abs(netoFiscal - totalEsperado / 1.21))) {
      netoFiscal = candidatoNeto;
    }
  }
  if (netoFiscal === null) throw new Error('El total de la venta no puede discriminarse con IVA al centavo');
  var factorNeto = netoFiscal / totalPreparado;
  itemsFiscal.forEach(function(item) {
    item.precioUnitarioSinIvaFiscal = Math.round((((Number(item.punit) || 0) * factorNeto) + Number.EPSILON) * 100) / 100;
  });
  var netoLineas = itemsFiscal.reduce(function(total, item) {
    return total + (Number(item.qty) || 0) * (Number(item.precioUnitarioSinIvaFiscal) || 0);
  }, 0);
  netoLineas = Math.round((netoLineas + Number.EPSILON) * 100) / 100;
  var diferenciaNeto = Math.round(((netoFiscal - netoLineas) + Number.EPSILON) * 100) / 100;
  if (Math.abs(diferenciaNeto) >= 0.01) {
    var indiceAjusteNeto = -1;
    for (var j = itemsFiscal.length - 1; j >= 0; j--) {
      if (Number(itemsFiscal[j].qty) === 1) { indiceAjusteNeto = j; break; }
    }
    if (indiceAjusteNeto < 0) throw new Error('No se pudo cerrar el neto fiscal al centavo');
    itemsFiscal[indiceAjusteNeto].precioUnitarioSinIvaFiscal = Math.round(((Number(itemsFiscal[indiceAjusteNeto].precioUnitarioSinIvaFiscal) || 0) + diferenciaNeto + Number.EPSILON) * 100) / 100;
  }
  var netoPreparado = Math.round((itemsFiscal.reduce(function(total, item) {
    return total + (Number(item.qty) || 0) * (Number(item.precioUnitarioSinIvaFiscal) || 0);
  }, 0) + Number.EPSILON) * 100) / 100;
  var totalFiscalCalculado = Math.round(((netoPreparado * 1.21) + Number.EPSILON) * 100) / 100;
  if (Math.abs(netoPreparado - netoFiscal) > 0.009 || Math.abs(totalFiscalCalculado - totalEsperado) > 0.009) {
    throw new Error('El neto fiscal no permite reproducir exactamente el total de la venta');
  }
  var ivaFiscal = Math.round(((totalEsperado - netoFiscal) + Number.EPSILON) * 100) / 100;
  return {
    venta: Object.assign({}, venta, {
      items: itemsFiscal,
      subtotal: totalEsperado,
      descuento: 0,
      descuentoGeneral: 0,
      descuentoPct: 0,
      descuentoAmt: 0,
      conIva: true,
      iva: ivaFiscal,
      total: totalEsperado,
      importe_neto: netoFiscal,
      importe_iva: ivaFiscal,
      importe_total: totalEsperado,
      iva_incluido: true,
      totalFiscalEsperado: totalEsperado,
      totalVentaOriginal: totalEsperado,
      // Foto inmutable del valor comercial que existía al emitir. Permite
      // distinguir una factura incorrecta de una venta editada posteriormente.
      totalComercialAlEmitir: resumen.total,
      contratoIntegridadFiscal: 'v2'
    }),
    resumen: resumen,
    resumenFiscal: resumenFiscal,
    totalEsperado: totalEsperado,
    totalPreparado: totalPreparado
  };
}

function _resumenSnapshotFiscal(datos) {
  var detalle = (datos && Array.isArray(datos.detalle)) ? datos.detalle : [];
  var neto = detalle.reduce(function(total, linea) { return total + (Number(linea.precio_total) || 0); }, 0);
  var exentos = Number(datos && datos.exentos) || 0;
  var noGravados = Number(datos && datos.nogravados) || 0;
  var percepciones = (Number(datos && datos.percepciones_iibb) || 0) + (Number(datos && datos.percepciones_iva) || 0);
  var internos = Number(datos && datos.impuestos_internos) || 0;
  var tributos = (datos && Array.isArray(datos.tributos) ? datos.tributos : []).reduce(function(total, tributo) {
    return total + (Number(tributo.importe || tributo.monto || tributo.total) || 0);
  }, 0);
  var totalFiscal = Number(datos && datos.total) || 0;
  var iva = Math.max(0, totalFiscal - neto - exentos - noGravados - percepciones - internos - tributos);
  var alicuotas = Array.from(new Set(detalle.map(function(linea) { return Number(linea.alicuota) || 0; }).filter(function(valor) { return valor > 0; }))).sort(function(a,b){ return a-b; });
  return { neto:neto, iva:iva, total:totalFiscal, exentos:exentos, noGravados:noGravados, percepciones:percepciones, internos:internos, tributos:tributos, alicuotas:alicuotas };
}

function prepararVentaParaNotaCredito(venta, snapshot) {
  var resumen = _resumenSnapshotFiscal(snapshot);
  if (!(resumen.total > 0) || !(resumen.neto > 0)) throw new Error('La factura original no tiene un importe fiscal válido');
  var alicuotas = resumen.alicuotas || [];
  if (alicuotas.some(function(alicuota){ return Math.abs(alicuota - 21) > 0.001; })) {
    throw new Error('La factura original contiene una alícuota no soportada para una anulación automática');
  }
  var items = (snapshot.detalle || []).map(function(linea) {
    var cantidad = Number(linea.cantidad) || 0;
    var netoUnitario = Number(linea.precio_unitario) || 0;
    if (!(cantidad > 0) || !(netoUnitario > 0)) throw new Error('La factura original contiene un renglón fiscal incompleto');
    var finalUnitario = Math.round((netoUnitario * 1.21 + Number.EPSILON) * 100) / 100;
    return {
      cod: linea.codigo || '', desc: linea.descripcion || 'Producto', qty:cantidad, cantidad:cantidad,
      punit:finalUnitario, precio:finalUnitario, precioUnitario:finalUnitario,
      precioUnitarioSinIvaFiscal:netoUnitario, disc:0, descuento:0
    };
  });
  // La NC debe usar la identidad fiscal que devolvió ARCA para la factura
  // original. La venta comercial puede no conservar el CUIT en su objeto.
  var clienteFiscal = (snapshot && snapshot.cliente) || {};
  var cuitFiscal = String(clienteFiscal.documento_nro || '').replace(/\D/g, '');
  if (String((venta && venta.factura && venta.factura.tipo) || '').trim().endsWith('A') && cuitFiscal.length !== 11) {
    throw new Error('ARCA no devolvió un CUIT válido del cliente para la Factura A original');
  }
  return Object.assign({}, venta, {
    clienteCuit: cuitFiscal || venta.clienteCuit || venta.cuitCliente || venta.cuit || '',
    clienteDni: String(clienteFiscal.documento_tipo || '').toUpperCase() === 'DNI'
      ? String(clienteFiscal.documento_nro || '').replace(/\D/g, '')
      : (venta.clienteDni || ''),
    items:items, conIva:true,
    subtotal:resumen.neto, iva:resumen.iva, total:resumen.total,
    importe_neto:resumen.neto, importe_iva:resumen.iva, importe_total:resumen.total,
    iva_incluido:true, totalFiscalEsperado:resumen.total,
    origenNotaCredito:'factura-original'
  });
}
module.exports={names:["normalizarNumeroExcel","pptoNumeroGuardado","descripcionVisibleItemDocumento","pptoNormalizarItemGuardado","ventaSubtotalBruto","ventaTieneDescuentoItem","ventaNormalizarDescuentoParaVista","ventaPorcentajeDescuentoEfectivo","ventaEsSinCargo","resumenEconomicoComprobanteVenta","resumenFiscalParaComprobanteVenta","importeComprobanteVenta","prepararVentaParaFacturacion","_resumenSnapshotFiscal","prepararVentaParaNotaCredito"],normalizarSolicitudEmisionFiscal,prepararVentaParaFacturacion,prepararVentaParaNotaCredito,resumenEconomicoComprobanteVenta,resumenFiscalParaComprobanteVenta};
