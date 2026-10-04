const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync('js/modules/purchase-orders.js','utf8');
function context(){const c={window:{obtenerCostoItemVenta:i=>i.costoTotalCompra??i.qty*i.costoUnitarioCompra,_rentIngresoNetoVenta:s=>s.subtotal},materialListLocked:l=>!!l.compraConfirmacion||(l.ordenesIds||[]).length>0,balanceFinalizado:l=>l.estado==='cancelada',providersFor:p=>p?.providers||[]};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function cancelExteriorPreparation('),src.indexOf('  window.ocEliminarPreparacionExterior=')),c);return c;}
const fixture=()=>({productos:{P:{codWeb:'local',providers:[{nombre:'Local',proveedorKey:'L',url:'local',costo:80,disponible:true,exterior:false}]}},ventas:{S:{subtotal:500,items:[{cod:'P',qty:2,origenCompra:'Exterior',costoUnitarioCompra:40,costoUnitarioAntesPreparacion:100}]}},listas_materiales:{A:{estado:'preparacion',ventaFbKey:'S',items:[{codigo:'P',productoKey:'P',linea:0,cantidadNecesaria:2}],simuladorParaguay:{version:6,rows:[{agreed:40}]}}}});
test('eliminar devuelve costos y proveedor local, conserva comisiones e historial',()=>{const d=fixture();context().cancelExteriorPreparation(d,'A','Admin',123);assert.equal(d.ventas.S.costoTotal,160);assert.equal(d.ventas.S.items[0].proveedorCompra,'Local');assert.equal(d.ventas.S.items[0].origenCompra,'Local');assert.equal(d.ventas.S.items[0].costoUnitarioAntesPreparacion,100);assert.equal(d.ventas.S.subtotal,500);assert.equal(d.listas_materiales.A.estado,'cancelada');assert.equal(d.listas_materiales.A.simuladorParaguay,undefined);assert.equal(d.listas_materiales.A.preparacionExteriorEliminada.simulador.version,6);assert.equal(d.ventas.S.audit.length,1);});
test('sin proveedor local u órdenes existentes no se confirma la cancelación',()=>{const d=fixture();d.productos.P.providers=[];assert.throws(()=>context().cancelExteriorPreparation(d,'A','Admin',123),/falta un proveedor local/);const e=fixture();e.ordenes={O:{listaMaterialesId:'A'}};assert.throws(()=>context().cancelExteriorPreparation(e,'A','Admin',123),/órdenes/);});
test('conjunta cancela hijos y devuelve todas las ventas; stock conserva extras en historial',()=>{const d=fixture();d.listas_materiales.A.compraConjuntaId='J';d.listas_materiales.J={estado:'preparacion',origen:'conjunta',sources:[{listId:'A',ventaFbKey:'S'}],simuladorParaguay:{extras:[{code:'X'}]}};context().cancelExteriorPreparation(d,'J','Admin',123);assert.equal(d.listas_materiales.A.compraConjuntaId,undefined);assert.equal(d.listas_materiales.J.estado,'cancelada');assert.equal(d.listas_materiales.J.preparacionExteriorEliminada.simulador.extras[0].code,'X');const stock={listas_materiales:{T:{origen:'stock_paraguay',estado:'preparacion',simuladorParaguay:{extras:[{code:'X'}]}}}};context().cancelExteriorPreparation(stock,'T','Admin',123);assert.equal(stock.listas_materiales.T.estado,'cancelada');});


function scoped(db,failAt,id='A'){
 const c=context();let writes=0;const paths=[];
 const get=p=>p.split('/').slice(1).reduce((v,k)=>v?.[k],db);
 const set=(p,v)=>{const parts=p.split('/').slice(1),k=parts.pop();let parent=db;for(const part of parts)parent=parent[part]||(parent[part]={});parent[k]=JSON.parse(JSON.stringify(v));};
 Object.assign(c,{PATH_LISTS:'sisventas/listas_materiales',state:{orders:[]},findProduct:()=>null});
 Object.assign(c.window,{currentUserUid:'u',permisoModulo:()=>true,fbRef:(_,p)=>p,fbGet:async p=>{paths.push(p);assert.notEqual(p,'sisventas');return {val:()=>structuredClone(get(p))};},SVGuardedWrites:{...require('../js/core/guarded-writes'),restTransaction:async(p,fn)=>{paths.push(p);assert.notEqual(p,'sisventas');if(++writes===failAt)throw Error('disconnect');const next=fn(structuredClone(get(p)));set(p,next);return {committed:true};}}});
 return {run:()=>c.cancelExteriorPreparationScoped(id,'u','Admin',123,()=>{}),paths};
}
test('stock general sólo lee y escribe su lista, conserva extras e historial',async()=>{
 const db={listas_materiales:{A:{estado:'preparacion',origen:'stock_paraguay',simuladorParaguay:{extras:[{code:'X'}]}}}};const task=scoped(db);await task.run();assert.ok(task.paths.every(p=>p==='sisventas/listas_materiales/A'));assert.equal(db.listas_materiales.A.estado,'cancelada');assert.equal(db.listas_materiales.A.preparacionExteriorEliminada.simulador.extras[0].code,'X');
});
test('corte después de actualizar venta se retoma sin duplicar auditoría',async()=>{
 const db=fixture();await assert.rejects(scoped(db,3).run(),/disconnect/);assert.equal(db.ventas.S.items[0].origenCompra,'Local');assert.ok(db.listas_materiales.A.cancelacionExteriorPendiente);await scoped(db).run();assert.equal(db.listas_materiales.A.estado,'cancelada');assert.equal(db.ventas.S.audit.length,1);assert.equal(db.listas_materiales.A.cancelacionExteriorPendiente,undefined);
});
test('sin proveedor local no escribe ni deja operación pendiente',async()=>{
 const db=fixture();db.productos.P.providers=[];await assert.rejects(scoped(db).run(),/proveedor local/);assert.equal(db.listas_materiales.A.cancelacionExteriorPendiente,undefined);assert.equal(db.ventas.S.items[0].origenCompra,'Exterior');
});

test('conjunta se retoma luego de corte sin duplicar venta ni perder cambios ajenos',async()=>{
 const db=fixture();db.listas_materiales.A.compraConjuntaId='J';db.listas_materiales.J={estado:'preparacion',origen:'conjunta',sources:[{listId:'A',ventaFbKey:'S'}],simuladorParaguay:{extras:[{code:'X'}]}};
 await assert.rejects(scoped(db,4,'J').run(),/disconnect/);assert.equal(db.ventas.S.audit.length,1);assert.ok(db.listas_materiales.J.cancelacionExteriorPendiente);db.ventas.S.observaciones='Pago revisado';await scoped(db,null,'J').run();assert.equal(db.ventas.S.audit.length,1);assert.equal(db.ventas.S.observaciones,'Pago revisado');assert.equal(db.listas_materiales.A.estado,'cancelada');assert.equal(db.listas_materiales.J.estado,'cancelada');assert.equal(db.listas_materiales.A.compraConjuntaId,null);
});
test('conflicto real en venta no se sobrescribe y queda operación recuperable',async()=>{
 const db=fixture();await assert.rejects(scoped(db,2).run(),/disconnect/);db.ventas.S.items[0].qty=3;await assert.rejects(scoped(db).run(),/pendiente de revisión/);assert.equal(db.ventas.S.items[0].qty,3);assert.ok(db.listas_materiales.A.cancelacionExteriorPendiente);assert.notEqual(db.listas_materiales.A.estado,'cancelada');
});
