'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
const Live=require('../cotizador/sale-delete-live-financial-evidence');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
const MiB=1024*1024,roots=['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation'];
function padded(map,targetBytes,setData){setData('');const overhead=Buffer.byteLength(JSON.stringify(map));a(targetBytes>=overhead);setData('a'.repeat(targetBytes-overhead));a.equal(Buffer.byteLength(JSON.stringify(map)),targetBytes);return map;}
function expense(bytes){const map={operativo:{tipo:'Servicio operativo ficticio',monto:1200,comprobante:{data:''}}};return padded(map,bytes,value=>map.operativo.comprobante.data=value);}
function providerFixture(){const values=Object.fromEntries(roots.map(p=>[p,{}]));values['sisventas/ventas']={s:{id:'V-FICTICIA'}};const provider=Live.create({store:{exists:async()=>false}});return{values,run:()=>provider({saleKey:'s',operationId:'expense-budget-fixture',read:async p=>p==='sv_client_history_config'?null:structuredClone(values[p])})};}
test('operational expense root at 8.84MB is accepted by genuine RAM model/provider',async()=>{const f=providerFixture();f.values['sisventas/gastos']=expense(8_839_119);const result=await f.run();a.deepEqual(result.dependencies,[]);a.equal(Object.keys(result.originalSourceHashes).length,5);a.equal(result.coverageSnapshot.unresolved,0);});
test('expense root accepts exact 16MiB boundary and rejects one byte above',async()=>{const f=providerFixture();f.values['sisventas/gastos']=expense(16*MiB);a.deepEqual((await f.run()).dependencies,[]);f.values['sisventas/gastos']=expense(16*MiB+1);await a.rejects(f.run(),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});});
test('expense limit counts UTF8 bytes rather than JavaScript characters',async()=>{const f=providerFixture();f.values['sisventas/gastos']={operativo:{tipo:'Servicio operativo',comprobante:{data:'€'.repeat(Math.ceil(16*MiB/3))}}};const encoded=JSON.stringify(f.values['sisventas/gastos']);a(encoded.length<8*MiB);a(Buffer.byteLength(encoded)>16*MiB);await a.rejects(f.run(),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});});
test('sales root remains capped at 8MiB',async()=>{const f=providerFixture(),map={s:{id:'V-FICTICIA',adjunto:''}};f.values['sisventas/ventas']=padded(map,8*MiB+1,value=>map.s.adjunto=value);await a.rejects(f.run(),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});});
test('full live HTTP accepts realistic fictitious originals and replay has one effect',async t=>{
 const sales={sale:{id:'V-LAB-0001',fecha:'2026-11-26',clienteFbKey:'client',responsableUid:'u',presupuestoFbKey:'budget',subtotal:100,total:100,items:[{cod:'LAB',qty:1,punit:100,costoUnitarioCompra:20}]},other:{id:'V-LAB-0002',fecha:'2026-11-26',clienteFbKey:'client',responsableUid:'u',total:1,comprobante:{data:''}}};padded(sales,5_594_112,value=>sales.other.comprobante.data=value);
 const gastos=expense(8_839_119),ctaemp={employee:{movement:{tipo:'Servicio operativo ficticio',monto:1,comprobante:{data:''}}}};padded(ctaemp,1_258_793,value=>ctaemp.employee.movement.comprobante.data=value);
 const generation={entry:{ventaFbKey:'other',tipo:'Comisión',monto:1,comprobante:{data:''}}};padded(generation,11_824,value=>generation.entry.comprobante.data=value);
 const externalGeneration={other:{monto:1,comprobante:{data:''}}};padded(externalGeneration,7_906,value=>externalGeneration.other.comprobante.data=value);
 const f=await create({sourceRoot:path.resolve(__dirname,'..'),mode:'live-originals',input:{ventas:sales,gastos,ctaemp,comisiones_generacion:generation}});
 try{
  f.set('sv_commission_generation',externalGeneration);const body=f.body(),start=performance.now(),cpu=process.cpuUsage(),rssBefore=process.memoryUsage().rss;
  const result=await f.request(body),elapsedMs=performance.now()-start,cpuUsed=process.cpuUsage(cpu);a.equal(result.status,200,JSON.stringify(result));a.equal(f.commits.length,1);a.equal((await f.request(body)).status,200);a.equal(f.commits.length,1);a.equal(f.httpCalls.length,2);a.equal(f.httpCalls[0].body.id,f.httpCalls[1].body.id);
  for(const root of ['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])a.equal(f.get(root),null);
  a.equal(f.get('sisventas/ventas/sale'),null);a.equal(f.get('sisventas/pagos/payment'),null);a.equal(f.get('sisventas/ordenes_trabajo/ot'),null);a.equal(f.get('sisventas/presupuestos/budget/estado'),'anulado');
  a.deepEqual(f.get('sisventas/gastos'),gastos);a.deepEqual(f.get('sisventas/ctaemp'),ctaemp);a.deepEqual(f.get('sisventas/comisiones_generacion'),generation);a.deepEqual(f.get('sv_commission_generation'),externalGeneration);a.equal(f.get('sisventas/comisiones/unrelated/monto'),7);a.equal(f.get('sisventas/stock/unrelated/cantidad'),9);a.equal(f.get('sisventas/comprobantesVenta/unrelated/cae'),'FAKE-FISCAL');
  a.equal(f.commits[0].override.token.svClientHistoryWriterVersion,0);a.equal(f.commits[0].override.token.svSaleFinancialWriterVersion,0);
  t.diagnostic(JSON.stringify({node:process.version,elapsedMs:Math.round(elapsedMs),cpuUserMs:Math.round(cpuUsed.user/1000),cpuSystemMs:Math.round(cpuUsed.system/1000),rssBefore,rssAfter:process.memoryUsage().rss,maxRSSKiB:process.resourceUsage().maxRSS,rootBytes:[5_594_112,8_839_119,1_258_793,11_824,7_906],commits:f.commits.length}));
 }finally{await f.close();}
});
