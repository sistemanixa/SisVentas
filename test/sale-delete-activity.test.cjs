'use strict';
const saleHash=value=>{const original=structuredClone(value);if(original)delete original.fbKey;return require('../cotizador/labor-guard').digest(original);};
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const {createSaleDeleteCommand}=require('../cotizador/sale-delete-command');
const Activity=require('../cotizador/sale-delete-activity');
async function fixture(){const backend=await createCoordinatedBackend({ventas:{s:{id:'V-0001',total:100,fecha:'2026-11-01',clienteFbKey:'c',responsableUid:'u'}},pagos:{p:{ventaFbKey:'s',monto:20,fecha:'2026-11-01'}},stock:{p:{cantidad:9}},comisiones:{c:{monto:7}}});apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});require('./helpers/sale-delete-financial-evidence.cjs').install(backend);backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;return {...backend,command:createSaleDeleteCommand({guard:backend.guard,store:backend.store,enabled:true,verifyActor:async()=>{}})};}
for(const domain of Activity.domains)test('authoritative '+domain+' activity outside first 250 blocks entire deletion',async()=>{
 const f=await fixture();for(let index=0;index<260;index++)apply(f.state,{['sisventas/'+domain+'/unrelated'+index]:{ventaFbKey:'other'}});apply(f.state,{['sisventas/'+domain+'/late']:{ventaId:'ARBITRARY / 0001'}});const before=structuredClone(f.get('sisventas'));
 await assert.rejects(f.command.execute({uid:'u',claims:{uid:'u'}},{id:'activity-fixture-'+domain,ventaKey:'s',expectedHash:saleHash(f.get('sisventas/ventas/s'))}),{code:'SV_SALE_DELETE_ACTIVITY'});assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas'),before);
});
test('missing activity writer closure keeps capability false and reads no sources',async()=>{const f=await fixture();delete f.store.saleDeleteActivityFenceReady;f.reads.length=0;assert.equal(f.command.capability(),false);await assert.rejects(f.command.execute({uid:'u'},{id:'activity-disabled',ventaKey:'s'}),{code:'SV_SALE_DELETE_FENCE_REQUIRED'});assert.equal(f.reads.length,0);assert.equal(f.commits.length,0);});
