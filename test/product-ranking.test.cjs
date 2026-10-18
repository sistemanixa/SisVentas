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
