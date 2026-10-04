const {test}=require('node:test'),assert=require('node:assert/strict');
const {quote}=require('../js/modules/paraguay-shopping-access');
const {summarize}=require('../js/modules/exterior-user-lists');
test('Flytec usa USD original en detalle y resumen sin exigir URL del comparador',()=>{
 const p={categoria:'COMPRAS PARAGUAY',proveedor:'FLYTEC PARAGUAY',compraARS:306460,proveedores:[{nombre:'FLYTEC PARAGUAY',url:'https://www.flytec.com.py/produto/ezviz/8604',monedaOriginal:'USD',precioOriginal:199,precio:306460}]};
 assert.equal(quote(p).usd,199);assert.equal(quote(p).store,'FLYTEC PARAGUAY');assert.equal(summarize({productos:{p:2}},{p}).usd,398);
});
test('tienda y URL son de la oferta seleccionada, sin inventar local para comparativas',()=>{
 const p={proveedores:[{nombre:'COMPRAS PARAGUAY',url:'https://comprasparaguay.com.ar/producto_123/',urlOferta:'https://comprasparaguay.com.ar/oferta__456/',tiendaOrigen:'Nissei',monedaOriginal:'USD',precioOriginal:50}]};
 assert.equal(quote(p).store,'Nissei');assert.match(quote(p).url,/__456/);delete p.proveedores[0].tiendaOrigen;assert.equal(quote(p).store,'');
});
