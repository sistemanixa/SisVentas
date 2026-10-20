'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCommissionEvent}=require('../cotizador/commission-event');
const {createLaborDb}=require('../cotizador/labor-db');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
function fixture(){
 const backend=createBackend({ventas:{sale:{comisionHabilitada:true}}}),raw=memoryDB(backend.state),rawDb={ref:(path='')=>({...raw.ref(path),key:path.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+path})};
 const db=createLaborDb({db:rawDb,guard:backend.guard}),logs=[];let attempts=0,beforeLedger,beforeReserve;
 const identity={email:'worker@example.invalid',email_verified:true,iss:'https://accounts.google.com',aud:'https://fixture.invalid'};
 const event=createCommissionEvent({db,commissions:{systemGenerate:async()=>{attempts++;await db.ref('sisventas/gastos/partial').set({monto:999,descripcion:'Partial fictitious expense'});throw Error('Private generation failure must not be logged');}},verifyToken:async()=>identity,audience:identity.aud,caller:identity.email,instance:'demo',enabled:true,logger:entry=>logs.push(entry),coordinate:async(input,work)=>{if(input.phase==='reserve')await beforeReserve?.(input);if(input.phase==='failure-ledger')await beforeLedger?.(input);return backend.guard.run({uid:'sv-labor-service',mode:'server',operation:'commission-event',input},work);}});
 const request={method:'POST',headers:{authorization:'Bearer FICTICIO','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':'demo','ce-id':'event-1','ce-source':'//firebasedatabase.googleapis.com/projects/demo/locations/us-central1/instances/demo','ce-ref':'sisventas/ventas/sale'}};
 return {...backend,event,request,logs,get attempts(){return attempts;},set beforeLedger(fn){beforeLedger=fn;},set beforeReserve(fn){beforeReserve=fn;}};
}

test('un rechazo interno durante la reserva del evento autenticado es recuperable y no revela datos privados',async()=>{
 const f=fixture();f.beforeReserve=()=>{throw Object.assign(Error('Synthetic private store denial'),{statusCode:403});};
 await assert.rejects(f.event.handle(f.request),error=>error.statusCode===503&&!error.message.includes('private'));
 assert.equal(f.attempts,0);assert.equal(f.commits.length,0);assert.equal(f.get('sv_commission_events'),null);
});
test('the complete coordinator keeps five failures durable while discarding every partial business stage',async()=>{
 const f=fixture(),before=structuredClone(f.state.sisventas);
 for(let i=0;i<5;i++){
  await assert.rejects(f.event.handle(f.request),{statusCode:503});const ledger=Object.values(f.state.sv_commission_events)[0];assert.equal(ledger.attempts,i+1);assert.equal(ledger.state,'error');assert.deepEqual(f.state.sisventas,before);
 }
 assert.deepEqual(await f.event.handle(f.request),{status:'ignored',reason:'exhausted'});assert.equal(f.attempts,5);assert.equal(Object.values(f.state.sv_commission_events)[0].state,'review');
 assert.ok(f.commits.every(patch=>Object.keys(patch).every(path=>!path.startsWith('sisventas/'))));assert.equal(f.state.sv_labor_guard,undefined);assert.doesNotMatch(JSON.stringify(f.logs),/Private generation failure/);
});
test('six concurrent deliveries share one durable reservation and cannot spend six generation attempts',async()=>{
 const f=fixture(),results=await Promise.allSettled(Array.from({length:6},()=>f.event.handle(f.request)));
 assert.ok(results.every(result=>result.status==='rejected'&&result.reason.statusCode===503));assert.equal(f.attempts,1);assert.equal(Object.values(f.state.sv_commission_events)[0].attempts,1);
 for(let i=0;i<4;i++)await assert.rejects(f.event.handle(f.request),{statusCode:503});
 assert.equal((await f.event.handle(f.request)).reason,'exhausted');assert.equal(f.attempts,5);assert.equal(f.get('sisventas/gastos/partial'),null);
});
for(const state of ['completed','review','processing'])test('a failure ledger cannot replace a newer '+state+' reservation',async()=>{
 const f=fixture();let expected;
 f.beforeLedger=()=>{
  expected={state,token:'newer-attempt-token',attempts:3,leaseUntil:Date.now()+60000};
  const crypto=require('node:crypto'),headers=f.request.headers,key=crypto.createHash('sha256').update(JSON.stringify([headers['ce-source'],headers['ce-id'],'ventas','sale'])).digest('hex');
  apply(f.state,{['sv_commission_events/'+key]:expected});
 };
 await assert.rejects(f.event.handle(f.request),{statusCode:503});assert.deepEqual(Object.values(f.state.sv_commission_events)[0],expected);assert.equal(f.get('sisventas/gastos/partial'),null);
});
test('a failed ledger leaves its durable reservation and reports no private payload or financial commit',async()=>{
 const f=fixture();f.beforeLedger=()=>{throw Error('Synthetic unavailable ledger');};
 await assert.rejects(f.event.handle(f.request),{statusCode:503});assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/gastos/partial'),null);assert.equal(Object.values(f.get('sv_commission_events'))[0].attempts,1);assert.equal(Object.values(f.get('sv_commission_events'))[0].state,'processing');assert.equal(f.logs[0].event,'commission_event_error_ledger_failed');assert.doesNotMatch(JSON.stringify(f.logs),/Synthetic unavailable|Private generation/);
});
