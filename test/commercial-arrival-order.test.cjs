'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/app-functions.cjs');
function setup(){
 let paymentCallback,renders=0,hiddenWrites=0;
 const nodes=Object.fromEntries(['cc-tbody','cc-met-deuda','cc-met-clientes','cc-met-clientes-sub'].map(k=>[k,{}]));
 const c={window:{fbDB:{},fbRef:(_,p)=>p,fbOnValue:(_,fn)=>paymentCallback=fn},document:{getElementById:id=>nodes[id]||null},ventasList:[],svPuedeLeerDominio:()=>true,svMarcarDatoInicialListo(){},renderHistorialCobranzas(){},renderTablaCuentaCorriente(){renders++;},_svEsPaginaActiva:p=>p==='cuentacorriente',ventasInicioPeriodoRecienteISO:()=>'',ventaFechaOrden:v=>v.fecha||'',fechaVentaTimestamp:()=>0,_repararVentasAdicionalesOTSinNumero(){},_aplicarFiltrosVentas(){hiddenWrites++;},renderMetricasVentas(){},fvRenderVentasFacturadas(){hiddenWrites++;},fvRenderConciliacion(){hiddenWrites++;},_svConstruirCuentaCorriente(ventas,pagos){if(!ventas.length)return {};return {demo:{total:ventas.reduce((s,v)=>s+v.total,0),cobrado:pagos.reduce((s,p)=>s+p.monto,0)}};}};
 load(c,['actualizarConciliacionComercial','fbCargarPagos','procesarVentasSnapshot']);c.fbCargarPagos();
 return {c,nodes,payments:()=>paymentCallback({val:()=>({p:{ventaFbKey:'v',venta:'V-DEMO',monto:40,fecha:'2026-10-16'}})}),sales:(total=100)=>c.procesarVentasSnapshot({v:{id:'V-DEMO',total,fecha:'2026-10-16',pagos:[]}},{filtrarPeriodo:false,normalizarFechaOrden:false}),renders:()=>renders,hiddenWrites:()=>hiddenWrites};
}
test('Cuenta corriente recibe ventas y cobros en cualquier orden sin conservar el mapa vacío',()=>{
 for(const first of ['payments','sales']){const s=setup();s[first]();s[first==='payments'?'sales':'payments']();assert.equal(s.c.window._ccMapActual.demo.total,100);assert.equal(s.c.window._ccMapActual.demo.cobrado,40);assert.equal(s.nodes['cc-met-deuda'].textContent,'$60');assert.ok(s.renders()>0);}
});
test('cambiar las ventas recalcula Cuenta corriente aunque no llegue otro evento de cobros',()=>{
 const s=setup();s.payments();s.sales();const before=JSON.stringify(s.c.window._historialPagosCompleto);s.sales(200);assert.equal(s.nodes['cc-met-deuda'].textContent,'$160');assert.equal(JSON.stringify(s.c.window._historialPagosCompleto),before);
});
test('la carga de ventas no dibuja tablas ocultas de Ventas o Facturas',()=>{
 const s=setup();s.payments();s.sales();assert.equal(s.hiddenWrites(),0);
});
