'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSaleDeleteHttpAdapter,PATH}=require('../cotizador/sale-delete-http-adapter');
const {createLaborGuard}=require('../cotizador/labor-guard');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const Payments=require('../cotizador/payment-membership-index');
async function fixture(){
 const sales={s:{id:'V-0001'}},payments={p:{venta:'LEGACY / 0001',monto:1}},backend=await createCoordinatedBackend({ventas:{s:{...sales.s,total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}},pagos:{p:{...payments.p,fecha:'2026-11-01'}},ordenes_trabajo:{},presupuestos:{},reclamos:{}});
 apply(backend.state,{...Payments.buildIndex(payments,{generation:'http-fixture',ready:true}).patch,'sv_chat_roles/u':{activo:true,rol:'admin'},'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});
 let revoked=false,authCalls=0;
 const authorize=async()=>{authCalls++;if(revoked)throw Object.assign(Error('revoked fixture'),{statusCode:403});return {uid:'u',claims:{uid:'u'}};};
 require('./helpers/sale-delete-financial-evidence.cjs').install(backend);backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;backend.reads.length=0;
 const guard=backend.guard,adapter=createSaleDeleteHttpAdapter({authorize,guard,store:backend.store,enabled:true});
 return {...backend,adapter,req:{method:'POST',url:PATH},body:{id:'http-delete-operation',ventaKey:'s',expectedHash:saleHash(backend.get('sisventas/ventas/s'))},revoke:()=>{revoked=true;},authCalls:()=>authCalls};
}
test('constructing adapter and rejecting GET do not load commercial sources',async()=>{const f=await fixture();assert.equal(f.reads.length,0);await assert.rejects(f.adapter.handle({...f.req,method:'GET'},f.body),{statusCode:405});assert.equal(f.reads.length,0);assert.equal(f.authCalls(),0);});
test('POST commits through real guard and lost response replay returns same minimal acknowledgement',async()=>{const f=await fixture();const first=await f.adapter.handle(f.req,f.body),recovered=await f.adapter.handle(f.req,f.body);assert.deepEqual(first,recovered);assert.equal(first.headers['Cache-Control'],'private, no-store');assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/ventas/s'),null);assert.equal(f.get('sisventas/pagos/p'),null);assert(f.get('sv_labor_receipts/'+f.body.id));assert(f.authCalls()>=6);});
test('transport ACK lost after backend commit recovers persisted receipt without another mutation',async()=>{const f=await fixture(),commit=f.store.commit;f.store.commit=async(...args)=>{await commit(...args);throw Error('lost commit ACK');};await assert.rejects(f.adapter.handle(f.req,f.body),/lost commit ACK/);const recovered=await f.adapter.handle(f.req,f.body);assert.equal(recovered.body.committed,true);assert.equal(f.commits.length,1);});
test('ambiguous legacy refuses entire POST without business effects',async()=>{const f=await fixture();apply(f.state,{'sisventas/ventas/other':{id:'OTHER-0001'}});await assert.rejects(f.adapter.handle(f.req,f.body),{code:'SV_SALE_DELETE_RELATION_REVIEW'});assert.equal(f.commits.length,0);assert(f.get('sisventas/ventas/s'));assert(f.get('sisventas/pagos/p'));});
test('revoked identity cannot recover a receipt, and foreign request fields never reach authorization',async()=>{const f=await fixture();await f.adapter.handle(f.req,f.body);f.revoke();await assert.rejects(f.adapter.handle(f.req,f.body),{statusCode:403});assert.equal(f.commits.length,1);const clean=await fixture();await assert.rejects(clean.adapter.handle(clean.req,{...clean.body,uid:'forged'}),{statusCode:400});assert.equal(clean.authCalls(),0);});
test('concurrent commercial mutation before final validation aborts complete command',async()=>{const f=await fixture(),read=f.store.read;let reads=0;f.store.read=async path=>{if(path==='sv_chat_roles/u'&&++reads===3)apply(f.state,{'sisventas/pagos/late':{ventaFbKey:'s',monto:2}});return read(path);};await assert.rejects(f.adapter.handle(f.req,f.body));assert.equal(f.commits.length,0);assert(f.get('sisventas/ventas/s'));assert(f.get('sisventas/pagos/p'));});
test('receipt operation ID cannot be reused to delete another sale',async()=>{const f=await fixture();await f.adapter.handle(f.req,f.body);await assert.rejects(f.adapter.handle(f.req,{...f.body,ventaKey:'other'}),/otra operación/);assert.equal(f.commits.length,1);});
test('fresh admin permission denied blocks POST before deletion',async()=>{const f=await fixture();apply(f.state,{'sv_permisos/admin/acciones/ventas/eliminar':false});await assert.rejects(f.adapter.handle(f.req,f.body));assert.equal(f.commits.length,0);assert(f.get('sisventas/ventas/s'));});
