'use strict';
// Independent reproductions of the original review findings. Actual lifecycle,
// guard and REST store; only the HTTP persistence/Auth/fence proof are fictitious.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,legacyReceipt}=require('./helpers/ot-material-state-fixture.cjs'),Rows=require('../cotizador/ot-material-rows-model'),Stock=require('../cotizador/ot-stock-consumption-model'),{apply}=require('./helpers/labor-ui-flow.cjs');
const otPath='sisventas/ordenes_trabajo/ot',stockPath='sisventas/inventario_operativo/a';
async function partial(){const f=await fixture({legacy:true}),ot=f.get(otPath);Object.assign(ot.items[0],{qty:3,entregada:2,custodiaActiva:true,instalada:0,devuelta:0});f.setOT(ot);return f;}
function changes(f,installed){const materials=Rows.persisted(Rows.view(f.get(otPath)));Object.assign(materials[1],{instalada:installed,stockRegistro:legacyReceipt,stockRevision:1});return{materiales:materials,custodiaIniciada:true};}
for(const installed of [3,2])test('independent original negative: delivered2 installed'+installed+' with minimal receipt rejects BEFORE PATCH',async()=>{
 const f=await partial();f.setReceipt('a',{ot:'ot',venta:'s',revision:1,instalada:installed});const before=structuredClone(f.state.sisventas);
 await assert.rejects(f.api.execute(f.identity,f.body('custody',changes(f,installed))),error=>error.statusCode===409&&error.code==='SV_OT_MATERIAL_REVIEW');
 assert.equal(f.requests.filter(r=>r.method==='PATCH').length,0);assert.equal(f.commits.length,0);assert.equal(f.proofs.length,0);assert.deepEqual(f.state.sisventas,before);assert.equal(f.get(stockPath).consumido,0);assert.equal(f.get('sv_labor_guard'),null);
});
test('independent positive: actual Stock.plan receipt and coherent ledger accept installed2 on delivered2 exactly once',async()=>{
 const f=await partial(),stockBefore=f.get(stockPath),next=Stock.plan(stockBefore,{ot:'ot',allocation:'s',before:0,target:2,revision:0,receipt:legacyReceipt,additional:true});next._svReadRevision=stockBefore._svReadRevision+1;apply(f.state,{[stockPath]:next});
 const inventory=structuredClone(f.state.sisventas.inventario_operativo),before=structuredClone(f.state.sisventas),request=f.body('custody',changes(f,2));assert.equal((await f.api.execute(f.identity,request)).committed,true);assert.equal(f.get(otPath).materiales[1].entregada,2);assert.equal(f.get(otPath).materiales[1].instalada,2);assert.equal(f.get(stockPath).consumido,2);assert.equal(f.get(stockPath).asignaciones.s.consumido,2);assert.equal(f.requests.filter(r=>r.method==='PATCH').length,1);assert.equal(f.commits.length,1);assert.deepEqual(f.state.sisventas.inventario_operativo,inventory);for(const domain of ['ventas','pagos','comisiones','gastos','ctaemp'])assert.deepEqual(f.state.sisventas[domain],before[domain]);await f.api.execute(f.identity,request);assert.equal(f.commits.length,1);assert.deepEqual(f.state.sisventas.inventario_operativo,inventory);
});
