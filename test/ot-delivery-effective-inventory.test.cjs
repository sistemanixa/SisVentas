'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Protocol=require('../cotizador/ot-delivery-commit-protocol'),Policy=require('../cotizador/ot-lifecycle-policy'),Stock=require('../cotizador/ot-stock-consumption-model');
const otPath='sisventas/ordenes_trabajo/O1',inventoryPath='sisventas/inventario_operativo/P1',receipt='a'.repeat(64),lease={actorUid:'u',opId:'operation1'};
function fixture(){
 const before={ventaFbKey:'S1',materiales:[{cod:'P',productoKey:'P1',vendida:2,entregada:2,custodiaActiva:true}]},original={general:2,reservado:2,consumido:0,asignaciones:{S1:{reservado:2,consumido:0}}};
 const inventory=Stock.plan(original,{ot:'O1',allocation:'S1',before:0,target:1,revision:0,receipt});
 const actor={uid:'u',opId:lease.opId,mode:'user',operation:'ot-lifecycle',otLifecycle:Policy.issue({uid:'u',otKey:'O1',saleKey:'S1',operationId:lease.opId,kind:'custody',role:'admin',permissionRevision:7})};
 const patch={[otPath+'/materiales/0/instalada']:1,[otPath+'/materiales/0/stockRegistro']:receipt,[otPath+'/materiales/0/stockRevision']:1,[inventoryPath]:inventory},reads=[];
 const read=async path=>{reads.push(path);return structuredClone(path===otPath?before:path===inventoryPath?original:path==='sisventas/productos/P1'?{codigo:'P'}:null);};
 return {before,original,inventory,actor,patch,reads,read,run:async(patchOverride=patch,actorOverride=actor)=>Protocol.claims({patch:patchOverride,lease,actor:actorOverride,read})};
}
test('custody verifies final receipt in the same inventory patch while keeping original inputs intact',async()=>{
 const f=fixture(),original=structuredClone(f.original),patch=structuredClone(f.patch);assert.equal((await f.run()).svOTDeliveryUnchanged,true);assert.deepEqual(f.original,original);assert.deepEqual(f.patch,patch);assert.ok(f.reads.includes(inventoryPath));assert.ok(f.reads.includes('sisventas/productos/P1'));
});
test('effective inventory also supports disjoint leaf edits',async()=>{
 const f=fixture(),patch={...f.patch};delete patch[inventoryPath];for(const [field,value]of Object.entries(f.inventory))patch[inventoryPath+'/'+field]=value;assert.equal((await f.run(patch)).svOTDeliveryUnchanged,true);
});
test('absent or malformed final stock proof cannot be replaced by OT receipt fields',async()=>{
 for(const kind of ['absent','wrong-ot','broken-balance','deleted']){const f=fixture(),patch=structuredClone(f.patch);if(kind==='absent')delete patch[inventoryPath];if(kind==='wrong-ot')patch[inventoryPath].rendicionesOT[receipt].ot='O2';if(kind==='broken-balance')patch[inventoryPath].consumido=0;if(kind==='deleted')patch[inventoryPath]=null;await assert.rejects(f.run(patch),/protocolo autorizado/);}
});
test('effective inventory cannot authorize delivery changes without a genuine capability',async()=>{
 const f=fixture(),patch={...f.patch,[otPath+'/materiales/0/entregada']:1};await assert.rejects(f.run(patch,{...f.actor,otLifecycle:{...f.actor.otLifecycle}}),/protocolo autorizado/);
});
test('inventory root, overlapping normalized paths and prototype edits fail closed',async()=>{
 for(const extra of [{[inventoryPath+'/general']:1},{[inventoryPath+'/']:{}},{'sisventas/inventario_operativo':{}},{[inventoryPath+'/__proto__/x']:1}]){const f=fixture();await assert.rejects(f.run({...f.patch,...extra}),/protocolo autorizado|Ruta inválida/);}
});
