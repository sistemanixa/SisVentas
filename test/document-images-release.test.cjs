'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
function extract(name){const source=readActiveApp().source,start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,'Missing active function '+name);const ends=/^\}/gm;ends.lastIndex=start;for(let match;(match=ends.exec(source));){const candidate=source.slice(start,match.index+1);try{new vm.Script(candidate);return candidate;}catch{}}throw Error('Incomplete '+name);}
function context(extra={}){const root={prodData:{},escapeHTML:value=>String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),...extra};vm.createContext(root);for(const name of ['_codigoProductoComparable','productoRefDesdeItem','productoDesdeItem','urlImagenProductoVisual','imagenProductoItemHTML'])vm.runInContext(extract(name),root);return root;}
test('late catalog refresh changes sale detail and both editor thumbnails without rebuilding rows',()=>{
 const input={value:'123,45',selectionStart:2,selectionEnd:5},images=Array.from({length:3},()=>({outerHTML:''}));
 const row=index=>({dataset:{ventaItemIndex:'0',productoFbKey:'fixture'},querySelector:selector=>selector.includes('item-prod-img')?images[index]:{textContent:selector==='.prod-sel-cod'?'60876':'Producto ficticio'}});
 const rows=[row(0),row(1),row(2)],nodes={'venta-detalle-view':{style:{display:'block'},querySelectorAll:()=>[rows[0]]},'det-body':{querySelectorAll:()=>[rows[1]]},'pp-body':{querySelectorAll:()=>[rows[2]]}};
 const record={items:[{cod:'60876',qty:2,punit:123.45,costoUnitarioCompra:12.345}]},before=JSON.stringify(record);
 const root=context({document:{activeElement:input,getElementById:id=>nodes[id]||null},_ventaDetActualId:'fixture-sale',_svResolverVentaRegistro:()=>record});root.window=root;
 vm.runInContext(extract('refrescarImagenesVentaYEditores'),root);root.refrescarImagenesVentaYEditores();images.forEach(image=>assert.match(image.outerHTML,/placeholder/));
 root.prodData={fixture:{fbKey:'fixture',codigo:'P-60876',imagenUrl:'https://fixture.invalid/arrived.png'}};root.refrescarImagenesVentaYEditores();
 images.forEach(image=>assert.match(image.outerHTML,/arrived\.png/));assert.equal(JSON.stringify(record),before);assert.equal(root.document.activeElement,input);assert.deepEqual(input,{value:'123,45',selectionStart:2,selectionEnd:5});assert.equal(nodes['det-body'].querySelectorAll()[0],rows[1]);assert.equal(nodes['pp-body'].querySelectorAll()[0],rows[2]);
});
for(const reference of [{cod:'60876'},{codigo:'00060876'},{productoId:'fixture-key'},{fbKeyProducto:'fixture-key'},{descripcion:'Producto ficticio'}])test('historical reference '+JSON.stringify(reference)+' resolves catalog image without changing source',()=>{const root=context({prodData:{'fixture-key':{fbKey:'fixture-key',codigo:'P-60876',nombre:'Producto ficticio',imagenUrl:'https://fixture.invalid/photo.png'}}}),before=JSON.stringify(reference);assert.match(root.imagenProductoItemHTML(reference,''),/https:\/\/fixture\.invalid\/photo\.png/);assert.equal(JSON.stringify(reference),before);});
test('saved image remains available before catalog response',()=>{const root=context();assert.match(root.imagenProductoItemHTML({cod:'60876',imagenUrl:'https://fixture.invalid/saved.png'},''),/saved\.png/);});
test('archived data image is not replaced by an unverified remote original',()=>{const root=context();assert.equal(root.urlImagenProductoVisual({imagenUrl:'data:image/png;base64,Zml4dHVyZQ==',imagenUrlOriginal:'https://fixture.invalid/unavailable.png'},''),'data:image/png;base64,Zml4dHVyZQ==');});
test('late catalog refresh updates only budget thumbnail and preserves input selection and focus',()=>{
 const item={cod:'60876',qty:2,punit:100.25,costoUnitarioCompra:20.125},input={value:'100,25',selectionStart:1,selectionEnd:4},image={outerHTML:''},row={dataset:{pptoItemIndex:'0'},querySelector:selector=>selector==='.item-prod-img'?image:null};
 const nodes={'ppto-detalle-view':{style:{display:'block'}},'ppto-det-items':{querySelectorAll:()=>[row]}};
 const root=context({document:{activeElement:input,getElementById:id=>nodes[id]||null},pptoActualId:'fixture-budget',buscarPptoPorRef:()=>({items:[item]})});
 vm.runInContext(extract('refrescarImagenesDetallePresupuesto'),root);const before=JSON.stringify(item);
 root.refrescarImagenesDetallePresupuesto();assert.match(image.outerHTML,/placeholder/);
 root.prodData={fixture:{fbKey:'fixture',codigo:'P-60876',imagenUrl:'https://fixture.invalid/late.png'}};root.refrescarImagenesDetallePresupuesto();
 assert.match(image.outerHTML,/late\.png/);assert.equal(JSON.stringify(item),before);assert.equal(root.document.activeElement,input);assert.deepEqual(input,{value:'100,25',selectionStart:1,selectionEnd:4});
});
