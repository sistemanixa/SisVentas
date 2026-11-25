'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {memoryDB}=require('./private-finance-fixtures.cjs'),{createCommissionEvent}=require('../../cotizador/commission-event');
const tick=()=>new Promise(setImmediate);
function commercial(){const listeners={},calls=[],c={currentUserUid:'u',currentRole:'administrativo',fbAuth:{currentUser:{uid:'u',getIdToken:async()=>'FICTICIO'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://fixture.invalid'},navigator:{onLine:true},AbortSignal,AbortController,queueMicrotask,document:{hidden:false,querySelector:()=>({id:c.page}),addEventListener:(e,fn)=>listeners[e]=fn},addEventListener:(e,fn)=>listeners[e]=fn,fetch:async url=>{calls.push(url);return {ok:true,status:200,headers:{get:()=>''},json:async()=>({ok:true,records:{one:{total:1,responsableUid:'u'}}})};},setInterval:()=>assert.fail('No reloj')};c.window=c;vm.runInNewContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),c);return {c,calls,listeners};}

function event(sale){const db=memoryDB({sisventas:{ventas:{sale},pagos:{p:{ventaFbKey:'sale'}}}}),phases=[],identity={email:'ficticio@example.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://fixture.invalid'},calls=[];const req={method:'POST',headers:{authorization:'Bearer FICTICIO','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':'demo','ce-id':'event-a','ce-source':'//firebasedatabase.googleapis.com/projects/demo/locations/us-central1/instances/demo','ce-ref':'sisventas/pagos/p/monto'}};const api=createCommissionEvent({db,commissions:{systemGenerate:async id=>{calls.push(id);return {status:'generada'};}},verifyToken:async()=>identity,audience:identity.aud,caller:identity.email,instance:'demo',enabled:true,coordinate:async(e,fn)=>{phases.push(e.phase);return fn();}});return {db,api,req,phases,calls};}

const purchase=fs.readFileSync('js/modules/purchase-orders.js','utf8');
function receipt(){
 const clone=structuredClone,paths={order:'sisventas/ordenes/o',sale:'sisventas/ventas/v',inventory:'sisventas/inventario_operativo/p'},notes=[],writes=[],transactions=[];
 // Explicit new v2 order and original ledger; no fabricated old history.
 const raw={inventoryFlowVersion:2,estado:'borrador',moneda:'ARS',ventaFbKey:'v',ventaId:'V-FICTICIA',proveedorKey:'supplier',proveedor:'Proveedor ficticio',items:[{productoKey:'p',codigo:'P',descripcion:'Material ficticio',cantidadOrdenada:1,cantidadRecibida:0,costoUnitario:40,costoUnitarioPresupuestado:40,precioPublico:100}]};
 const data={
  [paths.order]:clone(raw),
  [paths.sale]:{id:'V-FICTICIA',total:100,subtotal:100,items:[{productoKey:'p',codigo:'P',qty:1,costoUnitarioCompra:40}]},
  [paths.inventory]:{general:0,enCompra:1,reservado:0,consumido:0,codigo:'P',asignaciones:{},operaciones:{}}
 };
 let abortSale=false,abortOrder=false;
 const modal={style:{},querySelectorAll:()=>[],setAttribute(){},removeAttribute(){}},document={addEventListener(){},getElementById:id=>id==='oc-order-modal'?modal:null,querySelector:()=>null,querySelectorAll:()=>[]};
 const root={document,currentUserUid:'u',currentRole:'administrativo',fbAuth:{currentUser:{uid:'u'}},currentUser:'Ficticio',PERMISOS_ROLES:{administrativo:{indiceRevision:1}},permisoModulo:()=>true,svCapturarContextoOperacion:()=>()=>true,addEventListener(){},fbDB:{},fbRef:(_,path)=>path,
  SVPurchaseCommandAdapter:require('../../js/modules/purchase-command-adapter.v1'),SVPurchaseCommandForm:require('../../js/modules/purchase-command-form.v1'),SVPurchaseReceiptCosts:require('../../js/core/purchase-receipt-costs.v1'),
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},fetch:async()=>({ok:true,status:200,json:async()=>({ok:true,inventory:{version:1,installed:false,ready:false,generation:''}})}),
  notify:message=>notes.push(message),
  fbRunTransaction:async(path,mutate)=>{
   transactions.push(path);const snapshot=()=>({val:()=>clone(data[path]??null)});
   if(path===paths.sale&&abortSale){abortSale=false;return {committed:false,snapshot:snapshot()};}
   if(path===paths.order&&data[path]?.recepcionPendiente&&abortOrder){abortOrder=false;return {committed:false,snapshot:snapshot()};}
   const before=clone(data[path]??null),value=mutate(clone(before));
   if(value===undefined)return {committed:false,snapshot:snapshot()};
   const next=clone(value);if(!require('node:util').isDeepStrictEqual(next,before))writes.push({path,before,next:clone(next)});data[path]=next;
   return {committed:true,snapshot:snapshot()};
  },fbUpdate:async()=>assert.fail('No hay lista agregada en esta recepción')
 };
 // Execute the complete actual module. The only test hook exposes its real
 // private controller; no slicing at HTML/function substrings or fake outputs.
 const anchor='  window.SisVentasCompras = {';
 assert.equal(purchase.split(anchor).length,2,'La exposición de prueba debe ser única');
 const fullSource=purchase.replace(anchor,'  window.__auditPendingReceipt=finishReceipt;\n'+anchor);
 const c={window:root,document,console,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(fullSource,c);
 const opened=()=>({...clone(data[paths.order]),fbKey:'o'}),order=opened();c.finishReceipt=root.__auditPendingReceipt;
 return {c,data,paths,notes,writes,transactions,order,opened,movement:()=>({index:0,item:clone(order.items[0]),qty:1,costoUnitarioReal:30,proveedor:'Proveedor ficticio',proveedorKey:'supplier'}),abortSale:()=>abortSale=true,abortOrder:()=>abortOrder=true};
}

module.exports={commercial,event,receipt,tick};
