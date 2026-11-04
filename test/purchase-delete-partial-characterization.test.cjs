'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/modules/purchase-orders.js'),'utf8'),start=source.indexOf('  async function deleteActiveOrder('),end=source.indexOf('\n  // Las órdenes del circuito anterior',start),body=source.slice(start,end);
test('received order cannot change stock through the removed legacy multiwrite path, even after retry',async()=>{
 const order={fbKey:'O1',estado:'pendiente',ventaFbKey:'s',items:[{productoKey:'p',codigo:'P',cantidadOrdenada:2,cantidadRecibida:1}]},inventory={enCompra:5,reservado:1,asignaciones:{s:{reservado:1}}},messages=[];let deletes=0,unlinks=0;
 const context={state:{activeOrder:order},PATH_ORDERS:'sisventas/ordenes',safeKey:value=>value,transactionInventory:async(key,change)=>change(inventory),unlinkDeletedOrder:async()=>{unlinks++;},remove:async()=>{deletes++;},document:{getElementById:()=>null},window:{svConfirm:async()=>true,notify:message=>messages.push(message),fbDB:{},fbRef:(_,path)=>path,fbRunTransaction:async()=>{throw Error('fixture sale write denied');}}};vm.createContext(context);vm.runInContext(body,context);
 await context.deleteActiveOrder();await new Promise(setImmediate);assert.equal(inventory.enCompra,5);assert.equal(inventory.reservado,1);assert.equal(deletes,0);assert.equal(unlinks,0);assert.match(messages.at(-1),/protección/);
 await context.deleteActiveOrder();await new Promise(setImmediate);assert.equal(inventory.enCompra,5,'retry never invokes a separate inventory write');assert.equal(deletes,0);assert.equal(context.state.activeOrder,order);
});
