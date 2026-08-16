const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.js');

test('v2.0.358 conserva su instantánea histórica', () => {
  assert.match(read('js/app.v2.0.358.js'), /VERSION: 'v2\.0\.358-firebase'/);
});

function cargarPreparador() {
  const inicio = app.indexOf('function prepararVentaParaFacturacion');
  const fin = app.indexOf('function compararFacturaConVenta', inicio);
  assert.ok(inicio > 0 && fin > inicio, 'debe existir el contrato fiscal');
  const fuente = app.slice(inicio, fin);
  const normalizar = (item = {}) => ({
    qty: Number(item.qty ?? item.cantidad ?? 1) || 1,
    punit: Number(item.punit ?? item.precio ?? 0) || 0,
    disc: Number(item.disc ?? item.descuento ?? 0) || 0
  });
  const dinero = (valor) => '$' + Number(valor).toFixed(2);
  return Function('pptoNormalizarItemGuardado', 'resumenEconomicoComprobanteVenta', 'resumenFiscalParaComprobanteVenta', 'importeComprobanteVenta', fuente + '; return prepararVentaParaFacturacion;')(
    normalizar,
    (venta) => venta._resumen,
    (venta, tipo) => {
      const resumen = venta._resumen;
      if (venta.conIva === false && /FACTURA|NOTA DE/.test(String(tipo || '').toUpperCase())) {
        const neto = resumen.total;
        const iva = Math.round(neto * 0.21 * 100) / 100;
        return { ...resumen, subtotalNeto: neto, iva, aplicaIva: true, total: Math.round((neto + iva) * 100) / 100 };
      }
      return resumen;
    },
    dinero
  );
}

test('el contrato fiscal distribuye descuento e IVA y conserva el total al centavo', () => {
  const preparar = cargarPreparador();
  const venta = {
    id: 'V-PRUEBA',
    items: [
      { cod: 'A', qty: 1, punit: 100 },
      { cod: 'B', qty: 2, punit: 50 }
    ],
    _resumen: { subtotalBruto: 200, descuento: 10, descuentoGeneralPct: 5, subtotalNeto: 190, iva: 39.9, total: 229.9 }
  };
  const resultado = preparar(venta, 'FACTURA A');
  const totalLineas = resultado.venta.items.reduce((s, item) => s + item.qty * item.punit, 0);
  assert.equal(resultado.totalEsperado, 229.9);
  assert.equal(Math.round(totalLineas * 100) / 100, 229.9);
  assert.equal(resultado.venta.total, 229.9);
  assert.equal(resultado.venta.importe_total, 229.9);
  assert.equal(resultado.venta.descuentoGeneral, 0);
  assert.ok(resultado.venta.items.every((item) => item.disc === 0));
  const neto = resultado.venta.items.reduce((s, item) => s + item.qty * item.precioUnitarioSinIvaFiscal, 0);
  assert.equal(Math.round(neto * 1.21 * 100) / 100, 229.9);
});

test('los centavos cierran aunque todos los renglones tengan cantidad múltiple', () => {
  const preparar = cargarPreparador();
  const resultado = preparar({
    items: [{ cod: 'MULTI', qty: 2, punit: 10 }],
    _resumen: { subtotalBruto: 20, descuento: 0, subtotalNeto: 20, iva: 0.01, total: 20.01 }
  }, 'FACTURA A');
  assert.equal(resultado.venta.items.length, 2);
  assert.deepEqual(resultado.venta.items.map((item) => item.qty), [1, 1]);
  assert.equal(Math.round(resultado.venta.items.reduce((s, item) => s + item.qty * item.punit, 0) * 100) / 100, 20.01);
});

test('reproduce exactamente el caso V-910103 sin emitir ni alterar la venta', () => {
  const preparar = cargarPreparador();
  const resultado = preparar({
    id: 'V-910103',
    conIva: false,
    items: [{ cod: 'TOTAL-PRUEBA', qty: 1, punit: 4992013.53 }],
    _resumen: { subtotalBruto: 4992013.53, descuento: 499201.35, descuentoGeneralPct: 10, subtotalNeto: 4492812.18, iva: 0, total: 4492812.18 }
  }, 'FACTURA A');
  const neto = resultado.venta.items.reduce((s, item) => s + item.qty * item.precioUnitarioSinIvaFiscal, 0);
  assert.equal(Math.round(neto * 100) / 100, 4492812.18);
  assert.equal(Math.round(neto * 1.21 * 100) / 100, 5436302.74);
  assert.equal(resultado.totalEsperado, 5436302.74);
});

test('la emisión envía únicamente la venta preparada y bloquea sumas inconsistentes', () => {
  const inicio = app.indexOf('async function emitirFactura');
  const fin = app.indexOf('// Abrir modal para elegir tipo de factura', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /prepararVentaParaFacturacion\(venta, tipoComprobante\)/);
  assert.match(bloque, /venta: preparacionFiscal\.venta/);
  assert.match(bloque, /Facturación bloqueada/);
  assert.match(app, /Math\.abs\(totalPreparado - totalEsperado\) > 0\.009/);
  assert.match(app, /precioUnitarioSinIvaFiscal/);
});

test('el servidor recalcula y bloquea cualquier diferencia antes de FacturasApp', () => {
  const servidor = read('cloud-functions/emitir-factura/index.js');
  assert.match(servidor, /function prepararDetalleFiscal\(venta\)/);
  assert.match(servidor, /Integridad fiscal: los renglones totalizan/);
  assert.match(servidor, /total: preparacionFiscal\.total/);
  assert.match(servidor, /detalle: preparacionFiscal\.detalle/);
  assert.match(servidor, /precioUnitarioSinIvaFiscal/);
});

test('las facturas históricas divergentes se informan sin alterar sus importes', () => {
  const inicio = app.indexOf('function abrirResumenFactura');
  const fin = app.indexOf('function _normalizarNumeroFiscalFactura', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /compararFacturaConVenta\(v, f\)/);
  assert.match(bloque, /El comprobante fiscal no coincide con la venta/);
  assert.match(bloque, /No modifiques la venta/);
});

test('si ARCA coincide, el comprobante conserva el desglose completo de Detalle de venta', () => {
  const inicio = app.indexOf('function imprimirVentaActual');
  const fin = app.indexOf('function cerrarModalVenta', inicio);
  const bloque = app.slice(inicio, fin);
  assert.match(bloque, /usarDesgloseVentaConfirmada/);
  assert.match(bloque, /resumenEconomicoComprobanteVenta\(v\)/);
  assert.match(bloque, /datosFiscal && datosFiscal\.detalle\.length && !usarDesgloseVentaConfirmada/);
  assert.match(bloque, /Subtotal bruto/);
  assert.match(bloque, /Neto venta/);
});
