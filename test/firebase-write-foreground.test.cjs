'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const core=fs.readFileSync('js/core/firebase.js','utf8');
const source=core.slice(core.indexOf('    function svTrackedDatabaseWrite('),core.indexOf('    window.fbApp         ='));
function fixture(){let held=0,released=0;const c={window:{SVForegroundSession:{holdDatabase(){held++;return()=>released++;}}}};vm.createContext(c);vm.runInContext(source,c);return {wrap:c.svTrackedDatabaseWrite,counts:()=>({held,released})};}
test('escritura conserva su Promise y libera la conexión sólo después de completar',async()=>{
 const f=fixture();let resolve;const original=new Promise(r=>resolve=r);const wrapped=f.wrap(()=>original);assert.equal(wrapped(),original);assert.deepEqual(f.counts(),{held:1,released:0});resolve();await original;await settle();assert.deepEqual(f.counts(),{held:1,released:1});
});
test('push sin datos conserva referencia y no reserva una escritura; push con datos conserva ThenableReference',async()=>{
 const f=fixture(),plain={key:'ficticio'};assert.equal(f.wrap(()=>plain,true)({}),plain);assert.deepEqual(f.counts(),{held:0,released:0});
 let resolve;const write=new Promise(r=>resolve=r),reference={key:'ficticio',then:write.then.bind(write)};assert.equal(f.wrap(()=>reference,true)({},{}),reference);assert.deepEqual(f.counts(),{held:1,released:0});resolve();await settle();assert.deepEqual(f.counts(),{held:1,released:1});
});
test('fallo síncrono o rechazo libera la reserva y mantiene el error original',async()=>{
 const f=fixture(),error=Error('Fallo ficticio');assert.throws(()=>f.wrap(()=>{throw error;})(),e=>e===error);const rejected=Promise.reject(error);assert.equal(f.wrap(()=>rejected)(),rejected);await assert.rejects(rejected,e=>e===error);await settle();assert.deepEqual(f.counts(),{held:2,released:2});
});
