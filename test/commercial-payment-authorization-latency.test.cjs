'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {setup,wait}=require('./helpers/payment-reader-latency-fixture.cjs');
const Index=require('../cotizador/payment-membership-index');
test('verified token barrier, reset/context parallelism and permissions start without waiting for profile',async()=>{
 const f=setup({rtt:8});await f.authorize();const e=f.events;
 const index=(p,phase)=>e.findIndex(x=>x.path===p&&x.phase===phase);
 a(index('token','end')<index('sv_access_resets/a','start'));
 a(index('token','end')<index('sv_chat_roles/a','start'));
 a(index('sv_chat_roles/a','start')<index('sv_access_resets/a','end'));
 a(index('sv_permisos/vendedor','start')<index('sv_usuarios','end'));
});
test('invalid/revoked token never starts database or profile reads',async()=>{const f=setup();f.control.invalid=true;await a.rejects(f.authorize());a(f.events.every(e=>e.path==='token'));});
for(const mutation of ['reset','inactive','role','permission','duplicate','profile'])test('fresh authorization rejects '+mutation,async()=>{
 const f=setup();await f.authorize();
 if(mutation==='reset')f.root.sv_access_resets={a:{required:true}};
 if(mutation==='inactive')f.root.sv_chat_roles.a.activo=false;
 if(mutation==='role')f.root.sv_chat_roles.a.rol='tecnico';
 if(mutation==='permission')f.root.sv_permisos.vendedor.indiceModulos={};
 if(mutation==='duplicate')f.root.sv_usuarios.duplicate={...f.root.sv_usuarios.a};
 if(mutation==='profile')f.root.sv_usuarios.a.rol='admin';
 await a.rejects(f.authorize());
});
test('reset failure drains ongoing verified context and does not leave background reads',async()=>{
 const f=setup({rtt:8});f.root.sv_access_resets={a:{required:true}};await a.rejects(f.authorize());const count=f.events.length;await wait(30);a.equal(f.events.length,count);
});
for(const mutation of ['reset','role','permission','owner','source','coverage','token'])test('payment final barriers reject concurrent '+mutation,async()=>{
 const f=setup();let reads=0;
 f.control.hook=(path,kind)=>{if(path==='sisventas/pagos/p'&&kind==='user'&&++reads===2){
  if(mutation==='reset')f.root.sv_access_resets={a:{required:true}};
  if(mutation==='role')f.root.sv_chat_roles.a.activo=false;
  if(mutation==='permission')f.root.sv_permisos.vendedor.indiceRevision=22;
  if(mutation==='owner')f.root.sisventas.ventas.one.responsableUid='b';
  if(mutation==='source')f.root.sisventas.pagos.p.monto=99;
  if(mutation==='coverage')f.root.sv_payment_membership={};
  if(mutation==='token')f.control.invalid=true;
 }};
 if(mutation==='coverage'){
  f.control.hook=(path,kind)=>{if(path==='sisventas/pagos/p'&&kind==='user'&&++reads===2){const keys=Index.COVERAGE_PATH.split('/');let n=f.root;for(const k of keys.slice(0,-1))n=n[k];n[keys.at(-1)].generation='changed-generation';}};
 }
 // Mutation after the captured payment value is checked is caught by final auth/
 // owner/coverage. Source itself is covered earlier by existing reader tests.
 if(mutation==='source')f.control.hook=(path,kind)=>{if(path==='sisventas/pagos/p'&&kind==='user'&&++reads===1)f.root.sisventas.pagos.p.monto=99;};
 if(mutation==='coverage')await a.rejects(f.load(),{code:'SV_COMMERCIAL_PAYMENT_HISTORY_CHANGED',message:'La cobertura o las referencias de cobros cambiaron.'});
 else await a.rejects(f.load());
 a.equal(reads,2);
});
test('real reader with real ownership and REST user override remains read-only and uncached',async()=>{
 const f=setup(),before=structuredClone(f.root);a.equal((await f.load()).paymentHistory.paidAmount,40);a.equal((await f.load()).paymentHistory.paidAmount,40);a.deepEqual(f.root,before);
 a.equal(f.events.filter(e=>e.path==='token'&&e.phase==='start').length,4);
 a(f.events.some(e=>e.path==='sisventas/pagos/p'&&e.kind==='user'));
 f.control.deny=true;await a.rejects(f.load());
});
test('same RTT payment route saves authorization rounds without removing reads or barriers',async t=>{
 const results=[];
 for(const serial of [true,false]){const f=setup({rtt:20,serial}),start=performance.now();await f.load();results.push({serial,ms:performance.now()-start,reads:f.events.filter(e=>e.phase==='start').length});}
 // Serial variant retains the old reset-before-context chain; permission
 // pipelining is active in both. This is a conservative, same-process comparison.
 a.equal(results[0].reads,results[1].reads);a(results[0].ms-results[1].ms>20,JSON.stringify(results));t.diagnostic(JSON.stringify(results));
});

test('pool defaults to six, opt-in sixteen bounds work and drains failures',async()=>{
 const {pool,createPaymentSnapshot}=require('../cotizador/payment-snapshot');
 for(const limit of [undefined,16]){let active=0,peak=0,finished=0;await pool(Array.from({length:40}),async()=>{active++;peak=Math.max(peak,active);await wait(2);active--;finished++;},limit);a.equal(peak,limit??6);a.equal(active,0);a.equal(finished,40);}
 let active=0;await a.rejects(pool(Array.from({length:40},(_,i)=>i),async i=>{active++;await wait(i===0?1:3);active--;if(i===0)throw Error('stop');},16),/stop/);a.equal(active,0);
 for(const value of [0,17,1.5,true,'16',null,NaN]){a.throws(()=>createPaymentSnapshot({store:{readAsUser(){}},readConcurrency:value}),/concurrencia/);await a.rejects(pool([],()=>{},value),/concurrencia/);}
});

test('reset becoming required while final context is in flight is denied by final user read',async()=>{
 const f=setup({rtt:3});let profiles=0;
 f.control.hook=(path,kind)=>{if(path==='sv_usuarios'&&kind==='query'&&++profiles===2)f.root.sv_access_resets={a:{required:true}};};
 await a.rejects(f.load());a.equal(profiles,2);
});
