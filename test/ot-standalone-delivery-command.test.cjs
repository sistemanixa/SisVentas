'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Fixture=require('./helpers/ot-performance-fixture.cjs'),Index=require('../cotizador/record-list-model'),{digest}=require('../cotizador/labor-guard'),{createOTInventory}=require('../cotizador/ot-inventory');
async function fixture(){
 const f=await Fixture.create({rowCount:1,otherCount:0,prepare:data=>{
  const ot=data.sisventas.ordenes_trabajo.ot;delete ot.ventaFbKey;delete ot.ventaId;delete ot.venta;ot.tecnico='Fiction technician';ot.custodiaIniciada=false;ot.estado='pendiente';
  Object.assign(ot.materiales[0],{productoKey:'product0',entregada:0,custodiaActiva:false});
  data.sv_ot_inventory_config={schema:1,ready:true,generation:'fiction-generation',referenceMode:'legacy'};
  data.sisventas.inventario_operativo.product0={general:10,reservado:0,consumido:0,asignaciones:{}};
  data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
 }});
 return{...f,api:createOTInventory({...f.runtime,enabled:true,isInstalled:async()=>true}),body:{id:'fiction-first-delivery',otKey:'ot',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot')),kind:'delivery',changes:{entregas:[{index:0,cantidad:2}]}}};
}
test('first standalone delivery creates one physical receipt and remito without creating sale',async()=>{
 const f=await fixture(),sales=structuredClone(f.get('sisventas/ventas')),ready=await f.api.available(f.identity,{otKey:'ot',kind:'delivery'});assert.equal(ready.ready,true);
 const result=await f.api.execute(f.identity,f.body);assert.equal(result.ot.materiales[0].entregada,2);assert.equal(result.ot.materiales[0].instalada,0);assert.equal(result.ot.remitosEntrega[f.body.id].items[0].cantidad,2);
 assert.equal(f.get('sisventas/inventario_operativo/product0').general,8);assert.equal(f.get('sisventas/inventario_operativo/product0').reservado,2);assert.equal(f.get('sisventas/inventario_operativo/product0').consumido,0);assert.deepEqual(f.get('sisventas/ventas'),sales);
 await f.api.execute(f.identity,f.body);assert.equal(f.commits.length,1);
});
for(const changes of [{entregas:[{index:0,cantidad:3}]},{entregas:[{index:0,cantidad:2},{index:0,cantidad:1}]},{entregas:[{index:0,cantidad:2}],ventaFbKey:'invented'}])test('standalone delivery rejects invalid typed selection '+JSON.stringify(changes),async()=>{const f=await fixture();await assert.rejects(f.api.execute(f.identity,{...f.body,changes}));assert.equal(f.commits.length,0);});
test('standalone delivery respects fresh delivery permission and refuses an ambiguous sale reference',async()=>{
 for(const invalid of ['permission','sale','history']){const f=await fixture();if(invalid==='permission')f.set('sv_permisos/admin/acciones/ot/entregarMateriales',false);if(invalid==='sale')f.set('sisventas/ordenes_trabajo/ot/venta',' ');if(invalid==='history')f.set('sisventas/ordenes_trabajo/ot/materiales/0/instalada',1);const body={...f.body,expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot'))};await assert.rejects(f.api.execute(f.identity,body));assert.equal(f.commits.length,0);}
});
