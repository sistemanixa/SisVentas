'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {commercial,event,receipt,tick}=require('./helpers/audit-pending-fixtures.cjs');
test('volver a Productos no relee historiales; regresar al Dashboard reconcilia ambos sin temporizador',async()=>{const f=commercial();f.c.page='page-dashboard';f.c.SVCommercialOwnership.onValue('ventas',()=>{});f.c.SVCommercialOwnership.onValue('presupuestos',()=>{});await tick();assert.equal(f.calls.length,2);f.c.page='page-productos';for(let i=0;i<5;i++)f.listeners.visibilitychange();await tick();assert.equal(f.calls.length,2);f.c.page='page-dashboard';f.listeners['sisventas:page-changed']();f.listeners['sisventas:page-changed']();await tick();assert.equal(f.calls.length,4);f.listeners['sisventas:page-changed']();await tick();assert.equal(f.calls.length,4);});
test('sesión oculta no consulta; actualizar explícitamente conserva su petición en pantalla sin dependencia',async()=>{const f=commercial();f.c.SVCommercialOwnership.onValue('ventas',()=>{});await tick();f.c.page='page-configuracion';f.c.document.hidden=true;f.listeners.visibilitychange();await tick();assert.equal(f.calls.length,1);f.c.document.hidden=false;f.listeners.visibilitychange();await tick();assert.equal(f.calls.length,1);await f.c.SVCommercialOwnership.refresh('ventas');assert.equal(f.calls.length,2);f.listeners['sisventas:session-ended']();f.c.page='page-dashboard';f.listeners['sisventas:page-changed']();await tick();assert.equal(f.calls.length,2);});
test('eventos sin efecto no toman bloqueo financiero ni escriben comprobantes auxiliares',async()=>{for(const sale of [null,{comisionHabilitada:false},{comisionHabilitada:true,anulada:true},{comisionHabilitada:true,comisionesGeneradas:true}]){const f=event(sale),before=JSON.stringify(f.db.root);assert.equal((await f.api.handle(f.req)).status,'ignored');assert.deepEqual(f.phases,[]);assert.deepEqual(f.calls,[]);assert.equal(JSON.stringify(f.db.root),before);}});
test('recibo terminal se responde sin volver a reservar ni consultar la venta; generación incompleta sigue recuperándose',async()=>{const f=event({comisionHabilitada:true,comisionesGeneradas:true});f.db.root.sv_commission_generation={sale:{estado:'error'}};assert.equal((await f.api.handle(f.req)).status,'completed');assert.equal(f.calls.length,1);f.phases.length=0;const old=f.db.ref.bind(f.db),reads=[];f.db.ref=p=>{reads.push(p);return old(p);};await f.api.handle(f.req);assert.deepEqual(f.phases,[]);assert.equal(reads.length,1);assert.ok(reads[0].startsWith('sv_commission_events/'));});
test('recepción no cambia stock si la fila de la orden cambió desde su apertura',async()=>{
 const f=receipt(),move=f.movement();f.data[f.paths.order].items[0].codigo='OTRO';const before=structuredClone(f.data);
 await assert.rejects(f.c.finishReceipt(structuredClone(f.order),[move]),/cambió/);
 assert.deepEqual(f.data,before);assert.equal(f.writes.length,0);assert.equal(f.data[f.paths.order].recepcionPendiente,undefined);assert.deepEqual(f.notes,[]);
});

test('venta o material ausentes conservan recepción pendiente; restaurar y reintentar no duplica stock',async()=>{
 for(const absent of ['sale','item']){
  const f=receipt(),original=structuredClone(f.data[f.paths.sale]);if(absent==='sale')delete f.data[f.paths.sale];else f.data[f.paths.sale].items=[];
  await assert.rejects(f.c.finishReceipt(structuredClone(f.order),[f.movement()]),/venta|material/);
  const pending=structuredClone(f.data[f.paths.order].recepcionPendiente);assert.ok(pending);assert.equal(pending.inventoryFlowVersion,2);assert.equal(f.data[f.paths.order].recepciones,undefined);
  assert.equal(f.data[f.paths.inventory].general,1);assert.equal(f.data[f.paths.inventory].reservado,0);assert.deepEqual(f.notes,[]);
  f.data[f.paths.sale]=original;await f.c.finishReceipt(f.opened(),[]);
  assert.equal(f.data[f.paths.inventory].general,1);assert.equal(f.data[f.paths.inventory].reservado,0);assert.equal(f.data[f.paths.inventory].enCompra,0);
  assert.equal(f.data[f.paths.order].recepciones.length,1);assert.equal(f.data[f.paths.order].recepciones[0].id,pending.id);assert.equal(f.data[f.paths.order].recepcionPendiente,null);assert.equal(f.data[f.paths.sale].total,100);
  assert.equal(f.writes.filter(write=>write.path===f.paths.inventory).length,1);assert.equal(f.notes.length,1);
 }
});

test('no anuncia éxito si una transacción no confirmó; reintentar conserva stock y costo únicos',async()=>{
 for(const kind of ['abortSale','abortOrder']){
  const f=receipt();f[kind]();await assert.rejects(f.c.finishReceipt(structuredClone(f.order),[f.movement()]));
  assert.equal(f.notes.length,0);const pending=structuredClone(f.data[f.paths.order].recepcionPendiente);assert.ok(pending);
  await f.c.finishReceipt(f.opened(),[]);
  assert.equal(f.data[f.paths.inventory].general,1);assert.equal(f.data[f.paths.inventory].reservado,0);assert.equal(f.data[f.paths.order].recepciones.length,1);assert.equal(f.data[f.paths.order].recepciones[0].id,pending.id);
  assert.equal(f.data[f.paths.sale].items[0].costoRealCompraAcumulado,30);assert.equal(f.writes.filter(write=>write.path===f.paths.inventory).length,1);assert.equal(f.writes.filter(write=>write.path===f.paths.sale).length,1);assert.equal(f.notes.length,1);
 }
});

test('renglones repetidos no reciben costos por coincidencia ambigua',async()=>{
 const f=receipt();f.data[f.paths.sale].items.push({codigo:'P',qty:1,costoUnitarioCompra:60});const before=structuredClone(f.data[f.paths.sale]);
 await assert.rejects(f.c.finishReceipt(structuredClone(f.order),[f.movement()]),/varios renglones/);
 assert.deepEqual(f.data[f.paths.sale],before);assert.ok(f.data[f.paths.order].recepcionPendiente);assert.equal(f.writes.filter(write=>write.path===f.paths.sale).length,0);assert.equal(f.notes.length,0);
});

test('recepción pendiente histórica ambigua exige revisión sin escrituras ni confirmación simulada',async()=>{
 const f=receipt();delete f.data[f.paths.order].inventoryFlowVersion;f.data[f.paths.order].recepcionPendiente={id:'historical-pending',ts:1,movements:[f.movement()]};const before=structuredClone(f.data);
 await assert.rejects(f.c.finishReceipt(f.opened(),[]),/histórica requiere revisión/);
 assert.deepEqual(f.data,before);assert.equal(f.writes.length,0);assert.equal(f.transactions.length,0);assert.deepEqual(f.notes,[]);
});
