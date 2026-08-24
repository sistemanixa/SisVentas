/**
 * Cloud Function: emitirFactura / testTFApp
 * ══════════════════════════════════════════════════════════════════
 * Reemplaza la llamada directa desde el navegador a TusFacturasApp,
 * que fallaba porque su API no soporta CORS para llamadas desde un
 * navegador de cliente final. Esta función corre en el servidor de
 * Google (server-to-server, sin restricción de CORS) y guarda el
 * resultado directamente en Firebase.
 *
 * Los tokens de TusFacturasApp viven en Secret Manager, no en el
 * HTML público de SisVentas.
 *
 * Son HTTP triggers simples (onRequest), no Callable Functions
 * (onCall) — evita la fricción de conectar Firebase Auth con el IAM
 * de Cloud Run, que requeriría desplegar vía `firebase deploy` en
 * vez de `gcloud functions deploy`. En su lugar, se protege el
 * acceso con una clave compartida simple (FRONTEND_KEY) que sólo
 * conoce el código de SisVentas.
 * ══════════════════════════════════════════════════════════════════
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp({
  databaseURL: 'https://nixa-sisventas-default-rtdb.firebaseio.com'
});
const db = admin.database();

const TFAPP_USERTOKEN = defineSecret('TFAPP_USERTOKEN');
const TFAPP_APITOKEN  = defineSecret('TFAPP_APITOKEN');
const TFAPP_APIKEY    = defineSecret('TFAPP_APIKEY');
const FRONTEND_KEY    = defineSecret('FRONTEND_KEY');

const ENDPOINT_FACTURACION = 'https://www.tusfacturas.app/app/api/v2/facturacion/nuevo';
const ENDPOINT_REGENERAR_PDF = 'https://www.tusfacturas.app/app/api/v2/facturacion/regenerar_pdf';
const ENDPOINT_CONSULTA = 'https://www.tusfacturas.app/app/api/v2/facturacion/consulta';
const ENDPOINT_CONSULTA_AVANZADA = 'https://www.tusfacturas.app/app/api/v2/facturacion/consulta_avanzada';
const ENDPOINT_INFO_CUIT = 'https://www.tusfacturas.app/app/api/v2/clientes/afip-info';
const ENDPOINT_ESTADO      = 'https://www.tusfacturas.app/app/api/v2/estado_servicios/alertas';

function formatearFechaAR(date) {
  var d = String(date.getDate()).padStart(2, '0');
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var y = date.getFullYear();
  return d + '/' + m + '/' + y;
}

function redondearDinero(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// TusFacturasApp ha usado nombres distintos para los mismos campos entre
// respuestas. La factura emitida se construye una sola vez, en el servidor,
// con una forma estable para que el cliente nunca dependa de importar un CSV.
function primerCampoFiscal(fuentes, campos) {
  for (var i = 0; i < fuentes.length; i++) {
    var fuente = fuentes[i] || {};
    for (var j = 0; j < campos.length; j++) {
      var valor = fuente[campos[j]];
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') return valor;
    }
  }
  return '';
}

function numeroFiscalPlano(valor) {
  var partes = String(valor || '').match(/\d+/g) || [];
  return partes.length ? String(parseInt(partes[partes.length - 1], 10) || '') : '';
}

function fechaConsultaFiscal(valor) {
  var texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto.split('-').reverse().join('/');
  return texto;
}

function recolectarObjetosFiscal(valor, salida, profundidad) {
  if (!valor || profundidad > 6) return;
  if (Array.isArray(valor)) {
    valor.forEach(function(item) { recolectarObjetosFiscal(item, salida, profundidad + 1); });
    return;
  }
  if (typeof valor !== 'object') return;
  salida.push(valor);
  Object.keys(valor).forEach(function(clave) { recolectarObjetosFiscal(valor[clave], salida, profundidad + 1); });
}

function identidadFiscalPorCae(respuesta, caeBuscado) {
  var caeNormalizado = String(caeBuscado || '').replace(/\D/g, '');
  if (!caeNormalizado) return null;
  var objetos = [];
  recolectarObjetosFiscal(respuesta, objetos, 0);
  for (var i = 0; i < objetos.length; i++) {
    var candidato = objetos[i] || {};
    var cae = String(candidato.cae || candidato.CAE || candidato.codigo_autorizacion || candidato.codigoAutorizacion || '').replace(/\D/g, '');
    if (!cae || cae !== caeNormalizado) continue;
    var tipo = String(candidato.tipo || candidato.tipo_comprobante || candidato.tipoComprobante || '').trim();
    var puntoVenta = parseInt(candidato.punto_venta || candidato.puntoVenta || candidato.ptoVta || candidato.pdv, 10) || 0;
    var numero = numeroFiscalPlano(candidato.numero || candidato.nro || candidato.nro_comprobante || candidato.numero_comprobante || candidato.numeroFactura || candidato.nroCmp);
    if (tipo && puntoVenta && numero) return { tipo:tipo, punto_venta:puntoVenta, numero:parseInt(numero, 10) };
  }
  return null;
}

function prepararDetalleFiscal(venta) {
  var items = Array.isArray(venta.items) ? venta.items : Object.values(venta.items || {});
  if (!items.length) throw new Error('La venta no tiene renglones facturables');

  var detalle = items.map(function (i) {
    var cantidad = Number(i.qty || i.cantidad || 0);
    var netoInformado = Number(i.precioUnitarioSinIvaFiscal);
    var precioFinal = Number(i.punit || i.precio || i.precioUnitario || 0);
    if (!(cantidad > 0)) throw new Error('Hay un renglón con cantidad inválida');
    var precioSinIva = Number.isFinite(netoInformado) && netoInformado > 0
      ? redondearDinero(netoInformado)
      : redondearDinero(precioFinal / 1.21);
    if (!(precioSinIva > 0)) throw new Error('Hay un renglón con precio inválido');
    return {
      cantidad: cantidad,
      afecta_stock: 'N',
      bonificacion_porcentaje: 0,
      producto: {
        descripcion: i.desc || i.descripcion || 'Producto',
        unidad_bulto: 1,
        lista_precios: 'SisVentas',
        codigo: i.cod || i.codigo || '',
        precio_unitario_sin_iva: precioSinIva,
        alicuota: 21,
        unidad_medida: 7,
        actualiza_precio: 'N',
        rg5329: 'N'
      }
    };
  });

  var neto = redondearDinero(detalle.reduce(function (suma, linea) {
    return suma + linea.producto.precio_unitario_sin_iva * linea.cantidad;
  }, 0));
  var totalCalculado = redondearDinero(neto * 1.21);
  var totalEsperado = redondearDinero(venta.totalFiscalEsperado || venta.importe_total || venta.total || 0);
  if (venta.totalFiscalEsperado !== undefined && Math.abs(totalCalculado - totalEsperado) > 0.009) {
    throw new Error('Integridad fiscal: los renglones totalizan $' + totalCalculado.toFixed(2) + ' y la venta $' + totalEsperado.toFixed(2));
  }
  return { detalle: detalle, neto: neto, total: totalCalculado, totalEsperado: totalEsperado };
}

function setCors(req, res) {
  var origen = String(req.get('Origin') || '');
  var permitido = origen === 'https://ventas.sistemanixa.com' || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen);
  res.set('Access-Control-Allow-Origin', permitido ? origen : 'https://ventas.sistemanixa.com');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Frontend-Key');
}

function chequearAuth(req, res) {
  var key = req.get('X-Frontend-Key');
  if (key !== FRONTEND_KEY.value()) {
    res.status(401).json({ error: true, mensaje: 'No autorizado' });
    return false;
  }
  return true;
}

exports.emitirFactura = onRequest(
  { secrets: [TFAPP_USERTOKEN, TFAPP_APITOKEN, TFAPP_APIKEY, FRONTEND_KEY], region: 'southamerica-east1', cors: false },
  async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: true, mensaje: 'Método no permitido' }); return; }
    if (!chequearAuth(req, res)) return;

    var data = req.body || {};
    if (data.accion === 'consultar_cuit') {
      var cuitConsulta = String(data.cuit || '').replace(/\D/g, '');
      if (!/^\d{11}$/.test(cuitConsulta)) {
        res.status(400).json({ error:true, mensaje:'El CUIT debe tener 11 dígitos' }); return;
      }
      try {
        var respCuit = await fetch(ENDPOINT_INFO_CUIT, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            usertoken:TFAPP_USERTOKEN.value(), apikey:TFAPP_APIKEY.value(), apitoken:TFAPP_APITOKEN.value(),
            cliente:{ documento_nro:cuitConsulta, documento_tipo:'CUIT' }
          })
        });
        var infoCuit = await respCuit.json().catch(function(){ return {}; });
        var razon = String(infoCuit.razon_social || '').trim();
        if (!respCuit.ok || (!razon && String(infoCuit.error || '').toUpperCase() === 'S')) {
          var erroresCuit = Array.isArray(infoCuit.errores) ? infoCuit.errores.flat(Infinity).filter(Boolean).join(' · ') : String(infoCuit.errores || '');
          res.status(422).json({ error:true, mensaje:erroresCuit || 'ARCA no devolvió información para este CUIT' }); return;
        }
        res.json({
          error:false,
          datos:{
            cuit:cuitConsulta, razonSocial:razon, condicionImpositiva:String(infoCuit.condicion_impositiva || '').trim(),
            direccion:String(infoCuit.direccion || '').trim(), localidad:String(infoCuit.localidad || '').trim(),
            codigoPostal:String(infoCuit.codigopostal || '').trim(), provincia:String(infoCuit.provincia || '').trim(),
            estado:String(infoCuit.estado || '').trim(), actividades:Array.isArray(infoCuit.actividad) ? infoCuit.actividad : [],
            apocExiste:String(infoCuit.apoc_existe || '').trim(), apocInfo:String(infoCuit.apoc_info || '').trim()
          },
          advertencias:String(infoCuit.error || '').toUpperCase() === 'S' ? (infoCuit.errores || []) : []
        });
      } catch (e) {
        res.status(502).json({ error:true, mensaje:'No se pudo consultar ARCA: ' + e.message });
      }
      return;
    }
    if (data.accion === 'consultar_comprobante') {
      var tipoConsulta = String(data.tipoComprobante || '').trim();
      var puntoConsulta = parseInt(data.puntoVenta, 10) || 0;
      var numeroConsulta = parseInt(data.numero, 10) || 0;
      if (!tipoConsulta || !puntoConsulta || !numeroConsulta) {
        res.status(400).json({ error: true, mensaje: 'Faltan tipo, punto de venta o número del comprobante' }); return;
      }
      try {
        var respConsulta = await fetch(ENDPOINT_CONSULTA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usertoken: TFAPP_USERTOKEN.value(),
            apitoken: TFAPP_APITOKEN.value(),
            apikey: TFAPP_APIKEY.value(),
            comprobante: { tipo: tipoConsulta, operacion: 'V', punto_venta: String(puntoConsulta), numero: String(numeroConsulta) }
          })
        });
        var dataConsulta = await respConsulta.json();
        if (!respConsulta.ok || dataConsulta.error === 'S') {
          var errorConsulta = Array.isArray(dataConsulta.errores) ? dataConsulta.errores.join(', ') : (dataConsulta.errores || 'FacturasApp no devolvió el comprobante fiscal');
          res.status(422).json({ error: true, mensaje: errorConsulta }); return;
        }
        // Normalizamos también la identidad fiscal en un campo estable. La
        // estructura interna de TusFacturasApp puede variar, pero una NC A
        // siempre debe reutilizar este CUIT de la factura original.
        var consultaComprobante = dataConsulta.comprobante || {};
        var consultaCliente = dataConsulta.cliente || consultaComprobante.cliente || {};
        res.status(200).json({
          ok: true,
          comprobante: dataConsulta,
          clienteFiscal: {
            documento_tipo: String(consultaCliente.documento_tipo || ''),
            documento_nro: String(consultaCliente.documento_nro || '').replace(/[^0-9]/g, '')
          }
        });
      } catch (e) {
        res.status(502).json({ error: true, mensaje: 'No se pudo consultar el comprobante fiscal: ' + e.message });
      }
      return;
    }

    // Recuperación excepcional para comprobantes antiguos que recibieron CAE
    // pero no conservaron su identidad completa en SisVentas. Se consulta por
    // la fecha de emisión y se acepta únicamente el registro cuyo CAE coincide.
    if (data.accion === 'recuperar_identidad_fiscal') {
      var caeBuscar = String(data.cae || '').replace(/\D/g, '');
      var fechaBuscar = fechaConsultaFiscal(data.fecha);
      if (!caeBuscar || !fechaBuscar) {
        res.status(400).json({ error:true, mensaje:'Faltan CAE o fecha para recuperar el comprobante' }); return;
      }
      try {
        var respAvanzada = await fetch(ENDPOINT_CONSULTA_AVANZADA, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({
            usertoken: TFAPP_USERTOKEN.value(),
            apitoken: TFAPP_APITOKEN.value(),
            apikey: TFAPP_APIKEY.value(),
            busqueda_tipo:'F',
            pagina:0,
            limite:100,
            comprobante:{ fecha:fechaBuscar, operacion:'V' }
          })
        });
        var dataAvanzada = await respAvanzada.json();
        if (!respAvanzada.ok || dataAvanzada.error === 'S') {
          var errorAvanzada = Array.isArray(dataAvanzada.errores) ? dataAvanzada.errores.join(', ') : (dataAvanzada.errores || 'No se pudo consultar ARCA');
          res.status(422).json({ error:true, mensaje:errorAvanzada }); return;
        }
        var identidad = identidadFiscalPorCae(dataAvanzada, caeBuscar);
        if (!identidad) {
          res.status(404).json({ error:true, mensaje:'No se encontró un comprobante de esa fecha con el CAE indicado' }); return;
        }
        res.status(200).json({ ok:true, identidad:identidad });
      } catch (e) {
        res.status(502).json({ error:true, mensaje:'No se pudo recuperar la identidad fiscal: ' + e.message });
      }
      return;
    }

    if (data.accion === 'regenerar_pdf') {
      var tipoPdf = String(data.tipoComprobante || '').trim();
      var puntoPdf = parseInt(data.puntoVenta, 10) || 0;
      var numeroPdf = parseInt(data.numero, 10) || 0;
      if (!tipoPdf || !puntoPdf || !numeroPdf) {
        res.status(400).json({ error: true, mensaje: 'Faltan tipo, punto de venta o número del comprobante' }); return;
      }
      try {
        var respPdf = await fetch(ENDPOINT_REGENERAR_PDF, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usertoken: TFAPP_USERTOKEN.value(),
            apitoken: TFAPP_APITOKEN.value(),
            apikey: TFAPP_APIKEY.value(),
            comprobante: { tipo: tipoPdf, operacion: 'V', punto_venta: String(puntoPdf), numero: String(numeroPdf) }
          })
        });
        var dataPdf = await respPdf.json();
        if (!respPdf.ok || dataPdf.error !== 'N' || !dataPdf.comprobante_pdf_url) {
          var errorPdf = Array.isArray(dataPdf.errores) ? dataPdf.errores.join(', ') : (dataPdf.errores || 'FacturasApp no devolvió el PDF original');
          res.status(422).json({ error: true, mensaje: errorPdf }); return;
        }
        res.status(200).json({ ok: true, pdf_url: dataPdf.comprobante_pdf_url });
      } catch (e) {
        res.status(502).json({ error: true, mensaje: 'No se pudo recuperar el PDF original: ' + e.message });
      }
      return;
    }

    var venta = data.venta;
    var tipoComprobante = data.tipoComprobante;
    var provincia = data.provincia;
    var puntoVenta = data.puntoVenta || 1;
    var rubro = data.rubro || 'Seguridad y domótica';

    if (!venta || !tipoComprobante) {
      res.status(400).json({ error: true, mensaje: 'Faltan datos de la venta o el tipo de comprobante' }); return;
    }
    if (data.esNotaCredito) {
      var asociado = data.comprobante_asociado || {};
      if (!asociado.tipo || !(parseInt(asociado.punto_venta, 10) > 0) || !(parseInt(asociado.numero, 10) > 0) || !asociado.fecha) {
        res.status(400).json({ error:true, mensaje:'La nota de crédito no tiene una factura original identificada completamente' }); return;
      }
    }
    var cuitClienteNormalizado = String(venta.clienteCuit || '').replace(/[^0-9]/g, '');
    var razonSocialFiscal = String(venta.clienteRazonSocial || venta.razonSocialFiscal || '').trim();
    if (/\sA$/.test(String(tipoComprobante || '').trim()) && cuitClienteNormalizado.length !== 11) {
      res.status(400).json({ error: true, mensaje: 'El cliente no tiene CUIT cargado — el comprobante A lo requiere obligatoriamente' }); return;
    }
    if (/\sA$/.test(String(tipoComprobante || '').trim()) && !razonSocialFiscal) {
      res.status(400).json({ error: true, mensaje: 'El cliente no tiene razón social fiscal cargada — el comprobante A la requiere obligatoriamente' }); return;
    }
    if (!provincia) {
      res.status(400).json({ error: true, mensaje: 'Falta configurar la provincia del emisor' }); return;
    }

    var hoy = new Date();
    var fechaFmt = formatearFechaAR(hoy);
    var vencimiento = new Date(hoy);
    vencimiento.setDate(vencimiento.getDate() + 10);
    var vencFmt = formatearFechaAR(vencimiento);

    var tieneCuit = cuitClienteNormalizado.length === 11;
    var tieneDni  = !!(venta.clienteDni  && venta.clienteDni.replace(/[^0-9]/g,'').length > 0);
    var docTipo, docNro;
    if (tieneCuit) {
      docTipo = 'CUIT';
      docNro  = venta.clienteCuit.replace(/[^0-9]/g, '');
    } else if (tieneDni) {
      docTipo = 'DNI';
      docNro  = venta.clienteDni.replace(/[^0-9]/g, '');
    } else {
      // Consumidor final sin documento — según documentación oficial de TusFacturasApp:
      // documento_tipo = "OTRO", documento_nro = "0"
      docTipo = 'OTRO';
      docNro  = '0';
    }
    var preparacionFiscal;
    try {
      preparacionFiscal = prepararDetalleFiscal(venta);
    } catch (errorFiscal) {
      res.status(422).json({ error: true, mensaje: errorFiscal.message }); return;
    }

    var body = {
      usertoken: TFAPP_USERTOKEN.value(),
      apitoken:  TFAPP_APITOKEN.value(),
      apikey:    TFAPP_APIKEY.value(),
      cliente: {
        documento_tipo:  docTipo,
        documento_nro:   docNro,
        razon_social:    razonSocialFiscal || venta.cliente || 'Consumidor Final',
        email:           venta.clienteEmail || '',
        domicilio:       venta.clienteDir   || 'Sin especificar',
        provincia:       provincia,
        envia_por_mail:  venta.clienteEmail ? 'S' : 'N',
        condicion_pago:  '201',
        // Las notas de crédito A deben conservar la condición del receptor
        // de la Factura A asociada. Comparar solo "FACTURA A" hacía que
        // "NOTA DE CREDITO A" se enviara erróneamente como Consumidor Final.
        condicion_iva:   /\sA$/.test(String(tipoComprobante || '').trim()) ? 'RI' : 'CF',
        reclama_deuda:   'N',
        rg5329:          'N'
      },
      comprobante: {
        fecha:                    fechaFmt,
        tipo:                     tipoComprobante,
        operacion:                'V',
        idioma:                   '1',
        punto_venta:              puntoVenta,
        moneda:                   'PES',
        cotizacion:                1,
        vencimiento:              vencFmt,
        periodo_facturado_desde:  fechaFmt,
        periodo_facturado_hasta:  fechaFmt,
        rubro:                    rubro,
        rubro_grupo_contable:     rubro,
        // El navegador envía el contrato fiscal cerrado al centavo y el
        // servidor lo vuelve a calcular antes de contactar a FacturasApp.
        // Si no coincide con la venta, la emisión se bloquea aquí.
        total: preparacionFiscal.total,
        detalle: preparacionFiscal.detalle,
        // Comprobante asociado — requerido por AFIP para Notas de Crédito/Débito
        ...(data.comprobante_asociado ? {
          comprobantes_asociados: [{
            tipo_comprobante:   data.comprobante_asociado.tipo,
            punto_venta:        String(data.comprobante_asociado.punto_venta || puntoVenta).padStart(4, '0'),
            numero:             parseInt(data.comprobante_asociado.numero) || 0,
            cuit:               '20346484161',
            fecha:              data.comprobante_asociado.fecha
          }]
        } : {})
      }
    };

    var resp, respData;
    try {
      resp = await fetch(ENDPOINT_FACTURACION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      respData = await resp.json();
    } catch (e) {
      res.status(502).json({ error: true, mensaje: 'Error de conexión con TusFacturasApp: ' + e.message }); return;
    }

    if (!resp.ok) {
      res.status(502).json({ error: true, mensaje: 'TusFacturasApp no está respondiendo (HTTP ' + resp.status + ')' }); return;
    }
    if (respData.error !== 'N') {
      var errores = Array.isArray(respData.errores) ? respData.errores.join(', ') : (respData.errores || 'Error desconocido');
      res.status(422).json({ error: true, mensaje: 'Error AFIP/ARCA: ' + errores }); return;
    }

    // Log completo para debug — ver estructura exacta de respData
    console.log('[TFApp respuesta completa]', JSON.stringify(respData));

    // El proveedor es la fuente fiscal. Normalizamos la respuesta completa y
    // guardamos los importes que este mismo servidor calculó y envió. Así no
    // existe ningún paso posterior de importación para completar la factura.
    var fuentesFiscales = [respData.comprobante || {}, respData.factura || {}, respData.resultado || {}, respData];
    var cae = String(primerCampoFiscal(fuentesFiscales, ['cae', 'CAE', 'codigo_autorizacion', 'codigoAutorizacion'])).trim();
    var pdfUrl = String(primerCampoFiscal(fuentesFiscales, ['comprobante_pdf_url', 'pdf_url', 'pdf', 'pdfUrl'])).trim();
    var nroComp = numeroFiscalPlano(primerCampoFiscal(fuentesFiscales, ['numero', 'nro', 'nro_comprobante', 'numero_comprobante', 'numeroFactura', 'nroCmp', 'nro_doc', 'nroDoc', 'numero_documento']));
    var puntoFiscal = parseInt(primerCampoFiscal(fuentesFiscales, ['punto_venta', 'puntoVenta', 'ptoVta', 'pdv', 'punto_de_venta']), 10) || parseInt(puntoVenta, 10) || 0;
    var caeVto = String(primerCampoFiscal(fuentesFiscales, ['cae_vencimiento', 'caeVencimiento', 'CAEFchVto', 'vencimiento_cae', 'fecha_vencimiento_cae'])).trim();
    var fechaFiscal = String(primerCampoFiscal(fuentesFiscales, ['fecha', 'fecha_emision', 'fechaEmision', 'invoice_date'])).trim() || fechaFmt;
    var totalFiscal = preparacionFiscal.total;
    var netoFiscal = preparacionFiscal.neto;
    var ivaFiscal = redondearDinero(totalFiscal - netoFiscal);
    var numeroCompleto = nroComp && puntoFiscal
      ? String(puntoFiscal).padStart(5, '0') + '-' + String(nroComp).padStart(8, '0') : '';
    // Tipo y punto se conocen desde el pedido original; el único dato que no
    // puede inferirse es el número autorizado. Si el proveedor cambia el
    // nombre del campo, se guarda la respuesta cruda y se marca pendiente,
    // pero nunca se pretende que el comprobante esté completo silenciosamente.
    var integridadFiscalCompleta = !!(cae && caeVto && numeroCompleto && fechaFiscal && totalFiscal > 0);

    var resultado = {
      cae:                       cae,
      cae_vencimiento:           caeVto,
      vencimiento_cae:           caeVto,
      numero:                    numeroCompleto,
      numero_comprobante:        numeroCompleto,
      numeroComprobante:         numeroCompleto,
      nroComprobante:            numeroCompleto,
      punto_venta:               puntoFiscal,
      puntoVenta:                puntoFiscal,
      tipo:                      tipoComprobante,
      tipoComprobante:           tipoComprobante,
      pdf_url:                   pdfUrl,
      comprobante_pdf_url:       pdfUrl,
      fecha:                     fechaFiscal,
      neto:                      netoFiscal,
      neto_gravado:              netoFiscal,
      iva:                       ivaFiscal,
      importe_iva:               ivaFiscal,
      importe_total:             totalFiscal,
      importeTotal:              totalFiscal,
      totalFiscal:               totalFiscal,
      totalFiscalEsperado:       totalFiscal,
      totalComercialAlEmitir:    redondearDinero(venta.totalComercialAlEmitir || venta.totalVentaComercialAlEmitir || 0),
      contratoIntegridadFiscal:  'v2',
      integridadFiscalCompleta:  integridadFiscalCompleta,
      estadoIntegridadFiscal:    integridadFiscalCompleta ? 'completa' : 'pendiente_verificacion',
      datos_fiscales: {
        cliente: respData.cliente || {},
        comprobante: respData.comprobante || {},
        tipo: tipoComprobante,
        punto_venta: puntoFiscal,
        numero: nroComp,
        fecha: fechaFiscal,
        cae: cae,
        vencimiento_cae: caeVto,
        neto: netoFiscal,
        iva: ivaFiscal,
        total: totalFiscal
      },
      _respuesta_raw: JSON.stringify(respData).slice(0, 500)
    };

    if (venta.fbKey) {
      // Una NC pertenece a la factura original pero no debe reemplazarla: el
      // cliente conserva el comprobante emitido y la UI registra la NC en su
      // campo específico después de recibir esta respuesta.
      if (!data.esNotaCredito) await db.ref('sisventas/ventas/' + venta.fbKey).update({ factura: resultado });
      await db.ref('sisventas/log_actividad').push({
        usuario: data.usuario || 'Desconocido',
        email: data.email || '',
        accion: data.esNotaCredito ? 'Nota de crédito emitida' : 'Factura emitida',
        detalle: (venta.id || '') + ' — ' + tipoComprobante + ' — CAE ' + resultado.cae,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        fecha: new Date().toISOString()
      });
    }

    res.status(200).json(resultado);
  }
);

exports.testTFApp = onRequest(
  { secrets: [TFAPP_USERTOKEN, TFAPP_APITOKEN, TFAPP_APIKEY, FRONTEND_KEY], region: 'southamerica-east1', cors: false },
  async (req, res) => {
    setCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: true, mensaje: 'Método no permitido' }); return; }
    if (!chequearAuth(req, res)) return;

    var resp, data;
    try {
      resp = await fetch(ENDPOINT_ESTADO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usertoken: TFAPP_USERTOKEN.value(),
          apitoken:  TFAPP_APITOKEN.value(),
          apikey:    TFAPP_APIKEY.value()
        })
      });
    } catch (e) {
      res.status(502).json({ error: true, mensaje: 'Error de red al contactar TusFacturasApp: ' + e.message }); return;
    }

    if (!resp.ok) {
      res.status(502).json({ error: true, mensaje: 'TusFacturasApp no está respondiendo (HTTP ' + resp.status + ')' }); return;
    }

    data = await resp.json();
    if (data.error === 'N') {
      res.status(200).json({ ok: true, facturacion: data.facturacion || 'OK' });
    } else {
      var errores = Array.isArray(data.errores) ? data.errores.join(', ') : (data.errores || 'Verificá los tokens');
      res.status(422).json({ error: true, mensaje: errores });
    }
  }
);
