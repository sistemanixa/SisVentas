'use strict';
const SaleEconomics=require('../js/core/sale-economics-model.v1.js');
const {test}=require('node:test'),assert=require('node:assert/strict'),{createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{digest}=require('../cotizador/labor-guard');
test('gateway uses the same coordinated guard and commits source Accounts and History together',async()=>{
 const sale=SaleEconomics.calculate({id:'FIXTURE',fecha:'2026-11-04',clienteFbKey:'c',responsableUid:'u',conIva:false,items:[{cod:'FIXTURE',qty:1,punit:100,costoUnitarioCompra:20}],subtotal:100,total:100}),backend=await createCoordinatedBackend({ventas:{s:sale}});
 const actor=await backend.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});
 const next=SaleEconomics.calculate({...sale,items:sale.items.map(item=>({...item,punit:110})),subtotal:110,total:110,observaciones:'Fixture updated'});
 await backend.gateway.write(actor,{id:'fixture-coordinated-gateway',kind:'atomic',path:'',value:{'sisventas/ventas/s':next},expectedHashes:{'sisventas/ventas/s':digest(sale)}});
 assert.equal(backend.commits.length,1);const patch=backend.commits[0];assert.deepEqual(patch['sisventas/ventas/s'],next);assert.ok(Object.keys(patch).some(key=>key.startsWith('sv_client_accounts/')));assert.ok(Object.keys(patch).some(key=>key.startsWith('sv_client_history/')));assert.equal(backend.get('sisventas/ventas/s').observaciones,'Fixture updated');
});
