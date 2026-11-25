'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),Adapters=require('../js/modules/ot-related-adapters');
function fixture(){return {otKey:'ot',saleKey:'sale',actor:{uid:'u',name:'Técnico ficticio'},at:1800000000000,ot:{fbKey:'ot',id:'OT-1',clienteFbKey:'c',estado:'en_curso',materiales:[{cod:'X',punit:3.12,instalada:1,entregada:1,stockRegistro:'original'}],audit:[{accion:'Historia original'}],ventasAdicionales:{old:{ventaFbKey:'old',total:2.123,ts:1}}},sale:{fbKey:'sale',id:'V-2',otId:'ot',otNumero:'OT-1',tipoVenta:'adicional_ot',clienteFbKey:'c',total:1.234,ts:123,items:[{cod:'X',desc:'Ficticio',qty:2.5,punit:1.1234,sub:2.8085,adicionalOT:true,origenOTKey:'ot'}]}};}
test('additional sale appends pending delivery snapshots without touching historical rows or money',()=>{
 const input=fixture(),before=structuredClone(input),plan=Adapters.additionalSale(input);
 assert.deepEqual(input,before);assert.deepEqual(plan.materiales[0],input.ot.materiales[0]);
 const row=plan.materiales[1];assert.equal(row.instalada,0);assert.equal(row.entregada,0);assert.equal(row.custodiaActiva,false);assert.equal(row.punit,1.1234);assert.equal(row.sub,2.8085);assert.equal(Object.hasOwn(row,'stockPendiente'),false);
 assert.equal(plan.entry.total,1.234);assert.equal(plan.physicalDelivery,false);assert.equal(plan.requires.ot,'corregirMateriales');
 assert.deepEqual(Object.keys(plan.related).sort(),['sisventas/ordenes_trabajo/ot/audit','sisventas/ordenes_trabajo/ot/materiales','sisventas/ordenes_trabajo/ot/ventasAdicionales/sale']);
});
test('additional sale rejects contradictory identities, replay, closed OT and malformed items',()=>{
 for(const mutate of [x=>x.sale.otId='other',x=>x.sale.clienteFbKey='other',x=>x.ot.estado='completada',x=>x.ot.ventasAdicionales.sale={},x=>x.sale.items[0].origenOTKey='other',x=>x.sale.items[0].qty=-1,x=>x.sale.items[0].punit=NaN,x=>x.saleKey='bad/path']){const x=fixture();mutate(x);assert.throws(()=>Adapters.additionalSale(x),{code:'SV_OT_RELATED_INVALID'});}
});
test('additional sale recognizes every closed state from the lifecycle contract',()=>{
 for(const estado of ['cerrada','cerrado','completada','completado','completo','finalizada','finalizado','terminada','terminado','con_observaciones']){const x=fixture();x.ot.estado=estado;assert.throws(()=>Adapters.additionalSale(x));}
});
function support(){return {claimKey:'claim',claim:{id:'R-1',clienteFbKey:'c',historial:[{texto:'Original',ts:1}]},reclamoCambios:{estado:'cerrado',resolucion:'remota',resuelto:true,cerradoEn:9,historial:[{texto:'Historia falsa',autor:'otro'}]},actor:{uid:'u',name:'Servidor'},at:1800000000000};}
test('support rebuilds server history and timestamp; no fabricated OT for remote resolution',()=>{
 const input=support(),before=structuredClone(input),result=Adapters.supportChanges(input);assert.deepEqual(input,before);assert.equal(result.structure,null);assert.equal(result.changes.cerradoEn,input.at);assert.deepEqual(result.changes.historial[0],input.claim.historial[0]);assert.deepEqual(result.changes.historial[1],{texto:'Reclamo resuelto de forma remota',autor:'Servidor',actorUid:'u',ts:input.at});
});
test('support rejects arbitrary fields, mismatched resolution, unproved links and fake flags',()=>{
 for(const mutate of [x=>x.reclamoCambios.total=1,x=>x.reclamoCambios['materiales/0']=1,x=>x.reclamoCambios.resuelto=false,x=>x.reclamoCambios.otKey='fake',x=>x.reclamoCambios.generacionOTPendiente=false,x=>x.reclamoCambios.generacionOTError='forged']){const x=support();mutate(x);assert.throws(()=>Adapters.supportChanges(x),{code:'SV_OT_RELATED_INVALID'});}
});
test('support typed OT recovery binds real identities, client and existing sale refs',()=>{
 const x=support(),f=fixture();Object.assign(x,{ot:f.ot,otKey:'ot',sale:f.sale,saleKey:'sale',reclamoCambios:{estado:'ot_activa',otKey:'ot',otId:'OT-1',otNumero:'OT-1',ventaKey:'sale',ventaFbKey:'sale',ventaId:'V-2',generacionOTPendiente:false,generacionOTError:null,vinculoRecuperadoEn:4}});
 const result=Adapters.supportChanges(x);assert.deepEqual(result.structure,{otKey:'ot',kind:'claim',changes:{reclamoFbKey:'claim',ventaFbKey:'sale'}});assert.equal(result.changes.vinculoRecuperadoEn,x.at);
 for(const mutate of [y=>y.ot.ventaFbKey='other',y=>y.claim.otKey='other',y=>y.ot.clienteFbKey='other',y=>y.sale.reclamoFbKey='other']){const y=structuredClone(x);mutate(y);assert.throws(()=>Adapters.supportChanges(y));}
});
test('same pure adapter is usable by the browser without SDK or network',()=>{
 const window={},context={window,structuredClone};vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/ot-related-adapters'),'utf8'),context);assert.equal(typeof window.SVOTRelatedAdapters.additionalSale,'function');const plan=window.SVOTRelatedAdapters.additionalSale(fixture());assert.equal(plan.materiales[1].entregada,0);
});
function existing(){const f=fixture();f.ot.ventaFbKey='sale';f.ot.ventaId='V-2';f.ot.materiales=[{cod:'X',vendida:1,qty:1,punit:3.12,sub:3.12,instalada:1,entregada:1,stockRegistro:'original',stockRevision:1}];f.originalSale=structuredClone(f.sale);f.originalSale.items=[{cod:'X',desc:'Original',qty:1,punit:3.12,sub:3.12}];f.sale.items=[{cod:'X',desc:'Original',qty:2,punit:3.12,sub:6.24}];return f;}
test('original sale increases append pending rows preserving physical receipt and price snapshots',()=>{
 const f=existing(),before=structuredClone(f),result=Adapters.existingSale(f);assert.deepEqual(f,before);assert.deepEqual(result.materiales[0],f.ot.materiales[0]);assert.equal(result.materiales[1].vendida,1);assert.equal(result.materiales[1].instalada,0);assert.equal(result.materiales[1].entregada,0);assert.equal(result.materiales[1].punit,3.12);assert.equal(result.materiales[1].destinoVenta,'original');
});
test('original sale removal of pending row retains later physical row index and receipt',()=>{
 const f=existing();f.ot.materiales.unshift({cod:'Y',vendida:1,qty:1,punit:1.234,sub:1.234,entregada:0,instalada:0});f.originalSale.items.push({cod:'Y',qty:1,punit:1.234,sub:1.234});f.sale.items=f.originalSale.items.filter(row=>row.cod!=='Y');const result=Adapters.existingSale(f);assert.equal(result.materiales[0].vendida,0);assert.equal(result.materiales[0].punit,1.234);assert.deepEqual(result.materiales[1],f.ot.materiales[1]);
});
test('original sale cannot reduce physical history; ordinary pending removal remains editable',()=>{
 const f=existing();f.sale.items=[];assert.throws(()=>Adapters.existingSale(f),/rendición.*devolución/);
 f.ot.materiales=[{cod:'X',vendida:1,qty:1,punit:3.12,sub:3.12,entregada:0,instalada:0}];assert.deepEqual(Adapters.existingSale(f).materiales,[]);
});
