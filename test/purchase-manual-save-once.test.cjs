'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/modules/purchase-orders.js'),'utf8');
function fixture({inventoryError=false,pushError=false}={}){
 const start=source.indexOf('  function saveManualOrder() {'),end=source.indexOf('\n  function manualSearchText(',start);
 let release,order,pushes=0,transactions=0;const gate=new Promise(resolve=>release=resolve),button={innerHTML:'Guardar borrador',disabled:false},modal={style:{}},messages=[];
 const state={manualItems:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:0,costoUnitario:5}]};
 const context={state,JSON,Promise,Date,document:{getElementById:id=>({'oc-manual-provider':{value:'supplier',selectedIndex:0,options:[{dataset:{name:'Ficticio'}}]},'oc-manual-date':{value:'2026-11-27'},'oc-manual-save':button,'oc-manual-modal':modal})[id],querySelectorAll:()=>[]},window:{notify:message=>messages.push(message)},PATH_ORDERS:'sisventas/ordenes',nextOrderNumber:()=> 'OC-FICTICIA',today:()=> '2026-11-27',push:async(path,value)=>{assert.equal(path,'sisventas/ordenes');pushes++;order=value;await gate;if(pushError)throw Error('Fictitious unavailable');return {key:'new'};},transactionInventory:async(key,mutate)=>{transactions++;assert.equal(key,'p');if(inventoryError)throw Error('Fictitious transaction failure');const inventory={enCompra:0};mutate(inventory);assert.equal(inventory.enCompra,2);}};
 vm.runInNewContext(source.slice(start,end),context);return {context,state,button,modal,messages,release,order:()=>order,counts:()=>({pushes,transactions})};
}
test('two saves in flight share one creation and one inventory increment; queued save after ACK cannot create another order',async()=>{
 const f=fixture(),first=f.context.saveManualOrder(),second=f.context.saveManualOrder();assert.equal(first,second);assert.equal(f.button.disabled,true);await Promise.resolve();f.state.manualItems[0].cantidadOrdenada=99;f.release();await first;assert.deepEqual(f.counts(),{pushes:1,transactions:1});assert.equal(f.order().items[0].cantidadOrdenada,2);assert.equal(f.modal.style.display,'none');await f.context.saveManualOrder();assert.equal(f.counts().pushes,1);
});
test('inventory error after creation cannot cause another order to be created by pressing save again',async()=>{
 const f=fixture({inventoryError:true}),pending=f.context.saveManualOrder();f.release();await pending;await f.context.saveManualOrder();assert.deepEqual(f.counts(),{pushes:1,transactions:1});assert.equal(f.button.disabled,true);assert.match(f.messages[0],/La orden se creó/);
});
test('unconfirmed initial save reports the uncertainty instead of announcing success',async()=>{
 const f=fixture({pushError:true}),pending=f.context.saveManualOrder();f.release();await pending;assert.deepEqual(f.counts(),{pushes:1,transactions:0});assert.equal(f.modal.style.display,undefined);assert.match(f.messages[0],/No se pudo confirmar/);assert.equal(f.button.disabled,false);
});
