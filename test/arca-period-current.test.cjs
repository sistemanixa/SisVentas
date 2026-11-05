'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('./helpers/arca-period-fixture.cjs');
const oct={fecha:'2026-10-30'},nov={fecha:'2026-11-04'};
function load(f){f.ctx.cfCargar();f.ctx.fvCargar();}
test('calendar November stays selected with received November and issued October, in either arrival order',()=>{
 for(const order of [['cf','fv'],['fv','cf']]){const f=create();load(f);for(const side of order)f.emit(side,side==='cf'?[oct,nov]:[oct]);assert.equal(f.ctx.CF_PERIODO_ACTIVO,'2026-11');assert.equal(f.ctx.FV_PERIODO_ACTIVO,'2026-11');assert.equal(f.ctx.cfGetCompFiltrados().length,1);assert.equal(f.ctx.fvGetCompFiltrados().length,0);assert.match(f.node('fact-compensacion-box').innerHTML,/noviembre de 2026/);}
});
test('changing tab never changes the shared month; an explicit historical choice survives incoming data',()=>{
 const f=create();load(f);f.emit('cf',[oct,nov]);f.emit('fv',[oct,nov]);f.ctx.cfSelPeriodo('2026-10');f.ctx.showFactTab('fv',{classList:{add(){}}});assert.equal(f.ctx.FV_PERIODO_ACTIVO,'2026-10');f.emit('fv',[oct,nov]);assert.equal(f.ctx.CF_PERIODO_ACTIVO,'2026-10');assert.equal(f.ctx.FV_PERIODO_ACTIVO,'2026-10');assert.match(f.node('fact-compensacion-box').innerHTML,/octubre de 2026/);
});
test('Todos is explicit and never falls back to the other tab or the latest incoming month',()=>{
 const f=create();load(f);f.emit('cf',[oct,nov]);f.emit('fv',[oct]);f.ctx.cfSelPeriodo(null);f.ctx.showFactTab('fv',{classList:{add(){}}});f.emit('fv',[oct,nov]);assert.equal(f.ctx.CF_PERIODO_ACTIVO,null);assert.equal(f.ctx.FV_PERIODO_ACTIVO,null);assert.equal(f.ctx.cfGetCompFiltrados().length,2);assert.equal(f.ctx.fvGetCompFiltrados().length,2);assert.match(f.node('fact-compensacion-box').innerHTML,/todos los períodos/);
});
test('pending or failed source cannot present a calculated zero; a confirmed empty month is explicit',()=>{
 const f=create();load(f);f.emit('cf',[nov]);f.ctx.fvRenderCompensacion();assert.doesNotMatch(f.node('fact-compensacion-box').innerHTML,/DÉBITO FISCAL|Débito fiscal/);assert.match(f.node('fact-compensacion-box').innerHTML,/Cargando/);f.emit('fv',[oct]);assert.match(f.node('fact-fv-estado').textContent,/Sin comprobantes cargados/);assert.match(f.node('fact-compensacion-box').innerHTML,/21,00/);f.fail('fv');assert.doesNotMatch(f.node('fact-compensacion-box').innerHTML,/Podés facturar hasta/);assert.match(f.node('fact-compensacion-box').innerHTML,/No se pudo/);
});
test('new calendar year advances only an automatic selection, and historical originals stay untouched',()=>{
 const f=create({now:'2026-12-31T12:00:00-03:00'});load(f);f.emit('cf',[{fecha:'2026-12-30'}]);f.emit('fv',[]);const before=JSON.stringify(f.ctx.CF_DATA);f.setNow('2027-01-01T12:00:00-03:00');f.ctx.cfRenderTodo();assert.equal(f.ctx.CF_PERIODO_ACTIVO,'2027-01');assert.equal(f.ctx.FV_PERIODO_ACTIVO,'2027-01');assert.equal(JSON.stringify(f.ctx.CF_DATA),before);f.ctx.cfSelPeriodo('2026-12');f.setNow('2027-02-01T12:00:00-03:00');f.ctx.fvRenderTodo();assert.equal(f.ctx.CF_PERIODO_ACTIVO,'2026-12');
});
test('session change retires fiscal rows and ignores late callbacks from the former identity',()=>{
 const f=create();load(f);f.emit('cf',[nov]);f.emit('fv',[nov]);f.event('sisventas:session-ended');f.ctx.currentUserUid='fixture-other';f.ctx.fbAuth.currentUser={uid:'fixture-other'};f.emit('cf',[oct]);assert.equal(f.ctx.CF_DATA.length,0);assert.equal(f.ctx.FV_DATA.length,0);assert.doesNotMatch(f.node('fact-compensacion-box').innerHTML,/Podés facturar hasta/);
});
test('permission revocation cannot reuse a previous fiscal calculation',()=>{
 const f=create();load(f);f.emit('cf',[nov]);f.emit('fv',[nov]);f.ctx.svPuedeLeerDominio=()=>false;f.event('sisventas:role-changed');f.ctx.fvRenderCompensacion();assert.equal(f.ctx.CF_DATA.length,0);assert.equal(f.ctx.FV_DATA.length,0);assert.doesNotMatch(f.node('fact-compensacion-box').innerHTML,/Podés facturar hasta|Débito fiscal/);
});
test('period matching accepts canonical and historical dates without rewriting rows or guessing invalid dates',()=>{
 const f=create();load(f);f.emit('cf',[nov,{fecha:'05/11/2026'},{fecha:'06-11-2026'},{fecha:'2026-10-30'},{fecha:'31/11/2026'}]);f.emit('fv',[]);assert.equal(f.ctx.cfGetCompFiltrados().length,3);assert.equal(f.ctx.CF_DATA[1].fecha,'05/11/2026');assert.equal(f.ctx.factFechaISO('31/11/2026'),'');assert.equal(f.ctx.factFechaISO('2026-11'),'');f.ctx.cfSelPeriodo(null);assert.equal(f.ctx.cfGetCompFiltrados().length,5);
});
test('reading a month, changing tabs and incoming snapshots do not issue writes or new calendar queries',()=>{
 const f=create();load(f);f.emit('cf',[oct,nov]);f.emit('fv',[oct]);const roots=f.reads.slice();f.ctx.cfSelPeriodo('2026-10');f.ctx.cfSelPeriodo(null);assert.deepEqual(f.reads,roots);assert.deepEqual(roots,['sisventas/comprobantesCompra','sisventas/comprobantesVenta']);assert.equal(f.ctx.fbSet,undefined);assert.equal(f.ctx.fbUpdate,undefined);
});
