const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const file=fs.readFileSync('index.html','utf8').match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/)[1],s=fs.readFileSync(file,'utf8');
test('un snapshot conserva saldos históricos y calcula métricas una sola vez',()=>{
 let metrics=0;const c={document:{getElementById:()=>null},ventaFechaOrden:v=>v.fecha,fechaVentaTimestamp:f=>new Date(f).getTime(),ventasInicioPeriodoRecienteISO:()=> '2026-07-01',_repararVentasAdicionalesOTSinNumero(){},ventaTienePagoTotal:v=>v.pagado===v.total,renderMetricasVentas:()=>metrics++};c.window=c;
 vm.runInNewContext(s.slice(s.indexOf('function procesarVentasSnapshot('),s.indexOf('function procesarVentasPendientesHistoricasSnapshot(')),c);
 c.procesarVentasSnapshot({a:{fecha:'2025-01-01',total:100,pagado:20},b:{fecha:'2026-10-01',total:100,pagado:100},c:{fecha:'2026-09-01',total:100,pagado:0,anulada:true}},{filtrarPeriodo:false,actualizarPendientes:true});
 assert.equal(c.ventasList.length,3);assert.equal(c.ventasPendientesHistoricasList.length,1);assert.equal(c.ventasPendientesHistoricasList[0].fbKey,'a');assert.equal(metrics,1);
});
