const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm'),fs=require('fs');
const source=fs.readFileSync('js/modules/purchase-orders.js','utf8');
test('snapshots sincronizan datos y stock sin construir pantallas cerradas; abrir pinta datos actuales',()=>{
 const listeners={},subscriptions={},nodes={},writes=[];let active='',stock=0;
 function node(id){return nodes[id]||(nodes[id]={id,dataset:{},style:{},classList:{contains:()=>id==='page-'+active},querySelectorAll:()=>[],set innerHTML(v){writes.push([id,v]);this.html=v},get innerHTML(){return this.html||''}})}
 const document={addEventListener:(e,fn)=>listeners[e]=fn,getElementById:node,querySelectorAll:()=>[]};
 const window={fbDB:{},fbRef:(db,path)=>path,fbOnValue:(path,fn)=>subscriptions[path]=fn,refrescarStockOperativoCatalogo:()=>stock++,actualizarStatProductos:()=>{},permisoModulo:()=>true};
 vm.runInNewContext(source,{window,document,console,setTimeout,clearTimeout,URL,Date,Map,Set});window.SisVentasCompras.start();
 subscriptions['sisventas/ordenes']({val:()=>({a:{numero:'OC-TEST',fecha:'2026-10-10',items:[],total:200}})});
 subscriptions['sisventas/listas_materiales']({val:()=>({b:{numero:'LM-TEST',items:[]}})});
 subscriptions['sisventas/inventario_operativo']({val:()=>({p:{general:3}})});
 assert.equal(writes.length,0);assert.equal(stock,1);assert.equal(window.SisVentasCompras.state.inventory.p.general,3);
 active='ordenes';listeners['sisventas:page-changed']({detail:{page:active}});
 assert.ok(writes.some(([id,html])=>id==='oc2-orders'&&html.includes('OC-TEST')));assert.ok(writes.some(([id,html])=>id==='oc2-lists'&&html.includes('LM-TEST')));
 assert.ok(!writes.some(([id])=>id==='balance-compra-content'));
});
