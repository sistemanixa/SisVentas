'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Protocol=require('../scripts/lib/commercial-writer-protocol-rules.cjs'),Policy=require('../cotizador/labor-fence-policy');
const fixture=()=>({rules:{'.write':false,...Policy.metadataRules(),untouched:{'.write':'auth != null'}}});
test('protocol gate is conditional until the reviewed cut and keeps original authorization',()=>{const before=fixture(),after=Protocol.prepare(before);assert.deepEqual(before,fixture());for(const [node,key]of [['sv_labor_guard','.write'],['sv_labor_indexes','.write']]){assert.ok(after.rules[node][key].startsWith('('+before.rules[node][key]+')'));assert.match(after.rules[node][key],/writerSchema.*!== 2/);assert.match(after.rules[node][key],/svLaborWriterSchema === 2/);}assert.equal(after.rules.sv_labor_config.writerSchema['.validate'],'newData.val() === 2');assert.deepEqual(after.rules.untouched,before.rules.untouched);assert.throws(()=>Protocol.prepare(after),/existente/);});
test('unknown metadata grants cannot be converted into a claimed protocol',()=>{const input=fixture();input.rules.sv_labor_guard['.write']='auth != null';assert.throws(()=>Protocol.prepare(input));});
test('sticky gate survives missing writerSchema through either installed coverage marker',()=>{assert.match(Protocol.gate,/sv_client_history\/v1\/state/);assert.match(Protocol.gate,/sv_client_accounts\/v1\/coverage\/all/);const after=Protocol.prepare(fixture());assert.match(after.rules.sv_labor_guard['.write'],/auth.token.mode === 'abort'/);assert(!after.rules.sv_labor_receipts.$op['.write'].includes("auth.token.mode === 'abort'"));});
test('store overwrites incoming reserved protocol claims instead of elevating the user',async()=>{
 const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');let token;
 const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=> 'fixture',fetchImpl:async(url)=>{token=JSON.parse(new URL(url).searchParams.get('auth_variable_override')).token;return new Response('null');}});
 await store.commit({}, {fence:'fixture-fence',opId:'fixture-operation',digest:'a'.repeat(64),actorUid:'u'}, {mode:'user',uid:'u',claims:{uid:'u',svLaborWriterSchema:999,svClientHistoryWriterVersion:1,svSaleFinancialWriterVersion:1}});
 assert.equal(token.svLaborWriterSchema,2);assert.equal(token.svClientHistoryWriterVersion,0);assert.equal(token.svSaleFinancialWriterVersion,0);
});
test('historical confirmed receipt recovers only after fresh authorization without mutation',async()=>{
 const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),{digest}=require('../cotizador/labor-guard'),{createSaleDeleteCommand}=require('../cotizador/sale-delete-command');
 const backend=await createCoordinatedBackend({});require('./helpers/sale-delete-financial-evidence.cjs').install(backend);backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;
 const body={id:'historical-receipt-fixture',ventaKey:'removed-sale',expectedHash:'a'.repeat(64)},result={ok:true,committed:true,ventaKey:body.ventaKey};
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}},['sv_labor_receipts/'+body.id]:{fence:'historical-fence',actorUid:'u',digest:digest(body),result,confirmedAt:1}});
 let authorizations=0,revoked=false;const command=createSaleDeleteCommand({guard:backend.guard,store:backend.store,enabled:true,verifyActor:async()=>{authorizations++;if(revoked)throw Error('revoked fixture');}});
 assert.deepEqual(await command.execute({uid:'u',claims:{uid:'u'}},body),result);assert(authorizations>=2);assert.equal(backend.commits.length,0);assert(!backend.reads.some(([,path])=>path.startsWith('sisventas/')));
 revoked=true;await assert.rejects(command.execute({uid:'u',claims:{uid:'u'}},body),/revoked fixture/);assert.equal(backend.commits.length,0);
});
