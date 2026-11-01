const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'cloud-functions', 'emitir-factura', 'index.js'), 'utf8');

function cargarPreparador() {
  const inicioRedondeo = source.indexOf('function redondearDinero');
  const fin = source.indexOf('function setCors', inicioRedondeo);
  assert.ok(inicioRedondeo > 0 && fin > inicioRedondeo);
  return Function('CommercialMoney',source.slice(inicioRedondeo, fin) + '; return prepararDetalleFiscal;')(require('../js/core/commercial-money.v1.js'));
}

function cargarNormalizadoresFiscal() {
  const inicio = source.indexOf('function primerCampoFiscal');
  const fin = source.indexOf('function prepararDetalleFiscal', inicio);
  assert.ok(inicio > 0 && fin > inicio);
  return Function(source.slice(inicio, fin) + '; return { primerCampoFiscal, numeroFiscalPlano };')();
}

test('servidor acepta únicamente un contrato fiscal que reproduce el total exacto', () => {
  const preparar = cargarPreparador();
  const resultado = preparar({
    totalFiscalEsperado: 2487029,
    items: [
      { cod: 'A', desc: 'Equipo', qty: 1, punit: 2487029, precioUnitarioSinIvaFiscal: 2055395.87 }
    ]
  });
  assert.equal(resultado.neto, 2055395.87);
  assert.equal(resultado.total, 2487029);
});

test('servidor bloquea antes de emitir si los renglones difieren de la venta', () => {
  const preparar = cargarPreparador();
  assert.throws(() => preparar({
    totalFiscalEsperado: 2487029,
    items: [{ cod: 'A', qty: 1, precioUnitarioSinIvaFiscal: 1788078.88 }]
  }), /Integridad fiscal/);
});

test('nota de crédito A conserva condición Responsable Inscripto', () => {
  assert.match(source, /condicion_iva:\s*\/\\sA\$\/\.test\(String\(tipoComprobante/);
});

test('comprobantes A exigen CUIT de exactamente 11 dígitos antes de llamar a ARCA', () => {
  assert.match(source, /cuitClienteNormalizado\.length !== 11/);
  assert.match(source, /var tieneCuit = cuitClienteNormalizado\.length === 11/);
});

test('la respuesta de emisión se persiste completa sin depender de importar un CSV', () => {
  const { primerCampoFiscal, numeroFiscalPlano } = cargarNormalizadoresFiscal();
  const respuestaProveedor = {
    comprobante: {
      cae: '86338678868944',
      cae_vencimiento: '27/08/2026',
      numero: '00003-00000008',
      punto_venta: '3'
    }
  };
  const fuentes = [respuestaProveedor.comprobante, respuestaProveedor];
  assert.equal(primerCampoFiscal(fuentes, ['cae', 'CAE']), '86338678868944');
  assert.equal(numeroFiscalPlano(primerCampoFiscal(fuentes, ['numero', 'nro'])), '8');
  assert.match(source, /neto:\s+netoFiscal/);
  assert.match(source, /iva:\s+ivaFiscal/);
  assert.match(source, /importe_total:\s+totalFiscal/);
  assert.match(source, /integridadFiscalCompleta/);
  assert.match(source, /estadoIntegridadFiscal/);
});

test('servidor y preparación canónica coinciden también con cantidades fraccionarias',()=>{const F=require('../cloud-functions/emitir-factura/fiscal-contract.cjs'),W=require('../js/core/sale-writer.v1'),prepare=cargarPreparador();for(const qty of [.5,1.5,2.5,3,10.2])for(const price of [10.13,100.1,371.99])for(const disc of [0,5,12.5]){const sale=W.calculate({items:[{cod:'FICTICIO',qty,punit:price,disc}],conIva:true}),fiscal=F.prepararVentaParaFacturacion(sale,'FACTURA B'),out=prepare(fiscal.venta);assert.equal(out.total,sale.total);assert.equal(out.neto,fiscal.venta.importe_neto);}});
