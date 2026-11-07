'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {fixture}=require('./helpers/ot-material-coherence-fixture.cjs'),Stock=require('../js/modules/ot-stock-consumption.v1'),Model=require('../js/core/operational-read-model'),Writes=require('../js/core/operational-writes');
function setup({firstMissing=false,secondMissing=true,lostAck=false}={}){
 const ot={fbKey:'ot-fiction',id:'OT-FICTION',ventaFbKey:'sale-fiction',estado:'pendiente',tecnico:'Persona ficticia',custodiaIniciada:true,custodiaRendida:false,materiales:['A','B'].map(cod=>({cod,vendida:1,entregada:1,instalada:0,custodiaActiva:true}))},f=fixture({ot}),data={},patches=[];let ackLost=false;
 const inv=()=>({general:2,reservado:0,consumido:0,asignaciones:{}});
 if(!firstMissing)data['sisventas/inventario_operativo/p0']=inv();if(!secondMissing)data['sisventas/inventario_operativo/p1']=inv();
 Object.assign(f.w,{crypto:webcrypto,fbRef:(_,path='')=>path,prodData:{p0:{fbKey:'p0',codigo:'A'},p1:{fbKey:'p1',codigo:'B'}}});
 const sdk={ref:f.w.fbRef,get:async reference=>({val:()=>Model.clone(data[Model.path(reference)]??null)}),update:async(_,patch)=>{patches.push(Model.clone(patch));Object.assign(data,Model.clone(patch));if(lostAck&&!ackLost){ackLost=true;throw Object.assign(Error('fictional lost acknowledgement'),{code:'NETWORK_ERROR'});}},set:()=>a.fail('raw set'),push:()=>a.fail('raw push'),remove:()=>a.fail('raw remove'),runTransaction:()=>a.fail('raw transaction')};
 Writes.create(f.w,Model).install({sdk});f.w.SisVentasCompras.syncOTConsumption=(o,b,n)=>Stock.sync(f.w,o,b,n);
 return {...f,data,patches};
}
test('missing first inventory reproduces the public rendition error before any stock or OT commit',async()=>{
 const f=setup({firstMissing:true}),before=JSON.stringify(f.ot);await f.w.otCustodiaTodoInstalado();a.match(f.notes.at(-1),/No se confirmó el movimiento de stock/);a.equal(f.patches.length,0);a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,['prepare']);
});
test('characterization: missing later inventory leaves first stock receipt committed while OT remains unchanged',async()=>{
 const f=setup(),before=JSON.stringify(f.ot);await f.w.otCustodiaTodoInstalado();a.equal(f.patches.length,1);const inv=f.data['sisventas/inventario_operativo/p0'];a.equal(inv.consumido,1);a.equal(Object.keys(inv.rendicionesOT).length,1);a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,['prepare']);
 // Retrying this fictional failure does not consume the first material twice.
 await f.w.otCustodiaTodoInstalado();a.equal(f.patches.length,1);a.equal(f.data['sisventas/inventario_operativo/p0'].consumido,1);a.match(f.notes.at(-1),/No se confirmó/);
});
test('characterization: recovered stock ACK still cannot make the multi-item rendition atomic',async()=>{
 const f=setup({lostAck:true});await f.w.otCustodiaTodoInstalado();a.equal(f.patches.length,1);a.equal(f.data['sisventas/inventario_operativo/p0'].consumido,1);a.equal(f.ot.materiales[0].instalada,0);a.deepEqual(f.writes,['prepare']);
});
test('revocation at confirmation never starts stock or OT preparation',async()=>{
 const f=setup();f.w.svConfirm=async()=>{f.w.tienePermiso=()=>false;return true;};await f.w.otCustodiaTodoInstalado();a.equal(f.patches.length,0);a.deepEqual(f.writes,[]);
});
