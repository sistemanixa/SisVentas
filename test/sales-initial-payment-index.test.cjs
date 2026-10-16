'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/app-functions.cjs');
function setup(payments){const c={_historialPagosCompleto:payments,ventaEsSinCargo:v=>v?.sinCargo===true,_svTotalVentaCanonico:v=>Number(v?.total)||0};c.window=c;load(c,['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta','_svPagoValido','_svPagosGlobalesRelacionadosVenta','_svPagosGlobalesVenta','_svPagosEmbebidosVenta','_svPagosCanonicosVenta','_svResumenPagoLegacyVenta','_svAgregarPagoIndice','_svCrearIndicePagosVentas','_svPagosIndiceVenta','estadoPagoEfectivoVenta','ventaTienePagoTotal']);return c;}

test('índice conserva el resultado previo con aliases, refs técnicas, anulados, embebidos y legados',()=>{
 const payments=[{ventaFbKey:'a',monto:100},{ventaFbKey:'otro',venta:'V-1',monto:999},{venta:'ANT-2',monto:50},{venta:'V-3',monto:60,anulado:true},{ventaId:'4',monto:0}];
 const sales=[{fbKey:'a',id:'V-1',total:100},{id:'V-2',idOriginal:'ANT-2',total:50},{id:'V-3',total:60,pagos:[{monto:60}]},{id:'V-4',total:0,estadoPago:'pago_total'},{id:'V-5',total:100,pagado:100},{id:'V-6',total:100,estadoPago:'pago_total'},{id:'V-7',total:1,pagos:[{monto:0.5}]},{id:'V-8',total:0,sinCargo:true},null];
 const c=setup(payments),idx=c._svCrearIndicePagosVentas(payments);for(const sale of sales)assert.equal(c.ventaTienePagoTotal(sale,c._svPagosIndiceVenta(idx,sale)),c.ventaTienePagoTotal(sale));
});

test('consulta de pendientes evita ventas por todos los pagos sin perder resultados',()=>{
 const n=180,sales=Array.from({length:n},(_,i)=>({fbKey:'key'+i,id:'V-'+i,total:100})),payments=sales.map((v,i)=>({ventaFbKey:v.fbKey,monto:i%2?100:50})),c=setup(payments);let checks=0;const relation=c._svRegistroPerteneceVenta;c._svRegistroPerteneceVenta=(p,v)=>{checks++;return relation(p,v);};
 const expected=sales.map(v=>c.ventaTienePagoTotal(v));assert.ok(checks>=n*n);checks=0;const idx=c._svCrearIndicePagosVentas(payments),actual=sales.map(v=>c.ventaTienePagoTotal(v,c._svPagosIndiceVenta(idx,v)));assert.deepEqual(actual,expected);assert.ok(checks<=n*2);
 payments[0].monto=100;const fresh=c._svCrearIndicePagosVentas(payments);assert.equal(c.ventaTienePagoTotal(sales[0],c._svPagosIndiceVenta(fresh,sales[0])),true);
});
