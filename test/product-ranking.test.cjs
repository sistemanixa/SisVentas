const {test}=require('node:test'),assert=require('node:assert/strict');const {rank}=require('../js/core/product-ranking');
const a={codigo:'P-1',nombre:'Cámara'},b={codigo:'P-2',nombre:'Cable por metro'};
const opts={month:'2026-10',validSale:v=>!v.anulada,dateOf:v=>v.fecha};
const sale=(id,items,extra={})=>({id,fecha:'2026-10-10',items,...extra});
test('ranking cuenta ventas diferentes, no metros, unidades ni líneas repetidas',()=>{
 const sales=[sale('1',[{cod:'P-2',qty:3000},{cod:'P-1',qty:1},{cod:'P-1',qty:2}]),sale('2',[{cod:'P-1',qty:1}]),sale('3',[{cod:'P-1',qty:1}])],before=JSON.stringify([a,b,sales]);const r=rank([a,b],sales,opts);assert.deepEqual(r.map(x=>[x.product.codigo,x.sales,x.position]),[['P-1',3,1],['P-2',1,2]]);assert.equal(JSON.stringify([a,b,sales]),before);assert.equal(r[0].product,a);
});
test('excluye anulaciones, otros meses y cantidades no positivas sin duplicar venta',()=>{
 const v=sale('1',[{cod:'P-1',qty:1}]);const sales=[v,v,sale('2',[{cod:'P-1'}],{anulada:true}),sale('3',[{cod:'P-1'}],{fecha:'2026-09-30'}),sale('4',[{cod:'P-2',qty:0},{cod:'P-2',qty:-2}])];assert.deepEqual(rank([a,b],sales,opts).map(x=>x.sales),[1]);assert.deepEqual(rank([a,b],sales,{...opts,month:'bad'}),[]);
});
test('identifica código antes del nombre y rechaza nombres o identificadores ambiguos',()=>{
 const same={codigo:'P-3',nombre:'Cámara'};const sales=[sale('1',[{nombre:'Cámara'}]),sale('2',[{cod:'P-1',nombre:'Cable por metro'}]),sale('3',[{cod:'P-1',pid:'P-2'}]),sale('4',[{p:{codigo:'P-3'}}])];assert.deepEqual(rank([a,b,same],sales,opts).map(x=>[x.product.codigo,x.sales]),[['P-1',1],['P-3',1]]);
});
test('empates son estables por nombre y código, no orden de captura',()=>{
 const sales=[sale('1',[{cod:'P-1'},{cod:'P-2'}])];assert.deepEqual(rank([a,b],sales,opts).map(x=>x.product.codigo),rank([b,a],sales,opts).map(x=>x.product.codigo));
});
test('mano de obra se excluye por marca, categoría, tipo y regla canónica aunque lidere ventas',()=>{
 const labor=[{codigo:'MO1',nombre:'Instalación',esManoDeObra:true},{codigo:'MO2',nombre:'Tarea',categoria:'Mano de obra'},{codigo:'MO3',nombre:'Mano de obra en local'},{codigo:'MO4',nombre:'Tarea',tipoProducto:'MANO DE OBRA'},{codigo:'MO5',nombre:'Servicio',canonica:true}];const products=[a,...labor],sales=Array.from({length:10},(_,i)=>sale(String(i),[...labor.map(p=>({cod:p.codigo,qty:1})),...(i===0?[{cod:'P-1',qty:1}]:[])]));const r=rank(products,sales,{...opts,excludeProduct:p=>p.canonica});assert.deepEqual(r.map(x=>x.product.codigo),['P-1']);
});
test('períodos móviles incluyen extremos y evitan desbordes al restar meses',()=>{
 const {periodRange}=require('../js/core/product-ranking');assert.deepEqual(periodRange(1,new Date(2026,2,31)),{from:'2026-02-28',to:'2026-03-31',months:1});assert.deepEqual(periodRange(12,new Date(2024,1,29)),{from:'2023-02-28',to:'2024-02-29',months:12});for(const n of [1,3,6,12])assert.equal(periodRange(n,new Date(2026,9,18)).months,n);const dates=['2026-09-17','2026-09-18','2026-10-18','2026-10-19'];const r=rank([a],dates.map((f,i)=>sale(String(i),[{cod:'P-1'}],{fecha:f})),{...opts,month:undefined,from:'2026-09-18',to:'2026-10-18'});assert.equal(r[0].sales,2);
});
