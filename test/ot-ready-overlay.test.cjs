'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Overlay=require('../cotizador/ot-ready-overlay');
const directory=process.env.SV_OT_REVIEWED_RUNTIME;
for(const name of ['ot-lifecycle.js','ot-delivery.js'])test('ready overlay preserves all other reviewed runtime bytes '+name,{skip:!directory},()=>{
 const original=fs.readFileSync(path.join(directory,name)),patched=Overlay.apply(name,original);assert(Buffer.isBuffer(patched));assert.deepEqual(Overlay.apply(name,patched),patched);new vm.Script(patched.toString());
 const before=original.toString(),after=patched.toString();assert.notEqual(after,before);assert(after.includes('expectedOTHash:digest(ot)'));assert(after.includes('otRevision:ot._svListRevision??0'));assert.equal(after.match(/summaryDigest/g)?.length,before.match(/summaryDigest/g)?.length);
 const start=before.indexOf('async function available('),end=before.indexOf('async function executeInternal(',start),nextStart=after.indexOf('async function available('),nextEnd=after.indexOf('async function executeInternal(',nextStart);assert.equal(after.slice(0,nextStart),before.slice(0,start));assert.equal(after.slice(nextEnd),before.slice(end));
});
test('unknown availability and unrelated files fail rather than guessing',()=>{assert.throws(()=>Overlay.apply('index.js',''));assert.throws(()=>Overlay.apply('ot-lifecycle.js','async function available(){}'));});
test('reviewed runtime composition uses canonical available hash without redundant SDK OT read',{skip:!directory},async()=>{
 const base=path.dirname(directory),manifest=JSON.parse(fs.readFileSync(path.join(base,'source-manifest.private.json'))),otManifest=JSON.parse(fs.readFileSync(path.join(base,'source-ot-manifest.private.json')));
 const loader=require('./helpers/ot-reviewed-runtime-loader.cjs').create({directory,manifest,otManifest,dependencies:{}});
 assert(loader.verifiedFiles.includes('labor-guard.js'));assert(loader.verifiedFiles.includes('ot-lifecycle.js'));
 const f=await require('./helpers/ot-active-flow-fixture.cjs').create({rowCount:1,productCount:1,otherCount:0,runtimeModule:loader.load('labor-runtime.js'),lifecycleModule:loader.load('ot-lifecycle.js')});
 const result=await f.save();assert.equal(result.confirmed,true);assert.equal(f.commits.length,1);assert.equal(f.client.filter(call=>call.kind==='SDK').length,0);assert.equal(f.get('sisventas/inventario_operativo/product0').consumido,2);
 f.set('sv_operational_read_config/generation','fiction-generation');
 const delivery=loader.load('ot-delivery.js').createOTDelivery({store:{...f.runtime.store,verifyOTDeliveryFence:async()=>({schema:1,verified:true,canonicalOT:true,inventory:true,rulesDigest:'a'.repeat(64)})},guard:f.runtime.guard,enabled:true});
 const ready=await delivery.available(f.identity,{otKey:'ot'});assert.equal(ready.otKey,'ot');assert.equal(ready.otRevision,f.get('sisventas/ordenes_trabajo/ot')._svListRevision);assert.equal(ready.expectedOTHash,require('../cotizador/labor-guard').digest(f.get('sisventas/ordenes_trabajo/ot')));
});
test('captured summaryDigest validates a related original custody without losing its reserve',{skip:!directory},async()=>{
 const base=path.dirname(directory),manifest=JSON.parse(fs.readFileSync(path.join(base,'source-manifest.private.json'))),otManifest=JSON.parse(fs.readFileSync(path.join(base,'source-ot-manifest.private.json'))),dependencies={};
 const loader=require('./helpers/ot-reviewed-runtime-loader.cjs').create({directory,manifest,otManifest,dependencies}),Summary=loader.load('ot-summary-digest.js');let summaryCalls=0;const originalSummary=Summary.summaryDigest;Summary.summaryDigest=value=>{summaryCalls++;return originalSummary(value);};
 const f=await require('./helpers/ot-active-flow-fixture.cjs').create({rowCount:1,productCount:1,otherCount:1,runtimeModule:loader.load('labor-runtime.js'),lifecycleModule:loader.load('ot-lifecycle.js')});
 const other={id:'OT-OTHER-FICTION',ventaFbKey:'sale',ventaId:'V-FICTION',estado:'en_curso',custodiaIniciada:true,custodiaRendida:false,_svListRevision:1,materiales:[{cod:'PF0',productoKey:'product0',vendida:1,entregada:1,instalada:0,devuelta:0,devueltaPendiente:0,enTecnico:1,danada:0,faltante:0,custodiaActiva:true}]};
 f.set('sisventas/ordenes_trabajo/other0',other);f.set('sisventas/listados_resumen/ordenes_trabajo/other0',require('../cotizador/record-list-model').summary('ordenes_trabajo',other));
 const inventory=f.get('sisventas/inventario_operativo/product0');inventory.general--;inventory.reservado++;inventory.asignaciones.sale.reservado++;f.set('sisventas/inventario_operativo/product0',inventory);
 assert.equal((await f.save()).confirmed,true);assert(summaryCalls>0);assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/inventario_operativo/product0').consumido,2);assert.equal(f.get('sisventas/inventario_operativo/product0').reservado,1);assert.deepEqual(f.get('sisventas/ordenes_trabajo/other0'),other);
});
