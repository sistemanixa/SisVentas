'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{fixture}=require('./helpers/ot-material-coherence-fixture.cjs');
function setup(rows,products={}){const f=fixture({ot:{fbKey:'fiction-units',estado:'pendiente',tecnico:'Persona ficticia',custodiaIniciada:true,materiales:rows.map(([cod,qty,extra={}])=>({cod,vendida:qty,entregada:qty,instalada:0,custodiaActiva:true,...extra}))}});f.w.prodData=products;return f;}
test('heterogeneous OT summary separates 305 meters from nine units without rewriting rows',()=>{
 const f=setup([['SW',1],['CABLE',305],['BOX',2],['PLUG',6]],Object.fromEntries([['SW','Unidad'],['CABLE','Metro'],['BOX','unidades'],['PLUG','u']].map(([codigo,unidad])=>[codigo,{codigo,unidad}]))),before=JSON.stringify(f.ot);f.render();const html=f.nodes['ot-custodia-resumen'].innerHTML;a.match(html,/9 unidades \+ 305 metros/);a.doesNotMatch(html,/314/);a.match(f.nodes['ot-materiales'].innerHTML,/305 metros/);a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,[]);
});
test('fractionability never implies meters and presentation size never multiplies the delivered quantity',()=>{
 const f=setup([['K',2.5],['L',0.75]],{k:{codigo:'K',unidad:'kg',fraccionable:true,cantidadPorPresentacion:25},l:{codigo:'L',unidad:'litro',fraccionable:true,metrosPorPresentacion:305}});f.render();const html=f.nodes['ot-custodia-resumen'].innerHTML;a.match(html,/2,5 kg \+ 0,75 litros/);a.doesNotMatch(html,/metros|305|3,25/);a.equal(f.ot.materiales[0].entregada,2.5);
});
test('unknown or missing fractionable unit stays explicit and separate by product',()=>{
 const f=setup([['X',2],['Y',3]],{x:{codigo:'X',fraccionable:true}});f.render();const html=f.nodes['ot-custodia-resumen'].innerHTML;a.match(html,/2 sin unidad confirmada \(X\) \+ 3 sin unidad confirmada \(Y\)/);a.doesNotMatch(html,/5 unidades|metros/);
});
test('late catalog unit changes presentation without changing custody or inventing a unit before arrival',()=>{
 const f=setup([['C',305]]),before=JSON.stringify(f.ot);f.render();a.match(f.nodes['ot-custodia-resumen'].innerHTML,/sin unidad confirmada/);f.w.prodData.c={codigo:'C',unidad:'Metro',fraccionable:true};f.render();a.match(f.nodes['ot-custodia-resumen'].innerHTML,/305 metros/);a.doesNotMatch(f.nodes['ot-custodia-resumen'].innerHTML,/sin unidad confirmada/);a.equal(JSON.stringify(f.ot),before);a.deepEqual(f.writes,[]);
});
test('stored explicit measurement unit is preserved independently of current catalog unit',()=>{
 const f=setup([['M',1.25,{unidad:'kg'}]],{m:{codigo:'M',unidad:'Metro'}});f.render();a.match(f.nodes['ot-custodia-resumen'].innerHTML,/1,25 kg/);a.doesNotMatch(f.nodes['ot-custodia-resumen'].innerHTML,/metros/);
});
test('unit labels are escaped as text in the rendered summary and table',()=>{
 const f=setup([['X',1,{unidad:'<img src=x onerror=bad>'}]]);f.render();a.doesNotMatch(f.nodes['ot-custodia-resumen'].innerHTML,/<img/);a.match(f.nodes['ot-materiales'].innerHTML,/&lt;img/);
});
