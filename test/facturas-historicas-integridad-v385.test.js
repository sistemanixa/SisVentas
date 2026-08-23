const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const servidor = fs.readFileSync('cloud-functions/emitir-factura/index.js', 'utf8');

function cargarComparador() {
  const inicio = app.indexOf('function compararFacturaConVenta');
  const fin = app.indexOf('// Emitir factura desde una venta', inicio);
  assert.ok(inicio > 0 && fin > inicio, 'debe existir el comparador fiscal');
  const fuente = app.slice(inicio, fin);
  const leer = (factura) => {
    const valor = factura && (factura.importe_total ?? factura.importeTotal ?? factura.totalFiscal ?? factura.total);
    if (valor === undefined || valor === null || valor === '') return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
  };
  return Function('_leerImporteFiscalFactura', 'resumenEconomicoComprobanteVenta', fuente + '; return compararFacturaConVenta;')(
    leer,
    (venta) => ({ total:Number(venta.total) || 0 })
  );
}

test('una factura histórica sin foto fiscal no se declara diferente', () => {
  const comparar = cargarComparador();
  const resultado = comparar(
    { total:219362, conIva:false, iva:0 },
    { tipo:'FACTURA B', importe_total:165128.99, datosFiscalesRecuperadosDe:'comprobantes-emitidos' }
  );
  assert.equal(resultado.verificable, false);
  assert.equal(resultado.historica, true);
  assert.equal(resultado.coincide, true);
  assert.equal(resultado.motivo, 'sin_foto_fiscal_emision');
});

test('una factura nueva se compara contra la foto guardada al emitir', () => {
  const comparar = cargarComparador();
  const correcta = comparar(
    { total:100 },
    { importe_total:121, totalFiscalEsperado:121, totalComercialAlEmitir:100, contratoIntegridadFiscal:'v2' }
  );
  assert.equal(correcta.verificable, true);
  assert.equal(correcta.coincide, true);

  const alterada = comparar(
    { total:110 },
    { importe_total:121, totalFiscalEsperado:121, totalComercialAlEmitir:100, contratoIntegridadFiscal:'v2' }
  );
  assert.equal(alterada.coincide, false);
  assert.equal(alterada.motivo, 'venta_modificada_despues');
});

test('la interfaz informa el histórico sin recomendar una corrección fiscal', () => {
  assert.match(app, /facturaHistoricaNoComparable/);
  assert.match(app, /Comprobante histórico registrado/);
  assert.match(app, /sin declarar una diferencia automática/);
  assert.match(app, /facturaNoCoincide = !nc && comparacionImportes\.verificable/);
  assert.match(app, /comparacionFiscalVenta\.verificable && comparacionFiscalVenta\.coincide/);
});

test('las emisiones nuevas guardan ambos totales y la versión del contrato', () => {
  assert.match(app, /totalComercialAlEmitir: resumen\.total/);
  assert.match(servidor, /totalFiscalEsperado:\s+totalFiscal/);
  assert.match(servidor, /totalComercialAlEmitir:/);
  assert.match(servidor, /contratoIntegridadFiscal:\s+'v2'/);
});
