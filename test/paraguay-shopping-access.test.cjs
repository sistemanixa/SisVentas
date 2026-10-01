const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {eligible,quote,csv}=require('../js/modules/paraguay-shopping-access');
test('solo admite productos activos de la categoría exacta, no otro proveedor paraguayo',()=>{
  assert.equal(eligible({categoria:'COMPRAS PARAGUAY'}),true);
  for(const p of [{categoria:'CAMARAS IP',proveedor:'FLYTEC PARAGUAY'},{categoria:'COMPRAS PARAGUAY',activo:false},{categoria:'COMPRAS PARAGUAY',esManoDeObra:true}])assert.equal(eligible(p),false);
});
test('lista exporta cantidad, precio USD y costo con envío sin incluir otros productos',()=>{
  const products={p:{categoria:'COMPRAS PARAGUAY',codigo:'P-1',nombre:'Patinete',proveedores:[{url:'https://www.comprasparaguai.com.br/producto__1/',precioOriginal:597,monedaOriginal:'USD',precio:922365,costoRealArs:932365}]},otro:{categoria:'CAMARAS IP',nombre:'Oculto'}};
  assert.equal(quote(products.p).ars,932365);
  const value=csv({p:2,otro:10},products);assert.match(value,/"2";"597";"932365"/);assert.doesNotMatch(value,/Oculto/);
  products.p.nombre='=IMPORTXML("datos")';assert.match(csv({p:1},products),/'=IMPORTXML/);
});
test('el rol no puede abrir ningún módulo general aunque intenten habilitarlo',()=>{
  const window={currentRole:'compras_paraguay',PERMISOS_ROLES:{compras_paraguay:{bloqueados:[]}}};
  vm.runInNewContext(fs.readFileSync('js/core/access-control.js','utf8'),{window});
  for(const page of ['productos','dashboard','clientes','venta','usuarios','balancecompra','desconocido'])assert.equal(window.SisVentas.Access.canAccess(page),false);
});
