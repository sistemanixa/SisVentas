'use strict';
// Explicit synthetic benchmark, never part of the normal test gate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),Fixture=require('./helpers/ot-performance-fixture.cjs');
const {Port,IO,queryRows}=require('./helpers/stock-reference-committed-core.cjs').load(path.resolve('tmp/audit-front-d/core1c18'));
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function prepare(mapped,catalogCount=641){return data=>{
 const ot=data.sisventas.ordenes_trabajo.ot;
 for(const [index,row]of ot.materiales.entries()){
  const product='product'+index,id=hash(['ot',String(index),product,'sale']);Object.assign(row,{productoKey:product,stockRegistro:id,stockRevision:1});
  Object.assign(data.sisventas.productos[product],{id:1000+index,unidad:'unidades'});
  const Physical=require('../cotizador/ot-physical-confirmation-model');data.sisventas.inventario_operativo[product]=Physical.confirm({actor:{uid:'u',role:'admin',allowed:true},otKey:'ot',rowKey:String(index),productKey:product,allocation:'sale',operationId:'previous-delivery',at:1792530000000,kind:'delivery',beforeDelivered:0,targetDelivered:2,beforeInstalled:0,targetInstalled:0,heldByOthers:0,revision:0,inventory:{general:10,reservado:0,consumido:0,asignaciones:{sale:{reservado:0,consumido:0}}}}).inventory;
  if(mapped){data.sisventas.stock_vinculos??={porProducto:{},porInventario:{}};const mapping={productKey:product,inventoryKey:product,receiptIdentityKey:product,revision:1};data.sisventas.stock_vinculos.porProducto[product]=mapping;data.sisventas.stock_vinculos.porInventario[product]=mapping;}
 }
 for(let index=ot.materiales.length;index<catalogCount;index++)data.sisventas.productos['catalog'+String(index).padStart(4,'0')]={id:2000+index,codigo:'XF'+index,nombre:'Fictional catalog '+index,unidad:'unidades'};
 const Index=require('../cotizador/record-list-model');data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
};}
async function sample({rowCount,label,latency,catalogCount=641}){
 const f=await Fixture.create({rowCount,latency,tracePhases:true,prepare:prepare(label==='ON-mapped',catalogCount),queryRows,createReferencePhase:IO.createReferencePhase,resolveReference:Port.createReferenceResolver({enabled:label!=='OFF'})}),start=performance.now();let error=null;try{await f.api.execute(f.identity,f.body);}catch(cause){error={code:cause.code||null,message:cause.message};}
 const deadline=performance.now()+Math.max(1000,latency*3);while(f.stats().active&&performance.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.equal(f.stats().active,0,'all pending fixture IO must drain before the next sample');const elapsedMs=Math.round(performance.now()-start),guardWindowExceeded=Number.isFinite(f.stats().leaseExpiresAt)&&Date.now()>=f.stats().leaseExpiresAt,phases={};
 assert.equal(f.commits.length,error?0:1);for(let i=0;i<rowCount;i++){const inventory=f.get('sisventas/inventario_operativo/product'+i);assert.equal(inventory.consumido,error?0:2);assert.equal(inventory.general,8);assert.equal(f.get('sisventas/ordenes_trabajo/ot').materiales[i].instalada,error?0:2);}
 for(const r of f.requests){const p=phases[r.phase]??={requests:0,start:Infinity,end:0,ranges:0};p.requests++;p.ranges+=r.query?.options?1:0;p.start=Math.min(p.start,r.started);p.end=Math.max(p.end,r.started+r.elapsedMs);}
 return{rowCount,label,latency,catalogCount,error,guardWindowExceeded,status:error?'rejected':guardWindowExceeded?'lease-window-exceeded-not-pass':'fixture-committed',elapsedMs,requests:f.requests.length,commits:f.commits.length,maxConcurrency:f.stats().maxConcurrency,phases:Object.fromEntries(Object.entries(phases).map(([name,p])=>[name,{requests:p.requests,ranges:p.ranges,observedIoSpanMs:Math.round(p.end-p.start)}])),trace:f.requests};
}
async function main(){
 const latency=Number(process.env.SV_OT_PROFILE_LATENCY??150),rows=(process.env.SV_OT_PROFILE_ROWS||'1,6,12').split(',').map(Number),samples=[],out=path.resolve(process.env.SV_OT_PROFILE_OUT||'tmp/audit-front-d/ot-reference-profile-'+latency+'.json');
 const sourceHashes=Object.fromEntries(['cotizador/ot-material-state.js','cotizador/ot-lifecycle.js','cotizador/ot-delivery-commit-protocol.js','test/helpers/ot-performance-fixture.cjs',__filename].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
 assert(latency>=0&&Number.isFinite(latency));assert(rows.every(n=>Number.isInteger(n)&&n>=1&&n<=12));fs.mkdirSync(path.dirname(out),{recursive:true});
 for(const rowCount of rows)for(const label of ['OFF','ON-unmapped','ON-mapped']){const result=await sample({rowCount,label,latency});samples.push(result);fs.writeFileSync(out,JSON.stringify({scope:'Synthetic per-request latency; 641 fictional catalog products with numeric id; no production operations; one sample per cell',core:'1c18fa7c41e2dbff8c622976783fbbba0613080b',sourceHashes,samples},null,2));console.log(JSON.stringify({...result,trace:undefined}));}
}
if(require.main===module)main().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={prepare,sample};
