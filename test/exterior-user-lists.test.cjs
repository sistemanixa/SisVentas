const {test}=require('node:test'),assert=require('node:assert/strict');const {summarize}=require('../js/modules/exterior-user-lists');
test('listas conservan cantidades y totalizan USD y costo ARS con envío',()=>{const s=summarize({productos:{p:2}},{p:{nombre:'Patinete',proveedores:[{url:'https://www.comprasparaguai.com.br/p__1/',monedaOriginal:'USD',precioOriginal:420,precio:648900,costoRealArs:658900}]}});assert.equal(s.units,2);assert.equal(s.usd,840);assert.equal(s.ars,1317800);});
test('producto retirado sigue visible en el detalle de la lista',()=>{const s=summarize({productos:{retirado:3}},{});assert.equal(s.units,3);assert.equal(s.rows[0].name,'Producto no disponible');assert.equal(s.ars,0);});
test('el dominio argentino conserva el precio original USD',()=>{const s=summarize({productos:{p:2}},{p:{proveedores:[{url:'https://comprasparaguay.com.ar/producto_123/',monedaOriginal:'USD',precioOriginal:172}]}});assert.equal(s.usd,344);});

 test('usuarios no administradores no pueden cargar la sección',()=>{const vm=require('node:vm'),fs=require('node:fs');let reads=0;const document={addEventListener(){},getElementById(){throw Error('No debe montar');}};const window={document,currentRole:'compras_paraguay',currentUserUid:'u',permisoModulo:()=>true,fbGet:()=>{reads++;}};vm.runInNewContext(fs.readFileSync('js/modules/exterior-user-lists.js','utf8'),{window,document,setTimeout,clearTimeout});window.SVExteriorLists.mount();assert.equal(reads,0);});

test('cuenta productos distintos por local y separa unidades',()=>{
 const product=store=>({proveedores:[{nombre:'COMPRAS PARAGUAY',url:'https://comprasparaguay.com.ar/p__1/',tiendaOrigen:store}]});
 const s=summarize({productos:{a:3,b:1,c:2,d:1}},{a:product('Nissei'),b:product('Nissei'),c:product('Cellshop')});
 assert.deepEqual(s.stores.find(g=>g.name==='Nissei'),{name:'Nissei',products:2,units:4});
 assert.equal(s.stores.find(g=>g.name==='Cellshop').products,1);
 assert.equal(s.stores.find(g=>g.name==='Local por identificar').products,1);
});
