'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,functionSource}=require('./helpers/app-functions.cjs');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const helpers=['_cantidadItemVenta','_cantidadCreditoHistoricoEmitida','creditoHistoricoDisponible','_claveCreditoHistorico','_aplicarCreditosHistoricosEnRaiz','_guardarVentaConCreditosHistoricosAtomico'];
const sale=(credits=[{ventaOrigenKey:'origin',itemOrigenIndex:0,cantidad:1,precioHistoricoUnitario:100,importe:-100}])=>({id:'V-DEMO',ts:1234,fecha:'2026-10-25',total:121,items:[{cod:'P-DUP',qty:1,punit:200,sub:200},{cod:'P-DUP',qty:1,punit:-100,sub:-100,creditoHistorico:true}],creditosHistoricos:credits});
function fixture(options={}){
 const data=clone(options.data||{'sisventas/ventas/origin':{id:'V-ORIGIN',items:[{cod:'P-DUP',desc:'Producto',qty:1,punit:100,costoUnitarioCompra:33.33}],pagos:{kept:{monto:121}},comisionPrivada:{pct:17,gananciaBase:12345}},'sisventas/ventas/unrelated':{id:'V-NOT-READ',items:[{qty:99}],privado:'CANARIO_NO_DESCARGAR'}}),calls=[],commits=[];let queue=Promise.resolve();
 const c={window:null,fbDB:{},SVLaborWrites:{atomic({paths,build}){calls.push([...paths]);assert.ok(paths.every(path=>/^sisventas\/ventas\/[^/]+$/.test(path)));assert.ok(!paths.includes('sisventas/ventas/unrelated'));const work=queue.then(async()=>{const values={};for(const path of paths)values[path]=clone(data[path]??null);if(options.beforeBuild)options.beforeBuild(values,data,paths);const updates=build(values);if(updates===undefined)return {committed:false};assert.deepEqual(Object.keys(updates).sort(),[...paths].sort());if(options.error)throw options.error;for(const [path,value]of Object.entries(updates))data[path]=clone(value);commits.push(clone(updates));return {committed:options.committed!==false,value:clone(updates)};});queue=work.catch(()=>{});return work;}},fbGet(){throw Error('No GET directo');},fbRunTransaction(){throw Error('No transacción padre');}};c.window=c;load(c,helpers);return {c,data,calls,commits};
}
test('crédito activo lee únicamente origen y ausencia del destino, sin historial total',async()=>{
 const f=fixture(),input=sale(),before=clone(input),unrelated=clone(f.data['sisventas/ventas/unrelated']),payment=clone(f.data['sisventas/ventas/origin'].pagos);const out=await f.c._guardarVentaConCreditosHistoricosAtomico(input);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].length,2);assert.equal(f.calls[0][0],'sisventas/ventas/origin');assert.match(f.calls[0][1],/^sisventas\/ventas\/credito_1234_/);assert.equal(out.fbKey,f.calls[0][1].split('/').at(-1));assert.equal(Object.keys(out.creditosOrigen).length,1);assert.equal(Object.keys(f.data['sisventas/ventas/origin'].creditosEmitidos).length,1);assert.deepEqual(f.data['sisventas/ventas/origin'].pagos,payment);assert.deepEqual(f.data['sisventas/ventas/origin'].comisionPrivada,{pct:17,gananciaBase:12345});assert.deepEqual(f.data['sisventas/ventas/unrelated'],unrelated);assert.deepEqual(input,before);
});
test('varios renglones de un mismo origen comparten una lectura sin confundir SKU duplicado',async()=>{
 const f=fixture({data:{'sisventas/ventas/origin':{items:[{cod:'P-DUP',qty:3,punit:100},{cod:'P-DUP',qty:4,punit:250}]}}}),out=await f.c._guardarVentaConCreditosHistoricosAtomico(sale([{ventaOrigenKey:'origin',itemOrigenIndex:0,cantidad:2,precioHistoricoUnitario:100,importe:-200},{ventaOrigenKey:'origin',itemOrigenIndex:1,cantidad:3,precioHistoricoUnitario:250,importe:-750}]));assert.equal(f.calls[0].length,2);assert.deepEqual(Object.values(out.creditosOrigen).map(c=>c.itemOrigenIndex),[0,1]);assert.deepEqual(Object.values(out.creditosOrigen).map(c=>c.importe),[-200,-750]);
});
test('dos orígenes explícitos conservan vínculos y cantidades fraccionarias',async()=>{
 const f=fixture({data:{'sisventas/ventas/a':{items:[{qty:2.5}]},'sisventas/ventas/b':{items:[{qty:3.75}]}}}),credits=[{ventaOrigenKey:'a',itemOrigenIndex:0,cantidad:1.25,importe:-50},{ventaOrigenKey:'b',itemOrigenIndex:0,cantidad:2.5,importe:-70}],out=await f.c._guardarVentaConCreditosHistoricosAtomico(sale(credits));assert.equal(f.calls[0].length,3);assert.deepEqual(Object.values(out.creditosOrigen).map(c=>c.cantidad),[1.25,2.5]);
});
test('concurrencia no permite consumir dos veces el mismo remanente',async()=>{
 const f=fixture(),results=await Promise.allSettled([f.c._guardarVentaConCreditosHistoricosAtomico(sale()),f.c._guardarVentaConCreditosHistoricosAtomico(sale())]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(f.commits.length,1);assert.equal(Object.keys(f.data['sisventas/ventas/origin'].creditosEmitidos).length,1);
});
for(const key of ['', 'a/b','a.b','a#b','a$b','a[b]','__proto__','constructor','prototype','a\u0000b'])test('ruta inválida '+JSON.stringify(key)+' rechaza antes de I/O',async()=>{
 const f=fixture();await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale([{ventaOrigenKey:key,itemOrigenIndex:0,cantidad:1}])),/seleccionar las ventas/);assert.equal(f.calls.length,0);assert.equal(f.commits.length,0);
});
test('más de127 orígenes no trunca la operación ni consulta un padre como fallback',async()=>{
 const f=fixture();await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale(Array.from({length:128},(_,i)=>({ventaOrigenKey:'origin'+i,itemOrigenIndex:0,cantidad:1})))),/seleccionar/);assert.equal(f.calls.length,0);
});
test('destino ocupado no se reemplaza ni se presenta como crédito aplicado',async()=>{
 const f=fixture({beforeBuild(values,_data,paths){values[paths.at(-1)]={id:'OTRA-VENTA',pagos:{p:{monto:100}}};}});await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale()),/destino ya existe/);assert.equal(f.commits.length,0);
});
for(const kind of ['missing','excess'])test(kind+' conserva estado completo cuando el origen no admite el crédito',async()=>{
 const f=fixture(),before=clone(f.data),credits=[{ventaOrigenKey:kind==='missing'?'missing':'origin',itemOrigenIndex:0,cantidad:kind==='excess'?2:1}];await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale(credits)),/disponible/);assert.deepEqual(f.data,before);assert.equal(f.commits.length,0);
});
test('error de transporte no ofrece éxito ni repite la operación por su cuenta',async()=>{
 const f=fixture({error:Error('Fallo ficticio')}),before=clone(f.data);await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale()),/Fallo ficticio/);assert.equal(f.calls.length,1);assert.equal(f.commits.length,0);assert.deepEqual(f.data,before);
});
test('ausencia del bridge rechaza, nunca usa SDK padre heredado',async()=>{
 const f=fixture();delete f.c.SVLaborWrites;await assert.rejects(f.c._guardarVentaConCreditosHistoricosAtomico(sale()),/conexión segura/);assert.equal(f.calls.length,0);
});
test('función activa ya no solicita colección de ventas ni implementa otra matemática',()=>{
 const src=functionSource('_guardarVentaConCreditosHistoricosAtomico');assert.doesNotMatch(src,/fbRunTransaction|fbGet|fbRef|Object\.values\(ventas/);assert.match(src,/SVLaborWrites\.atomic/);assert.match(src,/_aplicarCreditosHistoricosEnRaiz/);
});
