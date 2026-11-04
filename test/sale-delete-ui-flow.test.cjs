'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const Financial=require('../js/core/financial-commands'),Recovery=require('../js/core/labor-write-recovery');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const {createSaleDeleteHttpAdapter}=require('../cotizador/sale-delete-http-adapter');
const source=require('./helpers/active-app').readActiveApp().source;
const start=source.indexOf('async function eliminarVenta('),end=source.indexOf('async function anularVenta(',start);
async function fixture({enabled=true,loseAck=false,changeSession=false}={}){
 const sale={fbKey:'s',id:'V-FIXTURE',total:100,fecha:'2026-11-01',clienteFbKey:'c',cliente:'Persona ficticia',responsableUid:'u',items:[{costoUnitarioCompra:12}],factura:{cae:'fixture'},notaCredito:{cae:'credit-fixture'}};
 const backend=await createCoordinatedBackend({ventas:{s:sale},pagos:{p:{ventaFbKey:'s',monto:20,fecha:'2026-11-01'}},ordenes_trabajo:{ot:{ventaFbKey:'s',clienteFbKey:'c',responsableUid:'u',fecha:'2026-11-01'}},comprobantesVenta:{f:{cae:'credit-fixture'}},stock:{p:{cantidad:7}},comisiones:{c:{monto:9}}}),calls=[],messages=[],ui=[],storage=new Map();let lost=false;
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});
 require('./helpers/sale-delete-financial-evidence.cjs').install(backend);backend.store.saleDeleteFenceReady=true;
 backend.store.saleDeleteActivityFenceReady=true;
 const adapter=createSaleDeleteHttpAdapter({authorize:async()=>({uid:'u',claims:{uid:'u'}}),guard:backend.guard,store:backend.store,enabled});
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:crypto.webcrypto,navigator:{onLine:true},fbDB:{},fbRef:(_,path)=>path,fbGet:async path=>({val:()=>backend.get(path)}),svCapturarContextoOperacion:()=>()=>root.currentUserUid==='u',ventasList:[sale],SP_DATA:{},
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({Authorization:'Bearer fixture'})},
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},document:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},
  tienePermiso:()=>true,notify:message=>messages.push(message),svConfirm:async()=>true,ventaTieneNotaCreditoActiva:()=>true,
  _ventaMostrarProcesoPantalla:()=>({finalizar:()=>ui.push('finalized')}),volverListaVentas:()=>ui.push('returned'),
  SVCommercialOwnership:{captureWriteContext:()=>({uid:'u'}),isWriteContext:context=>root.currentUserUid===context.uid,confirmDelete:()=>ui.push('deleted')},
  fbUpdate:()=>assert.fail('legacy SDK update'),fbRemove:()=>assert.fail('legacy SDK remove'),fbSet:()=>assert.fail('legacy SDK set'),
  async fetch(url,options){
   const body=JSON.parse(options.body);calls.push({url,body});
   if(url.endsWith('/laboral/capacidades'))return Response.json({ok:true,payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1},saleDelete:{enabled,version:1}});
   if(url.endsWith('/laboral/operacion'))return Response.json({ok:true,status:backend.get('sv_labor_receipts/'+body.id)?'confirmed':'rejected'});
   assert(url.endsWith('/comerciales/ventas/eliminar'));
   const reply=await adapter.handle({method:'POST',url:'/comerciales/ventas/eliminar'},body),result=reply.body;
   if(changeSession)root.currentUserUid='other';
   if(loseAck&&!lost){lost=true;throw Error('lost transport ACK fixture');}
   return Response.json(result);
  }
 };
 root.window=root;root.SVLaborWriteRecovery=Recovery.create(root);root.SVFinancialCommands=Financial.create(root);vm.createContext(root);vm.runInContext(source.slice(start,end),root);
 return {root,backend,calls,messages,ui};
}
async function until(check){for(let attempt=0;attempt<200;attempt++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.fail('fixture did not reach recovery');}
test('real UI and transport disabled capability never mutate or locally acknowledge',async()=>{const f=await fixture({enabled:false});await f.root.eliminarVenta('s');assert.equal(f.backend.commits.length,0);assert.deepEqual(f.ui,['finalized']);assert.equal(f.calls.length,1);assert(f.backend.get('sisventas/ventas/s'));});
test('real UI cascades through adapter and coordinated projections preserving fiscal, stock and commissions',async()=>{const f=await fixture(),before={fiscal:f.backend.get('sisventas/comprobantesVenta'),stock:f.backend.get('sisventas/stock'),commissions:f.backend.get('sisventas/comisiones')};await f.root.eliminarVenta('s');assert.equal(f.backend.commits.length,1,JSON.stringify(f.messages));assert.deepEqual(f.ui,['deleted','returned','finalized']);assert.deepEqual({fiscal:f.backend.get('sisventas/comprobantesVenta'),stock:f.backend.get('sisventas/stock'),commissions:f.backend.get('sisventas/comisiones')},before);assert.equal(f.calls.filter(call=>call.url.endsWith('/comerciales/ventas/eliminar')).length,1);assert.equal(f.backend.get('sisventas/pagos/p'),null);assert.equal(f.backend.get('sisventas/ordenes_trabajo/ot'),null);const P=require('../cotizador/client-account-projection');assert.equal(f.backend.get(P.ROOT+'/totals/all/balanceCents'),0);assert.equal(f.backend.get('sv_commercial_pages/v1/records/sales/s'),null);});
test('uncertain ACK recovery reuses receipt and original command ID without another commit',async()=>{const f=await fixture({loseAck:true}),pending=f.root.eliminarVenta('s');await until(()=>f.root.SVLaborWriteRecovery.state());const attempt=f.root.SVLaborWriteRecovery.state();await f.root.SVLaborWriteRecovery.check(attempt.id);await pending;assert.equal(f.backend.commits.length,1);const sent=f.calls.filter(call=>call.url.endsWith('/comerciales/ventas/eliminar'));assert.equal(sent.length,2);assert.equal(sent[0].body.id,sent[1].body.id);assert(f.ui.includes('deleted'));});
test('session change after commit suppresses local UI acknowledgement',async()=>{const f=await fixture({changeSession:true});await f.root.eliminarVenta('s');assert.equal(f.backend.commits.length,1);assert(!f.ui.includes('deleted'));assert(!f.ui.includes('returned'));assert(f.ui.includes('finalized'));});
test('real coordinated cascade retires account members and all three history sources atomically',async()=>{
 const f=await fixture(),History=require('../cotizador/client-history-model'),Accounts=require('../cotizador/client-account-projection');
 assert.equal(f.backend.get(History.ROOT+'/state/records'),3);assert.equal(f.backend.get(Accounts.ROOT+'/totals/all/balanceCents'),8000);
 await f.root.eliminarVenta('s');assert.equal(f.backend.commits.length,1);assert.equal(f.backend.get(History.ROOT+'/state/records'),0);for(const [domain,id]of [['ventas','s'],['pagos','p'],['ordenes_trabajo','ot']])assert.equal(f.backend.get(History.ROOT+'/sources/'+domain+'/'+id),null);assert.equal(f.backend.get(Accounts.ROOT+'/sources/sales/s'),null);assert.equal(f.backend.get(Accounts.ROOT+'/sources/payments/p'),null);assert.equal(f.backend.get(Accounts.ROOT+'/totals/all/balanceCents'),0);
});

test('double click while original is loading starts one confirmation and command',async()=>{const f=await fixture(),get=f.root.fbGet;let release;const held=new Promise(resolve=>release=resolve);let calls=0,confirmations=0;f.root.fbGet=async path=>{calls++;await held;return get(path);};f.root.svConfirm=async()=>{confirmations++;return true;};const first=f.root.eliminarVenta('s'),second=f.root.eliminarVenta('s');release();await Promise.all([first,second]);assert.equal(calls,1);assert.equal(confirmations,1);assert.equal(f.backend.commits.length,1);assert.deepEqual(Object.keys(f.root._ventasEliminacionEnCurso),[]);});
test('leaving the sales route during original lookup never starts a destructive command',async()=>{const f=await fixture(),get=f.root.fbGet;f.root.location={hash:'#/detalle'};f.root.fbGet=async path=>{const value=await get(path);f.root.location.hash='#/clientes';return value;};await f.root.eliminarVenta('s');assert.equal(f.backend.commits.length,0);assert.equal(f.calls.length,0);assert.deepEqual(Object.keys(f.root._ventasEliminacionEnCurso),[]);});
