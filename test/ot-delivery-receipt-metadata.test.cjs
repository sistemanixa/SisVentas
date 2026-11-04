'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Model=require('../cotizador/ot-delivery-model');
for(const [name,row,catalog,wantedUnit,wantedDescription]of [
 ['row unit and desc win',{unidad:'metros',desc:'Cable original',descripcion:'Alias'}, {p:{unidad:'rollos'}},'metros','Cable original'],
 ['catalog unit and legacy descripcion',{descripcion:'Cable histórico'}, {p:{unidad:'metros'}},'metros','Cable histórico'],
 ['same default as legacy print',{descripcion:'Equipo histórico'}, {},'unidades','Equipo histórico']
])test('delivery receipt preserves '+name,()=>{
 const ot={id:'OT-FICTICIA',ventaFbKey:'s',estado:'pendiente',tecnico:'Ficticio',materiales:[{cod:'P',productoKey:'p',vendida:3,entregada:0,instalada:0,devuelta:0,custodiaActiva:false,precioVenta:12.3456,costoProveedor:7.8912,...row}]},inventory={p:{general:0,reservado:2,consumido:0,asignaciones:{s:{reservado:2}}}},input=structuredClone({ot,inventory,catalog});
 const result=Model.plan({ot,otKey:'o',items:[{index:0,qty:2}],others:{o:ot},inventory,catalog,actor:{uid:'u',name:'Ficción'},operationId:'receipt-fiction',at:1});
 assert.equal(result.receipt.items[0].unidad,wantedUnit);assert.equal(result.receipt.items[0].descripcion,wantedDescription);assert.equal(result.receipt.items[0].cantidad,2);
 assert.equal(result.ot.materiales[0].precioVenta,12.3456);assert.equal(result.ot.materiales[0].costoProveedor,7.8912);assert.deepEqual({ot,inventory,catalog},input);
});
