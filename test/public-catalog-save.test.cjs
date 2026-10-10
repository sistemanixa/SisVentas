const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('fs');
test('guardar publica, actualiza y retira un producto con índice atómico',async()=>{
 const writes=[];const window={document:{},obtenerDolarReferenciaProducto:()=>({valor:1540}),fbRef:()=> 'root',fbUpdate:async(r,u)=>writes.push(u)};vm.runInNewContext(fs.readFileSync('js/modules/public-catalog-share.js','utf8'),{window,URL});
 const p={fbKey:'p',categoria:'COMPRAS PARAGUAY',catalogoVisible:true,ventaARS:154000,iva:0,nombre:'JBL'};
 await window.SVPublicCatalog.syncProduct(p);assert.equal(writes[0]['sv_catalogo_publico/p'].precioUSD,100);assert.equal(writes[0]['sv_catalogo_publico_index/p'],true);
 await window.SVPublicCatalog.syncProduct({...p,ventaARS:308000},p);assert.equal(writes[1]['sv_catalogo_publico/p'].precioUSD,200);
 await window.SVPublicCatalog.syncProduct({...p,catalogoVisible:false},p);assert.equal(writes[2]['sv_catalogo_publico/p'],null);assert.equal(writes[2]['sv_catalogo_publico_index/p'],null);
 window.fbUpdate=async()=>{throw Error('red')};await assert.rejects(window.SVPublicCatalog.syncProduct(p),/red/);
});
test('guardado sincroniza el resultado persistido y distingue fallo de publicación',async()=>{
 const source=require('./helpers/active-app').readActiveApp().source;const start=source.indexOf('function fbGuardarProducto('),end=source.indexOf('\nfunction fechaVentaTimestamp',start);const notices=[],calls=[];
 const c={productoPersistirGuardar:async p=>({...p,fbKey:'nuevo'}),window:{SVPublicCatalog:{syncProduct:async p=>calls.push(p.fbKey)}},notify:m=>notices.push(m),prodData:{},document:{getElementById:()=>null}};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 assert.equal(await c.fbGuardarProducto({nombre:'JBL'}),true);assert.deepEqual(calls,['nuevo']);
 c.window.SVPublicCatalog.syncProduct=async()=>{throw Error('red')};assert.equal(await c.fbGuardarProducto({nombre:'JBL'}),true);assert.match(notices.at(-1),/Producto guardado, pero no se pudo sincronizar/);
});
