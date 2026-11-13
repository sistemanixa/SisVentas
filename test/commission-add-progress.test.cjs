'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commissions-participant-native-fixture.cjs');

test('alta demorada muestra actividad y bloquea doble clic, sin cierre ni temporizador',async t=>{
 const f=await fixture(t);await f.add();assert.equal(await f.page.locator('#com-det-agregar button').isDisabled(),true);assert.match(await f.page.locator('#com-det-agregar button').innerText(),/Agregando/);assert.match(await f.page.locator('#com-det-estado').innerText(),/Guardando participante/);assert.equal((await f.report()).creates,1);await f.release();assert.notEqual(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.match(await f.page.locator('#com-det-estado').innerText(),/Participante guardado/);assert.equal(await f.page.locator('#com-det-participantes .comision-participante').count(),2);
});

test('error definitivo conserva detalle, explica el fallo y libera botón',async t=>{
 const f=await fixture(t);await f.page.evaluate(()=>{_generarComisionVentaAtomica=()=>{trace.creates++;return Promise.reject(Object.assign(Error('Conflicto ficticio'),{svLaborAttempted:false}))}});await f.add();await f.page.waitForTimeout(30);assert.equal(await f.page.locator('#com-det-agregar button').isDisabled(),false);assert.match(await f.page.locator('#com-det-agregar button').innerText(),/Agregar/);assert.notEqual(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.ok((await f.report()).notices.some(m=>/Conflicto ficticio/.test(m)));assert.equal((await f.report()).creates,1);
});

test('cerrar durante el guardado no reabre el detalle al responder',async t=>{
 const f=await fixture(t);await f.add();await f.page.evaluate(()=>cerrarDetalleComision());await f.release();assert.equal(await f.page.locator('#modal-comision-gestion').evaluate(el=>el.style.display),'none');assert.equal((await f.report()).creates,1);
});

test('confirmed participant updates the open detail once without reopening or reloading its sale',async t=>{
 const f=await fixture(t);await f.add();await f.release();await f.page.evaluate(()=>{document.dispatchEvent(new Event('sisventas:data-state-changed'));renderModuloComisiones();renderModuloComisiones()});assert.equal(await f.page.locator('#com-det-participantes .comision-participante').count(),2);const trace=await f.report();assert.equal(trace.creates,1);assert.equal(trace.refreshes,0);assert.equal(trace.reads.filter(r=>r.type==='sale').length,1);assert.equal(trace.states.some(s=>s.at>trace.createAt&&(!s.visible||s.participants===0)),false);assert.match(await f.page.locator('#com-det-estado').innerText(),/Participante guardado/);
});
