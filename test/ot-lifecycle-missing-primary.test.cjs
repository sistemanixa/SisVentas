'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/ot-lifecycle-fixture.cjs'),Index=require('../cotizador/record-list-model');
for(const role of ['admin','administrativo','tecnico'])test('verified one-way OT link closes once without inventing a primary or changing financials: '+role,async()=>{
 const f=fixture(role);f.set('sisventas/ventas/sale/otId',null);
 const sale=structuredClone(f.get('sisventas/ventas/sale')),payments=structuredClone(f.get('sisventas/pagos')),stock=structuredClone(f.get('sisventas/inventario_operativo')),body=f.body();
 await f.api.execute(f.identity,body);await f.api.execute(f.identity,body);
 assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/ordenes_trabajo/ot/estado'),'completada');
 assert.equal(f.get('sisventas/ventas/sale/estadoInst'),'instalado');assert.equal(f.get('sisventas/ventas/sale/otId'),null);
 const after=structuredClone(f.get('sisventas/ventas/sale'));delete after.estadoInst;delete after.audit;delete sale.estadoInst;delete sale.audit;
 assert.deepEqual(after,sale);assert.deepEqual(f.get('sisventas/pagos'),payments);assert.deepEqual(f.get('sisventas/inventario_operativo'),stock);
});
test('a missing primary never marks installed while another verified visit is open',async()=>{
 const f=fixture();f.set('sisventas/ventas/sale/otId',null);f.set('sisventas/listados_resumen/ordenes_trabajo/other',Index.summary('ordenes_trabajo',{id:'OT-OTHER',ventaFbKey:'sale',ventaId:'V-FICTICIA',estado:'en_curso',_svListRevision:1}));
 await f.api.execute(f.identity,f.body());assert.equal(f.get('sisventas/ventas/sale/estadoInst'),'en_instalacion');assert.equal(f.get('sisventas/ventas/sale/otId'),null);
});
for(const field of ['otFbKey','otKey','ordenTrabajoId','ordenTrabajoFbKey','ot','otNumero'])test('a conflicting legacy primary remains blocked: '+field,async()=>{
 const f=fixture();f.set('sisventas/ventas/sale/otId',null);f.set('sisventas/ventas/sale/'+field,'other');
 await assert.rejects(f.api.execute(f.identity,f.body()),/vínculo/);assert.equal(f.commits.length,0);
});
for(const [field,value]of [['ventaFbKey','different'],['ventaId','V-OTHER'],['id','OT-OTHER']])test('one-way link requires the exact indexed OT: '+field,async()=>{
 const f=fixture();f.set('sisventas/ventas/sale/otId',null);f.set('sisventas/listados_resumen/ordenes_trabajo/ot/'+field,value);
 await assert.rejects(f.api.execute(f.identity,f.body()),/vínculo/);assert.equal(f.commits.length,0);
});
