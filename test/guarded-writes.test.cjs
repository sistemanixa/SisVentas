const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {merge,equal}=require('../js/core/guarded-writes');
test('dos usuarios conservan cambios en campos diferentes',()=>{
 const base={nombre:'Inicial',venta:100,proveedores:[{precio:50}]};
 const afterA=merge(base,base,{nombre:'Nuevo',venta:100});
 const afterB=merge(afterA,base,{nombre:'Inicial',venta:120});
 assert.equal(afterB.nombre,'Nuevo');assert.equal(afterB.venta,120);assert.deepEqual(afterB.proveedores,base.proveedores);
});
test('un mismo campo modificado por ambos produce conflicto',()=>{
 assert.equal(merge({venta:130},{venta:100},{venta:120}),undefined);
 assert.equal(merge(null,{venta:100},{venta:120}),undefined);
});
test('no compara por orden de propiedades ni borra campos ajenos',()=>{
 assert.ok(equal({a:1,b:2},{b:2,a:1}));
 assert.deepEqual(merge({a:1,b:2,c:3},{a:1,b:2},{a:null}),{b:2,c:3});
});
function runtime(initial,retry){
 let data=initial,attempts=0;const w={fbDB:{},fbRef:(_,p)=>p,fbGet:async()=>({val:()=>data}),fbRunTransaction:async(_,fn,options)=>{
   assert.equal(options.applyLocally,false);let next=fn(data);attempts++;
   if(retry){data=retry(data);next=fn(data);attempts++;}
   if(next===undefined)return {committed:false};data=next;return {committed:true,snapshot:{val:()=>data}};
 }};
 vm.runInNewContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),{window:w});
 return {api:w.SVGuardedWrites,get data(){return data},get attempts(){return attempts}};
}
test('reintento de Firebase vuelve a verificar el conflicto',async()=>{
 const h=runtime({venta:100},()=>({venta:140}));await assert.rejects(h.api.save('productos/a',{venta:100},{venta:120}),{code:'SV_CONFLICT'});assert.equal(h.data.venta,140);assert.equal(h.attempts,2);
});
test('distribución atómica aborta si se registra un pago durante el guardado',async()=>{
 const h=runtime({gastos:{a:{estado:'pendiente',monto:10}},ctaemp:{e:{m:{monto:10}}}},data=>({...data,gastos:{a:{estado:'pagado',monto:10}}}));
 await assert.rejects(h.api.conditionalUpdate('sisventas',r=>r.gastos.a.estado==='pendiente',{'gastos/a/monto':20,'ctaemp/e/m/monto':20}),{code:'SV_CONFLICT'});
 assert.equal(h.data.gastos.a.estado,'pagado');assert.equal(h.data.ctaemp.e.m.monto,10);
});
test('distribución guarda gasto y movimiento juntos conservando otros registros',async()=>{
 const h=runtime({gastos:{a:{estado:'pendiente',monto:10},b:{monto:99}},ctaemp:{e:{m:{monto:10}}}});
 await h.api.conditionalUpdate('sisventas',r=>r.gastos.a.estado==='pendiente',{'gastos/a/monto':20,'ctaemp/e/m/monto':20});
 assert.equal(h.data.gastos.a.monto,20);assert.equal(h.data.ctaemp.e.m.monto,20);assert.equal(h.data.gastos.b.monto,99);
});
