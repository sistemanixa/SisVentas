const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs');
const Model=require('../js/core/operational-read-model');
const indexed=(domain,rows)=>({_svCoverage:{ready:true,schema:1,baselineCount:Object.keys(rows).length,sourceHash:'a'.repeat(64)},...Object.fromEntries(Object.entries(rows).map(([key,row])=>[key,Model.summary(domain,row)]))});
const source=fs.readFileSync('js/modules/purchase-orders.js','utf8');
test('snapshots sincronizan datos y stock sin construir pantallas cerradas; abrir pinta datos actuales',()=>{
 const listeners={},subscriptions={},nodes={},writes=[];let active='',stock=0;
 function node(id){return nodes[id]||(nodes[id]={id,dataset:{},style:{},classList:{contains:()=>id==='page-'+active},querySelectorAll:()=>[],set innerHTML(v){writes.push([id,v]);this.html=v},get innerHTML(){return this.html||''}})}
 const document={addEventListener:(e,fn)=>listeners[e]=fn,getElementById:node,querySelectorAll:()=>[]};
 const window={SVOperationalReadModel:Model,fbDB:{},fbRef:(db,path)=>path,fbOnValue:(path,fn)=>subscriptions[path]=fn,refrescarStockOperativoCatalogo:()=>stock++,actualizarStatProductos:()=>{},permisoModulo:()=>true};
 vm.runInNewContext(source,{window,document,console,setTimeout,clearTimeout,URL,Date,Map,Set});window.SisVentasCompras.start();
 subscriptions['sisventas/compras_resumen/ordenes']({val:()=>indexed('ordenes',{a:{numero:'OC-TEST',fecha:'2026-10-10',items:[],total:200}})});
 subscriptions['sisventas/compras_resumen/listas_materiales']({val:()=>indexed('listas_materiales',{b:{numero:'LM-TEST',items:[]}})});
 subscriptions['sisventas/compras_resumen/inventario_operativo']({val:()=>indexed('inventario_operativo',{p:{general:3}})});
 assert.equal(writes.length,0);assert.equal(stock,1);assert.equal(window.SisVentasCompras.state.inventory.p.general,3);
 active='ordenes';listeners['sisventas:page-changed']({detail:{page:active}});
 assert.ok(writes.some(([id,html])=>id==='oc2-orders'&&html.includes('OC-TEST')));assert.ok(!writes.some(([id])=>id==='oc2-lists'));window.ocShowTab('lists');assert.ok(writes.some(([id,html])=>id==='oc2-lists'&&html.includes('LM-TEST')));
 assert.ok(!writes.some(([id])=>id==='balance-compra-content'));
});
