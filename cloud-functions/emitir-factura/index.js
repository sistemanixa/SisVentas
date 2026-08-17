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

function setCors(res) {
  res.set('Access-Control-Allow-Origin', 'https://ventas.sistemanixa.com');
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
    setCors(res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: true, mensaje: 'Método no permitido' }); return; }
    if (!chequearAuth(req, res)) return;

    var data = req.body || {};
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
        res.status(200).json({ ok: true, comprobante: dataConsulta });
      } catch (e) {
        res.status(502).json({ error: true, mensaje: 'No se pudo consultar el comprobante fiscal: ' + e.message });
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
    if (tipoComprobante === 'FACTURA A' && !venta.clienteCuit) {
      res.status(400).json({ error: true, mensaje: 'El cliente no tiene CUIT cargado — la Factura A lo requiere obligatoriamente' }); return;
    }
    if (!provincia) {
      res.status(400).json({ error: true, mensaje: 'Falta configurar la provincia del emisor' }); return;
    }

    var hoy = new Date();
    var fechaFmt = formatearFechaAR(hoy);
    var vencimiento = new Date(hoy);
    vencimiento.setDate(vencimiento.getDate() + 10);
    var vencFmt = formatearFechaAR(vencimiento);

    var tieneCuit = !!(venta.clienteCuit && venta.clienteCuit.replace(/[^0-9]/g,'').length > 0);
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
        razon_social:    venta.cliente || 'Consumidor Final',
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

    // TusFacturasApp puede devolver el CAE en distintos lugares según la versión
    var cae = '';
    var pdfUrl = '';
    var nroComp = '';
    var caeVto = '';
    if (respData.comprobante) {
      cae     = String(respData.comprobante.cae || respData.comprobante.CAE || '').trim();
      pdfUrl  = respData.comprobante.comprobante_pdf_url || respData.comprobante.pdf || respData.comprobante.pdf_url || '';
      nroComp = String(respData.comprobante.numero || respData.comprobante.nro || '');
      caeVto  = respData.comprobante.cae_vencimiento || respData.comprobante.CAEFchVto || '';
    }
    // Fallback: a veces viene directo en la raíz
    if (!cae) cae = String(respData.cae || respData.CAE || '').trim();
    if (!pdfUrl) pdfUrl = respData.comprobante_pdf_url || respData.pdf || respData.pdf_url || '';

    var resultado = {
      cae:                cae,
      cae_vencimiento:    caeVto,
      numero_comprobante: nroComp,
      tipo:               tipoComprobante,
      pdf_url:            pdfUrl,
      fecha:              fechaFmt,
      datos_fiscales:     { cliente: respData.cliente || {}, comprobante: respData.comprobante || {} },
      _respuesta_raw:     JSON.stringify(respData).slice(0, 500) // para debug
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
    setCors(res);
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
