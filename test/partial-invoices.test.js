const {test}=require('node:test'),a=require('node:assert/strict');const p=require('../js/modules/partial-invoices');
const invoice=(n,total)=>({tipoCodigo:'1',punto_venta:2,numero:n,total});
test('dos parciales preservan precios y cierran exactamente el saldo',()=>{const sale={total:1918238.95,items:[{punit:100}],cliente:'Ejemplo'};const first=p.append(sale,invoice('113',959119.48));a.equal(p.coverage(first).remaining,959119.47);const last=p.append(first,invoice('114',959119.47));a.equal(p.coverage(last).remaining,0);a.equal(p.invoices(last).length,2);a.deepEqual(last.items,sale.items);a.equal(last.total,sale.total);a.equal(sale.factura,undefined);});
test('rechaza duplicados y acumulado superior al total',()=>{const s=p.append({total:100},invoice('1',50));a.throws(()=>p.append(s,invoice('1',50)),/ya está/);a.throws(()=>p.append(s,invoice('2',50.01)),/supera/);});
test('no toma como cero una factura histórica sin importe',()=>{a.throws(()=>p.append({total:100,factura:{numero:'1'}},invoice('2',50)),/completá/);});
test('consulta fiscal traduce código ARCA a nombre del proveedor',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),s=fs.readFileSync('js/app.v3.6.11.js','utf8');let body;
 const ctx={SISVENTAS_FUNCTIONS:{emitirFactura:'test',frontendKey:'test'},_esperarFacturaExterna:x=>x,_snapshotConsultaFiscal:x=>x,fetch:async(url,opt)=>{body=JSON.parse(opt.body);return {ok:true,json:async()=>({comprobante:{numero:113}})};}};
 vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('async function _consultarFacturaExternaOficial('),s.indexOf('function abrirModalFacturaExterna(')),ctx);
 await ctx._consultarFacturaExternaOficial('1',2,113);a.equal(body.tipoComprobante,'FACTURA A');a.equal(body.numero,113);
 await ctx._consultarFacturaExternaOficial('6',2,113);a.equal(body.tipoComprobante,'FACTURA B');
});
