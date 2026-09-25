const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const entry = fs.existsSync(path.join(root, 'index-preview-ot.html')) ? 'index-preview-ot.html' : 'index.html';
const html = fs.readFileSync(path.join(root, entry), 'utf8');
const appFile = html.match(/src="\.\/js\/(app\.v[\d.]+\.js)/)[1];
const source = fs.readFileSync(path.join(root, 'js', appFile), 'utf8');
const start = source.indexOf('async function guardarFacturaExterna(ventaId)');
const end = source.indexOf('\nfunction ', start);

function fixture({ duplicate = false, mismatch = false } = {}) {
  let saved, apiCalls = 0;
  const sale = { id: 'V-TEST', fbKey: 'test', total: 58080, items: [{ nombre: 'Original' }] };
  const fields = { tipo: '1', fecha: '2026-09-23', pv: '2', numero: '119', total: '58080', iva: '10080', cae: '86384383884227', 'cae-vto': '2026-10-03' };
  const elements = Object.fromEntries(Object.entries(fields).map(([k,v]) => ['factura-ext-'+k, {value:v}]));
  elements['factura-ext-archivo'] = { files: [{name:'original.pdf', type:'application/pdf', size:100}] };
  elements['factura-ext-guardar'] = {disabled:false};
  const notices = [];
  const ctx = {
    console, Date, setTimeout, clearTimeout,
    document: { getElementById: id => elements[id] || null, body:{contains:()=>true} },
    window: { fbDB:{}, fbRef:(_,p)=>p, fbUpdate:()=>{},
      fbGet:async()=>({val:()=> duplicate ? {ventaFbKey:'other'} : null}),
      fbRunTransaction:async(_,fn)=>{ saved=fn(sale); return {committed:!!saved,snapshot:{val:()=>saved}}; }, fbSet:async()=>{} },
    _svResolverVentaRegistro:()=>sale, _puedeCargarFacturaExterna:()=>true,
    getMontoRaw:el=>Number(el.value), notify:m=>notices.push(m), _estadoFacturaExterna:()=>{},
    resolverClienteDeVenta:()=>({}), obtenerCuitClienteVenta:()=> '123',
    _esperarFacturaExterna:p=>p, _leerAdjuntoFacturaExterna:async()=>({nombre:'original.pdf',data:'pdf-test'}),
    _datosFiscalesDesdeNombrePdf:()=>({tipoOriginal:1,tipo:1,puntoVenta:2,numero:mismatch?120:119}),
    _consultarFacturaExternaOficial:()=>{apiCalls++; throw Error('API no disponible');},
    fetch:()=>{apiCalls++; throw Error('API no disponible');},
    svPartialInvoices:require('../js/modules/partial-invoices'), FB_PATHS:{ventas:'ventas'},
    currentUser:'Admin', importeComprobanteVenta:String, renderDetalleVenta:()=>{}, abrirResumenFactura:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,notices,result:()=>({saved,apiCalls})};
}

test('guarda PDF y datos manuales aunque la API no esté disponible',async()=>{
  const f=fixture(); await f.ctx.guardarFacturaExterna('V-TEST');
  const {saved,apiCalls}=f.result(); assert.equal(apiCalls,0);
  assert.equal(saved.factura.total,58080); assert.equal(saved.factura.iva,10080);
  assert.equal(saved.factura.cae,'86384383884227');
  assert.equal(saved.factura.fecha,'2026-09-23');
  assert.equal(saved.factura.comprobante.data,'pdf-test');
  assert.equal(saved.factura.validacionFiscal,'manual_sin_consulta_api');
  assert.equal(saved.factura.datos_fiscales,undefined);
  assert.equal(saved.items[0].nombre,'Original');
  assert.ok(f.notices.some(m=>m.includes('vinculada a la venta')));
  assert.ok(!f.notices.some(m=>m.includes('No se pudo guardar')));
});
for (const [name,options] of [['duplicados',{duplicate:true}],['datos distintos al nombre del PDF',{mismatch:true}]]) {
  test('rechaza '+name+' sin consultar la API',async()=>{
    const f=fixture(options); await f.ctx.guardarFacturaExterna('V-TEST');
    assert.equal(f.result().saved,undefined); assert.equal(f.result().apiCalls,0);
    assert.ok(f.notices.some(m=>m.includes('No se pudo guardar')));
  });
}
