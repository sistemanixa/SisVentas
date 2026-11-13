'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture,baseline}=require('./helpers/commissions-participant-native-fixture.cjs');
test('participant flow baseline: measured historical behavior, no real writes',async t=>{
 const f=await fixture(t,{historical:true});await f.add();await f.release();const trace=await f.report();
 assert.equal(trace.creates,1,'double click must generate one request');assert.deepEqual(trace.errors,[]);
 const report={baseline,sourceHash:crypto.createHash('sha256').update(f.source).digest('hex'),delays:{sale:80,movement:80,generationMinimum:240,refresh:180},openingMs:f.openingMs,...trace,gaps:{detailReread:trace.reads.filter(r=>r.type==='sale').length>1,participantsCleared:trace.states.some(s=>s.at>trace.createAt&&s.participants===0),dedicatedStatusMissing:!trace.states.some(s=>s.status)}};
 const dir='C:/SisVentas/tmp/comisiones-participantes-20261113';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'baseline.private.json'),JSON.stringify(report,null,2));await f.page.screenshot({path:path.join(dir,'baseline-1280.private.png')});
 t.diagnostic(JSON.stringify({openingMs:report.openingMs,reads:trace.reads.length,creates:trace.creates,gaps:report.gaps}));
});

for(const width of [390,768,1280])test('participant current flow keeps its detail and reports progress at '+width,async t=>{
 const f=await fixture(t,{width});const before=await f.page.locator('#com-det-participantes').innerText();const original=await f.page.evaluate(()=>structuredClone(gastosData[0]));await f.add();
 assert.match(await f.page.locator('#com-det-estado').innerText(),/Guardando participante/i);
 assert.equal(await f.page.locator('#com-det-participantes').innerText(),before);
 await f.release();await f.page.waitForFunction(()=>document.getElementById('com-det-participantes').textContent.includes('Persona nueva'));
 const trace=await f.report();assert.equal(trace.creates,1);assert.equal(trace.refreshes,0,'no complete expenses download');assert.equal(trace.reads.filter(r=>r.type==='sale').length,1,'validated sale reused');assert.deepEqual(await f.page.evaluate(()=>gastosData.find(g=>g.fbKey==='g1')),original,'existing commission and its amounts unchanged');
 assert.equal(trace.states.some(s=>s.at>trace.createAt&&(!s.visible||s.participants===0)),false,'no closing or empty detail');assert.match(await f.page.locator('#com-det-estado').innerText(),/Participante guardado/i);assert.deepEqual(trace.errors,[]);
 assert.equal(await f.page.locator('#modal-comision-gestion .modal').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'real responsive CSS keeps controls inside the modal');
 const dir='C:/SisVentas/tmp/comisiones-participantes-20261113';fs.mkdirSync(dir,{recursive:true});await f.page.screenshot({path:path.join(dir,'current-'+width+'.private.png')});fs.writeFileSync(path.join(dir,'current-'+width+'.private.json'),JSON.stringify({sourceHash:crypto.createHash('sha256').update(f.source).digest('hex'),openingMs:f.openingMs,...trace},null,2));
});

test('participant response after role revocation cannot reopen detail',async t=>{
 const f=await fixture(t);await f.add();await f.page.evaluate(()=>{currentRole='administrativo';document.dispatchEvent(new Event('sisventas:role-changed'))});await f.release();
 assert.equal(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.equal((await f.report()).creates,1);
});

test('participant save survives hidden document data events without closing or reopening',async t=>{
 const f=await fixture(t);await f.add();await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('sisventas:data-state-changed'))});await f.release();
 await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});
 assert.notEqual(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');const trace=await f.report();assert.equal(trace.creates,1);assert.equal(trace.reads.filter(r=>r.type==='sale').length,1);
});

