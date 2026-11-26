'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const Live=require('../cotizador/sale-delete-live-financial-evidence');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const MiB=1024*1024;
function fixture(attachmentBytes){
 const roots={'sisventas/ventas':{s:{id:'V-FICTICIA'},unrelated:{id:'V-OTRA',comprobante:{data:'a'.repeat(attachmentBytes)}}},'sisventas/gastos':{},'sisventas/ctaemp':{},'sisventas/comisiones_generacion':{},sv_commission_generation:{}};
 let pulledBytes=0,fullSaleRead=false,writes=0;
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=budget-fixture-only',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  if(options.method!=='GET'){writes++;throw Error('Writes forbidden');}
  const path=decodeURIComponent(new URL(url).pathname).slice(1,-5),value=Object.hasOwn(roots,path)?roots[path]:null,json=JSON.stringify(value);
  if(path!=='sisventas/ventas')return new Response(json);
  const raw=Buffer.from(json);let offset=0;
  const response=new Response(new ReadableStream({pull(controller){if(offset===raw.length){fullSaleRead=true;controller.close();return;}const end=Math.min(raw.length,offset+65536);pulledBytes+=end-offset;controller.enqueue(raw.subarray(offset,end));offset=end;}}),{headers:{'content-type':'application/json','content-length':String(raw.length)}});
  return response;
 }});
 const evidence=Live.create({store});
 return {roots,run:()=>evidence({saleKey:'s',operationId:'budget-fixture-operation',read:path=>store.read(path)}),stats:()=>({pulledBytes,fullSaleRead,writes,sourceBytes:Buffer.byteLength(JSON.stringify(roots['sisventas/ventas']))})};
}
test('characterization: tiny command hits 8MiB sales limit only after full unbounded Store JSON download',async t=>{
 const f=fixture(8*MiB),body={id:'budget-fixture-operation',ventaKey:'s',expectedHash:'a'.repeat(64)};a(Buffer.byteLength(JSON.stringify(body))<2048);
 await a.rejects(f.run(),{statusCode:413,code:'SV_SALE_DELETE_LIVE_SCOPE_SIZE'});const stats=f.stats();a(stats.sourceBytes>8*MiB);a.equal(stats.fullSaleRead,true);a.equal(stats.pulledBytes,stats.sourceBytes);a.equal(stats.writes,0);t.diagnostic(JSON.stringify({requestBytes:Buffer.byteLength(JSON.stringify(body)),sourceBytes:stats.sourceBytes,downloadedBeforeReject:stats.pulledBytes}));
});
test('attachment changes on unrelated sales still change the complete RAW source hash',async()=>{
 const f=fixture(1024),before=await f.run();f.roots['sisventas/ventas'].unrelated.comprobante.data='b'.repeat(1024);const after=await f.run();a.notEqual(before.originalSourceHashes['sisventas/ventas'],after.originalSourceHashes['sisventas/ventas']);a.deepEqual(before.dependencies,[]);a.deepEqual(after.dependencies,[]);a.deepEqual(before.sources,after.sources);a.equal(before.generation,after.generation);a.equal(f.stats().writes,0);
});
