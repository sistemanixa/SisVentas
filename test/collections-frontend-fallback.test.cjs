'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/collections-fallback.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const [name,config]of Object.entries({missing:null,disabled:{ready:false,schema:1},absent:{ready:true,schema:1,searchReady:true,searchSchema:1},partial:{ready:true,schema:1,nativeCollectionsReady:true},falseFlag:{ready:true,schema:1,nativeCollectionsReady:false,nativeCollectionsSchema:1},wrongSchema:{ready:true,schema:1,nativeCollectionsReady:true,nativeCollectionsSchema:2}}))test('validated '+name+' capabilities permit legacy without claiming or stopping it',async()=>{const x=await fixture({config});await x.bootstrap();assert.equal(x.host.active(),false);assert.equal(x.pages.activeRoute(),false);assert.equal(x.pages.ready,true);assert.equal(x.stats.legacy,1);assert.equal(x.stats.stops,0);assert.equal(x.stats.readerCreates,0);assert.match(x.nodes.get('pagos-tbody').innerHTML,/data-legacy/);});
test('inactive disabled host events preserve legacy rows, picker and metrics',async()=>{const x=await fixture({config:null});await x.bootstrap();x.nodes.get('cob-drop').innerHTML='Legacy picker';const before=x.nodes.get('pagos-tbody').innerHTML,counter=x.nodes.get('cob-contador').textContent;for(const event of ['offline','sisventas:connection-lost'])x.emitWindow(event);x.doc.hidden=true;x.emit('visibilitychange');x.doc.hidden=false;x.emit('visibilitychange');x.emit('sisventas:role-changed');assert.equal(x.nodes.get('pagos-tbody').innerHTML,before);assert.equal(x.nodes.get('cob-contador').textContent,counter);assert.equal(x.nodes.get('cob-drop').innerHTML,'Legacy picker');assert.equal(x.stats.stops,0);assert.equal(x.stats.sourceCalls,0);});
test('config403 never grants validated fallback or calls a resume',async()=>{const x=await fixture({configError:Object.assign(Error('denied'),{code:'PERMISSION_DENIED'})});await assert.rejects(x.bootstrap(),/denied/);assert.equal(x.pages.ready,false);assert.equal(x.stats.legacy,0);assert.equal(x.host.active(),false);});
test('concurrent stale boot waiters cannot resume after logout',async()=>{const x=await fixture({config:null,holdConfig:true}),a=x.bootstrap(),b=x.bootstrap();await tick();x.root.fbAuth.currentUser=null;x.emit('sisventas:session-ended');x.release();await Promise.all([a,b]);assert.equal(x.stats.legacy,0);assert.equal(x.pages.ready,false);});
test('fully ready native mode still loads exactly fifty rows without legacy',async()=>{const x=await fixture();await x.bootstrap();assert.equal(x.host.active(),true);assert.equal(x.stats.legacy,0);assert.equal((x.nodes.get('pagos-tbody').innerHTML.match(/<tr /g)||[]).length,50);assert(x.calls.filter(c=>c.limit).every(c=>c.limit<=50));});
for(const change of ['permission','auth','database','route'])test('pending config cannot validate fallback after '+change+' changes',async()=>{
 const x=await fixture({config:null,holdConfig:true}),a=x.bootstrap(),b=x.bootstrap();await tick();
 if(change==='permission')x.setPermission(false);if(change==='auth')x.root.fbAuth.currentUser={uid:'other'};if(change==='database')x.root.fbDB={other:true};if(change==='route')x.setRoute('gastos');
 x.release();await Promise.all([a,b]);assert.equal(x.stats.legacy,0);assert.equal(x.host.active(),false);assert.equal(x.stats.readerCreates,0);
});
test('old boot finally cannot release or overwrite the newer session boot',async()=>{
 const x=await fixture({holdConfig:true}),resumes=[];
 const old=x.pages.start(()=>resumes.push('old')),oldJoin=x.pages.start(()=>resumes.push('oldJoin'));await tick();assert.equal(x.pendingConfig(),1);
 x.root.currentUserUid='new';x.root.fbAuth.currentUser={uid:'new'};x.emit('sisventas:session-ended');const fresh=x.pages.start(()=>resumes.push('new'));await tick();assert.equal(x.pendingConfig(),2);
 x.releaseOne();await Promise.all([old,oldJoin]);assert.deepEqual(resumes,[]);const join=x.pages.start(()=>resumes.push('newJoin'));await tick();assert.equal(x.calls.filter(c=>c.path==='sv_commercial_pages_config').length,2);
 x.releaseOne();await Promise.all([fresh,join]);assert.deepEqual(resumes,['new','newJoin']);assert.equal(x.pages.ready,true);assert.equal(x.host.active(),true);assert.equal(x.stats.readerCreates,1);
});
test('same-session concurrent validated disabled starts share one config but resume all callers',async()=>{
 const x=await fixture({config:null,holdConfig:true}),tasks=[x.bootstrap(),x.bootstrap(),x.bootstrap()];await tick();assert.equal(x.pendingConfig(),1);x.release();await Promise.all(tasks);assert.equal(x.stats.legacy,3);assert.equal(x.stats.readerCreates,0);assert.equal(x.stats.stops,0);assert.equal(x.pages.ready,true);
});
test('permission revocation after native ownership clears native rows without legacy fallback',async()=>{
 const x=await fixture();await x.bootstrap();x.setPermission(false);x.emit('sisventas:permissions-changed');await x.bootstrap();assert.equal(x.pages.ready,false);assert.equal(x.host.active(),false);assert.equal(x.stats.legacy,0);assert.equal(x.nodes.get('pagos-tbody').innerHTML,'');
});
test('Auth loss without a reset event cannot use cached validated disabled fallback',async()=>{
 const x=await fixture({config:null});await x.bootstrap();const before=x.stats.legacy;x.root.fbAuth.currentUser=null;await x.bootstrap();assert.equal(x.stats.legacy,before);assert.equal(x.pages.ready,false);assert.equal(x.host.active(),false);
});
test('native offline and foreground recovery remain native, not legacy',async()=>{
 const x=await fixture();await x.bootstrap();x.root.navigator.onLine=false;x.emitWindow('offline');assert.equal(x.host.active(),true);assert.equal(x.nodes.get('pagos-tbody').innerHTML,'');assert.match(x.nodes.get('cob-contador').textContent,/Sin conexión/);assert.equal(x.stats.legacy,0);
 x.root.navigator.onLine=true;x.emitWindow('online');await tick();assert.equal((x.nodes.get('pagos-tbody').innerHTML.match(/<tr /g)||[]).length,50);assert.equal(x.stats.legacy,0);
 x.doc.hidden=true;x.emit('visibilitychange');x.doc.hidden=false;x.emit('visibilitychange');await tick();assert.equal((x.nodes.get('pagos-tbody').innerHTML.match(/<tr /g)||[]).length,50);assert.equal(x.stats.legacy,0);
});
test('bootstrap response received while hidden is retired and visible bootstrap can validate legacy',async()=>{
 const x=await fixture({config:null,holdConfig:true}),old=x.bootstrap();await tick();x.doc.hidden=true;x.emit('visibilitychange');x.release();await old;assert.equal(x.stats.legacy,0);assert.equal(x.pages.ready,false);
 x.root.fbCargarVentas=()=>x.stats.legacy++;x.root.fbCargarPagos=()=>x.stats.legacy++;x.doc.hidden=false;x.emit('visibilitychange');await tick();assert.equal(x.pages.ready,true);assert.equal(x.host.active(),false);assert.equal(x.stats.legacy,2);assert.equal(x.stats.stops,0);
});
test('native capability does not fall back if indexed coverage fails after successful bootstrap',async()=>{
 const x=await fixture();x.data.sv_commercial_pages.v1.coverage.ready=false;await x.bootstrap();assert.equal(x.host.active(),true);assert.equal(x.stats.legacy,0);assert.equal(x.nodes.get('pagos-tbody').innerHTML,'');assert.match(x.nodes.get('cob-contador').textContent,/cobertura/);
});
test('config denial from page bootstrap stays unready and never resumes legacy',async()=>{
 const x=await fixture({config:null,configError:Object.assign(Error('denied'),{status:403})});x.root.fbCargarVentas=()=>x.stats.legacy++;x.root.fbCargarPagos=()=>x.stats.legacy++;x.emit('sisventas:page-changed');await tick();assert.equal(x.pages.ready,false);assert.equal(x.stats.legacy,0);assert.equal(x.host.active(),false);assert.match(x.nodes.get('cob-contador').textContent,/verificar/);
});
