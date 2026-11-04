const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../js/modules/purchase-orders.js'),'utf8'),start=source.indexOf('  async function deleteActiveOrder('),end=source.indexOf('\n  // Las órdenes del circuito anterior',start);
async function run(extraRow,mode){
 const order={fbKey:'LOCAL-FICTICIA',ventaFbKey:'sale-ficticia',estado:'recepcion_parcial',items:[{productoKey:'p',codigo:'P',sourceLine:0,cantidadOrdenada:2,cantidadRecibida:2,costoUnitarioPresupuestado:10}]};
 const other={fbKey:'PY-FICTICIA',ventaFbKey:'sale-ficticia',items:[{productoKey:'p',codigo:'P',sourceLine:0,cantidadOrdenada:3,cantidadRecibida:3,costoUnitarioReal:20}]};
 const sale={subtotal:200,items:[{cod:'P',pid:'p',qty:5,costoUnitarioAntesPreparacion:8,costoUnitarioPresupuestado:10,cantidadCompraReal:5,costoRealCompraAcumulado:90,costoTotalCompra:90,costoUnitarioCompra:18,proveedorCompraRealKey:'py'}]};
 if(extraRow)sale.items.push({cod:'P',pid:'p',qty:1,costoUnitarioCompra:77,costoTotalCompra:77});
 const before=structuredClone({sale,other}),calls=[];
 const context={state:{activeOrder:order,orders:[order,other]},PATH_ORDERS:'sisventas/ordenes',safeKey:value=>value,transactionInventory:async()=>{},unlinkDeletedOrder:async()=>calls.push('unlink'),remove:async()=>calls.push('delete'),document:{getElementById:()=>null},window:{svConfirm:async()=>true,notify(){},fbDB:{},fbRef:(_,path)=>path,fbRunTransaction:async(path,update)=>{assert.equal(path,'sisventas/ventas/sale-ficticia');update(sale);}}};
 if(mode==='denied')context.window.SVFinancialCommands={deleteOrder:async()=>{calls.push('command');throw Error('fixture denied');}};
 if(mode==='disabled')context.window.SVFinancialCommands={deleteOrder:async()=>{calls.push('command');return false;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);await context.deleteActiveOrder();await new Promise(setImmediate);
 assert.equal(context.state.activeOrder,order);assert.equal(context.state.orderDeletePending,false);
 return {sale,other,before,calls};
}
for(const mode of ['absent','denied','disabled'])for(const extraRow of [false,true])test('protected deletion preserves two-order costs and matching rows when command '+mode+' duplicate row '+extraRow,async()=>{
 const result=await run(extraRow,mode);assert.deepEqual(result.sale,result.before.sale);assert.deepEqual(result.other,result.before.other);assert.deepEqual(result.calls,mode==='absent'?[]:['command']);
 assert.equal(result.sale.items[0].cantidadCompraReal,5);assert.equal(result.sale.items[0].costoRealCompraAcumulado,90);assert.equal(result.sale.items[0].costoTotalCompra,90);
 if(extraRow)assert.equal(result.sale.items[1].costoTotalCompra,77);
});