for(const scenario of ['conflict','ambiguous'])test('participant '+scenario+' is never automatically retried',async t=>{
 const f=await fixture(t,{scenario});await f.add();await f.release();let trace=await f.report();assert.equal(trace.creates,1);assert.notEqual(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');
 assert.equal(await f.page.locator('#com-det-participantes').getByText('Persona inicial').count(),1);
 if(scenario==='ambiguous'){await f.page.evaluate(()=>agregarParticipanteComision());await f.page.waitForTimeout(120);assert.equal((await f.report()).creates,1,'uncertain response prevents repeat');}
 else{const refresh=f.page.getByRole('button',{name:'Actualizar detalle',exact:true});await refresh.click();await f.page.waitForTimeout(180);assert.equal((await f.report()).creates,1,'refresh reads but does not generate');}
});

test('external payment blocks both distribution and participant writes until explicit refresh',async t=>{
 const f=await fixture(t);await f.page.selectOption('#com-nuevo-empleado','e2');await f.page.fill('#com-nuevo-pct','10');
 await f.page.evaluate(()=>{gastosData[0]={...gastosData[0],estado:'pagado',pagado:300};document.dispatchEvent(new Event('sisventas:data-state-changed'));renderModuloComisiones()});
 assert.equal(await f.page.locator('#com-det-guardar').isDisabled(),true);assert.equal(await f.page.locator('#com-det-agregar button').isDisabled(),true);
 await f.page.evaluate(()=>{guardarDistribucionComision();agregarParticipanteComision()});await f.page.waitForTimeout(100);const blocked=await f.report();assert.equal(blocked.creates,0);assert.equal(blocked.redistributions,0);
 await f.page.getByRole('button',{name:'Actualizar detalle',exact:true}).click();await f.page.waitForTimeout(180);assert.equal(await f.page.locator('#com-det-agregar button').isDisabled(),false);assert.equal((await f.report()).creates,0);
});

test('unavailable expense source blocks both write paths without treating cached rows as current',async t=>{
 const f=await fixture(t);await f.page.selectOption('#com-nuevo-empleado','e2');await f.page.fill('#com-nuevo-pct','10');await f.page.evaluate(()=>{_gastosDataReady=false;document.dispatchEvent(new Event('sisventas:data-state-changed'));renderModuloComisiones();guardarDistribucionComision();agregarParticipanteComision()});await f.page.waitForTimeout(100);const trace=await f.report();assert.equal(trace.creates,0);assert.equal(trace.redistributions,0);assert.equal(await f.page.locator('#com-det-guardar').isDisabled(),true);assert.equal(await f.page.locator('#com-det-agregar button').isDisabled(),true);
});

for(const change of ['auth-object','session-epoch','data-epoch'])test('same-permission '+change+' invalidation closes detail and blocks late response',async t=>{
 const f=await fixture(t);await f.add();await f.page.evaluate(change=>{if(change==='auth-object')fbAuth.currentUser={uid:currentUserUid};else if(change==='session-epoch')_svOperacionesSesionEpoch++;else _svDataEpoch++;document.dispatchEvent(new Event('sisventas:data-state-changed'))},change);await f.release();assert.equal(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.equal((await f.report()).creates,1);
});

test('adding a participant preserves unsaved existing percentage without changing its stored amount',async t=>{
 const f=await fixture(t);await f.page.locator('#com-det-participantes .comision-pct-input').fill('7');await f.add();await f.release();assert.equal(await f.page.locator('#com-det-participantes .comision-pct-input[data-gasto="g1"]').inputValue(),'7');assert.equal(await f.page.evaluate(()=>gastosData[0].pct),5);assert.equal(await f.page.evaluate(()=>gastosData[0].monto),300);
});

test('closing during a confirmed write prevents a late response from reopening detail',async t=>{
 const f=await fixture(t);await f.add();await f.page.evaluate(()=>cerrarDetalleComision());await f.release();assert.equal(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.equal((await f.report()).creates,1);
});

test('closing and reopening an uncertain participant write never permits another command',async t=>{
 const f=await fixture(t,{scenario:'ambiguous'});await f.add();await f.page.evaluate(()=>cerrarDetalleComision());await f.release();await f.page.evaluate(()=>abrirDetalleComision('sale-fixture'));await f.page.waitForTimeout(180);
 await f.page.selectOption('#com-nuevo-empleado','e2');await f.page.fill('#com-nuevo-pct','10');await f.page.evaluate(()=>agregarParticipanteComision());await f.page.waitForTimeout(100);assert.equal((await f.report()).creates,1);
});

test('saving status appears synchronously before the delayed generation response',async t=>{
 const f=await fixture(t);await f.page.selectOption('#com-nuevo-empleado','e2');await f.page.fill('#com-nuevo-pct','10');const immediate=await f.page.evaluate(()=>{const begun=performance.now();agregarParticipanteComision();return{elapsed:performance.now()-begun,status:document.getElementById('com-det-estado').textContent,creates:trace.creates}});assert.match(immediate.status,/Guardando participante/);assert.ok(immediate.elapsed<30,'synchronous activity, no wait for response');assert.equal(immediate.creates,1);await f.release();const trace=await f.report();const result={immediateMs:immediate.elapsed,status:immediate.status,savedAfterFakeMs:trace.states.find(s=>s.status==='Participante guardado.')?.at-trace.createAt,fictional:true};fs.writeFileSync('C:/SisVentas/tmp/comisiones-participantes-20261113/timing.private.json',JSON.stringify(result,null,2));t.diagnostic(JSON.stringify(result));
});
