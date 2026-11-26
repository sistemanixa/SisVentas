'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {setup,wait}=require('./helpers/payment-reader-latency-fixture.cjs');
const {create}=require('../cotizador/commercial-sale-payments');
const Index=require('../cotizador/payment-membership-index');
const changed={code:'SV_COMMERCIAL_PAYMENT_HISTORY_CHANGED',message:'La cobertura o las referencias de cobros cambiaron.'};
test('authorized metadata starts beside coverage, reuses memo and retains exact two-read paths',async()=>{
 const f=setup({rtt:3,rich:true});await f.load();
 const paths=Index.queryPaths({...f.root.sisventas.ventas.one,fbKey:'one'});
 const coverageEnd=f.events.findIndex(e=>e.path===Index.COVERAGE_PATH&&e.phase==='end');
 for(const path of paths){a(f.events.findIndex(e=>e.path===path&&e.phase==='start')<coverageEnd);a.equal(f.events.filter(e=>e.path===path&&e.phase==='start').length,2);}
 a.equal(f.events.filter(e=>e.path===Index.COVERAGE_PATH&&e.phase==='start').length,2);
 a.equal(f.events.filter(e=>e.path==='sisventas/pagos/p'&&e.phase==='start').length,2);
});
for(const target of ['bucket','coverage'])test('mutation during initial metadata prefetch rejects '+target+' specifically',async()=>{
 const f=setup({rtt:2});const bucket=Index.queryPaths({...f.root.sisventas.ventas.one,fbKey:'one'}).find(path=>path.split('/').reduce((node,key)=>node?.[key],f.root));let mutated=false;
 f.control.hook=(path,kind)=>{if(mutated||kind!=='service'||path!==(target==='bucket'?bucket:Index.COVERAGE_PATH))return;mutated=true;
  const keys=(target==='bucket'?bucket:Index.COVERAGE_PATH).split('/');let node=f.root;for(const k of keys.slice(0,-1))node=node[k];
  if(target==='bucket')node[keys.at(-1)]=null;else node[keys.at(-1)].generation='changed-generation';
 };
 await a.rejects(f.load(),changed);a.equal(mutated,true);
});
test('invalid coverage still rejects before any authorized payment read',async()=>{
 const f=setup();const keys=Index.COVERAGE_PATH.split('/');let node=f.root;for(const k of keys.slice(0,-1))node=node[k];node[keys.at(-1)].ready=false;
 await a.rejects(f.load(),{code:'SV_PAYMENT_INDEX_INVALID',message:'La cobertura del índice de pagos no está preparada o no es válida'});
 a.equal(f.events.filter(e=>e.path==='sisventas/pagos/p').length,0);
});
test('one pool bounds all initial metadata reads and drains coverage failure',async()=>{
 let active=0,peak=0,done=0;
 const f=setup({rich:true,readerFactory:options=>create({...options,readConcurrency:2,store:{...options.store,read:async path=>{
  active++;peak=Math.max(peak,active);try{await wait(path===Index.COVERAGE_PATH?1:8);if(path===Index.COVERAGE_PATH)throw Object.assign(Error('coverage unavailable'),{code:'FIXTURE_COVERAGE'});return await options.store.read(path);}finally{active--;done++;}
 }}})});
 await a.rejects(f.load(),{code:'FIXTURE_COVERAGE',message:'coverage unavailable'});a.equal(active,0);a.equal(peak,2);const finished=done;await wait(15);a.equal(done,finished);
});
