'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/ot-lifecycle-fixture.cjs');
const Guard=require('../cotizador/labor-guard'),Index=require('../cotizador/record-list-model');
const Claims=require('../cotizador/ot-delivery-commit-protocol');
function setup(role){
 const f=fixture(role,{createLaborGuard(options){
  const commit=options.store.commit;
  options.store.verifyOTDeliveryFence=async()=>({schema:1,verified:true,canonicalOT:true,inventory:true,rulesDigest:'a'.repeat(64)});
  options.store.commit=async(patch,lease,actor)=>{await Claims.claims({patch,lease,actor,read:options.store.read,query:options.store.query});return commit(patch,lease,actor);};
  return Guard.createLaborGuard(options);
 }});
 f.set('sv_operational_read_config/generation','fictional-generation');
 const ot=f.get('sisventas/ordenes_trabajo/ot');
 Object.assign(ot,{custodiaIniciada:true,custodiaRendida:false,materiales:[{cod:'P-FICTICIO',vendida:3,entregada:3,instalada:0,devuelta:0,custodiaActiva:true,custodiaClasificada:false}]});
 f.set('sisventas/ordenes_trabajo/ot',ot);f.set('sisventas/listados_resumen/ordenes_trabajo/ot',Index.summary('ordenes_trabajo',ot));
 f.set('sisventas/inventario_operativo/product',{general:3,reservado:1,consumido:2,asignaciones:{sale:{reservado:3,consumido:0,liberado:0},foreign:{reservado:0,consumido:2,liberado:0}}});
 return f;
}
for(const role of ['admin','administrativo'])test('circuito con reserva antigua: instalar, replay y cerrar sin modificar firma ni consumo ajeno '+role,async()=>{
 const f=setup(role),ot=f.get('sisventas/ordenes_trabajo/ot'),signature=ot.firmaClienteUrl,foreign=structuredClone(f.get('sisventas/inventario_operativo/product/asignaciones/foreign'));
 const command=f.body('custody',{materiales:ot.materiales.map(row=>({...row,instalada:3,custodiaClasificada:true})),custodiaRendida:true});
 const result=await f.api.execute(f.identity,command);assert.equal(result.committed,true);
 const inv=f.get('sisventas/inventario_operativo/product');assert.equal(inv.general,1);assert.equal(inv.reservado,0);assert.equal(inv.consumido,5);assert.equal(inv.asignaciones.sale.reservado,0);assert.deepEqual(inv.asignaciones.foreign,foreign);assert.equal(f.commits.length,1);
 await f.api.execute(f.identity,command);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/inventario_operativo/product'),inv);
 await f.api.execute(f.identity,f.body('close',{conformidadCliente:'conforme',nombreConformidad:'Persona ficticia'}));
 assert.equal(f.get('sisventas/ordenes_trabajo/ot').estado,'completada');assert.equal(f.get('sisventas/ventas/sale').estadoInst,'instalado');assert.equal(f.get('sisventas/ordenes_trabajo/ot').firmaClienteUrl,signature);assert.deepEqual(f.get('sisventas/inventario_operativo/product'),inv);assert.equal(f.get('sisventas/ventas/sale').total,100);assert.equal(f.get('sisventas/pagos/sentinel').monto,100);
});
test('rechazo del commit conserva OT e inventario antiguos juntos',async()=>{
 const f=setup('admin'),before=structuredClone(f.get('sisventas')),ot=f.get('sisventas/ordenes_trabajo/ot');f.rejectCommit();
 await assert.rejects(f.api.execute(f.identity,f.body('custody',{materiales:ot.materiales.map(row=>({...row,instalada:3,custodiaClasificada:true})),custodiaRendida:true})),/PATCH rechazado/);
 assert.deepEqual(f.get('sisventas'),before);assert.equal(f.commits.length,0);
});
for(const role of ['admin','administrativo'])test('entrega con diferencia ajena, remito único y posterior instalación '+role,async()=>{
 const f=setup(role),ot=f.get('sisventas/ordenes_trabajo/ot');Object.assign(ot,{custodiaIniciada:false,materiales:[{cod:'P-FICTICIO',vendida:1,entregada:0,instalada:0,devuelta:0}]});
 f.set('sisventas/ordenes_trabajo/ot',ot);f.set('sisventas/listados_resumen/ordenes_trabajo/ot',Index.summary('ordenes_trabajo',ot));
 const inventory={general:2,reservado:5,consumido:12,asignaciones:{foreign:{reservado:6,consumido:12,liberado:0}}};f.set('sisventas/inventario_operativo/product',inventory);
 const command=f.body('delivery',{entregas:[{index:0,cantidad:1}]});await f.api.execute(f.identity,command);await f.api.execute(f.identity,command);
 const delivered=f.get('sisventas/ordenes_trabajo/ot'),reserved=f.get('sisventas/inventario_operativo/product');
 assert.equal(f.commits.length,1);assert.equal(Object.keys(delivered.remitosEntrega).length,1);assert.equal(delivered.materiales[0].entregada,1);assert.equal(reserved.general,1);assert.equal(reserved.reservado,6);assert.equal(reserved.asignaciones.sale.reservado,1);assert.deepEqual(reserved.asignaciones.foreign,inventory.asignaciones.foreign);
 await f.api.execute(f.identity,f.body('custody',{materiales:delivered.materiales.map(row=>({...row,instalada:1,custodiaClasificada:true})),custodiaRendida:true}));
 const installed=f.get('sisventas/inventario_operativo/product');assert.equal(installed.general,1);assert.equal(installed.reservado,5);assert.equal(installed.asignaciones.sale.reservado,0);assert.equal(installed.consumido,13);assert.deepEqual(installed.asignaciones.foreign,inventory.asignaciones.foreign);assert.equal(Object.keys(f.get('sisventas/ordenes_trabajo/ot').remitosEntrega).length,1);
});
test('entrega con reserva propia sin respaldo no deja unidades fantasma después de instalar',async()=>{
 const f=setup('admin'),ot=f.get('sisventas/ordenes_trabajo/ot');Object.assign(ot,{custodiaIniciada:false,materiales:[{cod:'P-FICTICIO',vendida:3,entregada:0,instalada:0,devuelta:0}]});
 f.set('sisventas/ordenes_trabajo/ot',ot);f.set('sisventas/listados_resumen/ordenes_trabajo/ot',Index.summary('ordenes_trabajo',ot));
 const foreign=structuredClone(f.get('sisventas/inventario_operativo/product/asignaciones/foreign'));
 const command=f.body('delivery',{entregas:[{index:0,cantidad:3}]});await f.api.execute(f.identity,command);await f.api.execute(f.identity,command);
 const delivered=f.get('sisventas/ordenes_trabajo/ot'),reserved=f.get('sisventas/inventario_operativo/product');assert.equal(reserved.general,1);assert.equal(reserved.reservado,3);assert.equal(reserved.asignaciones.sale.reservado,3);assert.equal(Object.keys(delivered.remitosEntrega).length,1);
 const install=f.body('custody',{materiales:delivered.materiales.map(row=>({...row,instalada:3,custodiaClasificada:true})),custodiaRendida:true});await f.api.execute(f.identity,install);await f.api.execute(f.identity,install);
 const final=f.get('sisventas/inventario_operativo/product');assert.equal(final.general,1);assert.equal(final.reservado,0);assert.equal(final.asignaciones.sale.reservado,0);assert.equal(final.consumido,5);assert.deepEqual(final.asignaciones.foreign,foreign);assert.equal(f.commits.length,2);
});
