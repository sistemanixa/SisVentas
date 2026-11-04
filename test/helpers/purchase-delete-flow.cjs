'use strict';
const vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto'),{createCoordinatedBackend}=require('./coordinated-backend.cjs'),{apply}=require('./labor-ui-flow.cjs');
async function fixture({lost=false,reject=false,concurrent=false}={}){
 const order={estado:'pendiente',ventaFbKey:'s',listaMaterialesId:'L1',items:[{productoKey:'p',cantidadOrdenada:2,cantidadRecibida:0}]};
 const backend=await createCoordinatedBackend({ventas:{s:{id:'V-FIC',responsableUid:'u',clienteFbKey:'c',total:100,subtotal:100,ordenesCompraIds:['O1','O2']}},ordenes:{O1:order},listas_materiales:{L1:{ordenesIds:['O1','O2']}},inventario_operativo:{p:{enCompra:5}}});
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{ordenes:true},acciones:{ordenes:{eliminar:true}}}});backend.store.operationalFenceReady=true;
 const handler=require('../../cotizador/purchase-order-delete').createPurchaseOrderDelete({guard:backend.guard,store:backend.store,enabled:true,authorize:async()=>({uid:'u',claims:{uid:'u'}})}),notices=[],button={innerHTML:'Eliminar'},modal={style:{},querySelector:()=>button};
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},crypto:webcrypto,SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},svConfirm:async()=>true,tienePermiso:()=>true,notify:value=>notices.push(value),svCapturarContextoOperacion:()=>()=>true,fetch:async(url,init)=>{
 if(url.endsWith('/laboral/capacidades'))return {ok:true,status:200,json:async()=>({ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},orderDelete:{enabled:true,version:1}})};
 if(url.endsWith('/laboral/operacion'))return {ok:true,status:200,json:async()=>({ok:true,status:backend.commits.length?'confirmed':'rejected'})};
 if(reject)throw Object.assign(Error('Antes de commit'),{statusCode:403});if(concurrent){concurrent=false;apply(backend.state,{'sisventas/ventas/s/ordenesCompraIds':['O1','O2','O3'],'sisventas/listas_materiales/L1/ordenesIds':['O1','O2','O3']});}
 const result=await handler.handle({method:'POST',url:'/compras/ordenes/eliminar'},JSON.parse(init.body));if(lost){lost=false;throw Error('ACK perdido');}return {ok:true,status:200,json:async()=>result};
 }};
 const storage=new Map();root.sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};root.SVLaborWriteRecovery=require('../../js/core/labor-write-recovery').create(root);
 root.SVFinancialCommands=require('../../js/core/financial-commands').create(root);
 const context={window:root,state:{activeOrder:{...structuredClone(order),fbKey:'O1'}},document:{getElementById:()=>modal}};vm.createContext(context);const source=fs.readFileSync('js/modules/purchase-orders.js','utf8'),start=source.indexOf('  async function deleteActiveOrder(');vm.runInContext(source.slice(start,source.indexOf('\n  // Las órdenes del circuito anterior',start)),context);
 return {backend,context,root,notices,run:()=>context.deleteActiveOrder(),allow:()=>{reject=false;}};
}
module.exports={fixture};
