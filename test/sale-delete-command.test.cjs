'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSaleDeleteCommand}=require('../cotizador/sale-delete-command');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const Matcher=require('../cotizador/payment-membership-matcher');
async function fixture(input={}){
 const payments=Object.fromEntries(Array.from({length:61},(_,index)=>['p'+index,{ventaFbKey:'s',monto:1,fecha:'2026-11-01'}]));
 const backend=await createCoordinatedBackend({ventas:{s:{id:'V-0001',total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u',items:[{costo:12}]}},pagos:payments,...input});
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});
 require('./helpers/sale-delete-financial-evidence.cjs').install(backend);backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;
 const auth={revoked:false};const command=createSaleDeleteCommand({guard:backend.guard,store:backend.store,enabled:true,verifyActor:async()=>{if(auth.revoked)throw Error('Auth revoked fixture');}});
 return {...backend,auth,command,actor:{uid:'u',claims:{uid:'u'}},get body(){return {id:'command-fixture-operation',ventaKey:'s',expectedHash:saleHash(backend.get('sisventas/ventas/s'))};}};
}
test('canonical matcher preserves every reference field and significant zeros',()=>{
 const sale={fbKey:'s',id:'V-0001',idOriginal:'OLD/07'};
 for(const field of Matcher.BUSINESS_FIELDS){assert(Matcher.belongsToSale({[field]:'OT / 0001'},sale));assert(!Matcher.belongsToSale({[field]:'1'},sale));assert(Matcher.belongsToSale({[field]:'OLD/07'},sale));}
 for(const field of Matcher.TECHNICAL_FIELDS){assert(Matcher.belongsToSale({[field]:'s'},sale));assert(!Matcher.belongsToSale({[field]:'other',venta:'V-0001'},sale));}
});
test('all 61 payments, account, listing and history retire in one coordinated commit',async()=>{
 const f=await fixture();await f.command.execute(f.actor,f.body);assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/pagos/p60'),null);assert.equal(f.get('sv_client_accounts/v1/totals/all/balanceCents'),0);assert.equal(f.get('sv_commercial_pages/v1/records/sales/s'),null);assert.equal(f.get('sv_client_history/v1/state/records'),0);
});
test('lost ACK replays receipt without another mutation, then fresh Auth revocation denies recovery',async()=>{
 const f=await fixture(),commit=f.store.commit,body=f.body;f.store.commit=async(...args)=>{await commit(...args);throw Error('lost ACK fixture');};
 await assert.rejects(f.command.execute(f.actor,body),/lost ACK/);assert.equal((await f.command.execute(f.actor,body)).committed,true);assert.equal(f.commits.length,1);f.auth.revoked=true;await assert.rejects(f.command.execute(f.actor,body),/Auth revoked/);
});
test('permission or Auth revoked at final validation leaves all commercial originals unchanged',async()=>{
 for(const mode of ['permission','auth']){const f=await fixture(),before=f.get('sisventas'),read=f.store.read;let count=0;f.store.read=async path=>{if(mode==='auth'&&path==='sisventas/ordenesTrabajo')f.auth.revoked=true;if(mode==='permission'&&path==='sv_chat_roles/u'&&++count===3)apply(f.state,{'sv_permisos/admin/acciones/ventas/eliminar':false});return read(path);};await assert.rejects(f.command.execute(f.actor,f.body));assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas'),before);}
});
test('new concurrent payment prevents partial commit',async()=>{
 const f=await fixture(),read=f.store.read;let count=0;f.store.read=async path=>{if(path==='sv_chat_roles/u'&&++count===3)apply(f.state,{'sisventas/pagos/late':{ventaFbKey:'s',monto:2}});return read(path);};await assert.rejects(f.command.execute(f.actor,f.body));assert.equal(f.commits.length,0);assert(f.get('sisventas/ventas/s'));assert(f.get('sisventas/pagos/p0'));
});
test('arbitrary numeric legacy prefixes resolve without collapsing zeros or technical precedence',async()=>{
 const f=await fixture({pagos:{legacy:{venta:'ARBITRARY / 0001',monto:1,fecha:'2026-11-01'},zero:{venta:'1',monto:1,fecha:'2026-11-01'}}});await f.command.execute(f.actor,f.body);assert.equal(f.get('sisventas/pagos/legacy'),null);assert(f.get('sisventas/pagos/zero'));
});
test('ambiguous historical relation, active invoice and indirect claim reject without writes',async()=>{
 for(const mode of ['ambiguous','invoice','claim']){const f=await fixture();if(mode==='ambiguous')apply(f.state,{'sisventas/pagos/legacy':{venta:'0001'},'sisventas/ventas/other':{id:'OTHER-0001'}});if(mode==='invoice')apply(f.state,{'sisventas/ventas/s/factura':{cae:'fixture'}});if(mode==='claim')apply(f.state,{'sisventas/ordenes_trabajo/ot':{ventaFbKey:'s',id:'OT-1'},'sisventas/reclamos/claim':{otId:'OT-1'}});await assert.rejects(f.command.execute(f.actor,f.body));assert.equal(f.commits.length,0);assert(f.get('sisventas/ventas/s'));}
});
test('inverse budget and external fiscal credit preserve costs and fiscal document',async()=>{
 const f=await fixture({presupuestos:{b:{ventaGeneradaId:'#v-0001',items:[{costo:17}],clienteFbKey:'c',responsableUid:'u'}}});
 apply(f.state,{'sisventas/ventas/s/factura':{cae:'invoice'},'sisventas/ventas/s/notaCredito':{cae:'credit',origen:'conciliacion_externa',comprobanteEmitidoFbKey:'fiscal'},'sisventas/comprobantesVenta/fiscal':{cae:'credit',ventaConciliadaFbKey:'s'},'sisventas/stock/item':{cantidad:9},'sisventas/comisiones/existing':{monto:7}});
 await f.command.execute(f.actor,f.body);assert.equal(f.get('sisventas/presupuestos/b/estado'),'anulado');assert.equal(f.get('sisventas/presupuestos/b/items/0/costo'),17);assert.equal(f.get('sisventas/comprobantesVenta/fiscal/cae'),'credit');assert.equal(f.get('sisventas/comprobantesVenta/fiscal/ventaConciliadaFbKey'),null);assert.equal(f.get('sisventas/stock/item/cantidad'),9);assert.equal(f.get('sisventas/comisiones/existing/monto'),7);
});
test('unattested fence rejects before source reads',async()=>{const f=await fixture();delete f.store.saleDeleteActivityFenceReady;f.reads.length=0;await assert.rejects(f.command.execute(f.actor,f.body),{code:'SV_SALE_DELETE_FENCE_REQUIRED'});assert.equal(f.reads.length,0);});
test('stale expected hash and contradictory stored fbKey reject before any business commit',async()=>{for(const mode of ['stale','key']){const f=await fixture(),body=f.body;if(mode==='stale')apply(f.state,{'sisventas/ventas/s/total':101});else apply(f.state,{'sisventas/ventas/s/fbKey':'other'});await assert.rejects(f.command.execute(f.actor,body),/venta cambió/);assert.equal(f.commits.length,0);assert(f.get('sisventas/pagos/p60'));}});
test('matching stored fbKey is metadata and does not change canonical hash',async()=>{const f=await fixture(),body=f.body;apply(f.state,{'sisventas/ventas/s/fbKey':'s'});await f.command.execute(f.actor,body);assert.equal(f.commits.length,1);});
