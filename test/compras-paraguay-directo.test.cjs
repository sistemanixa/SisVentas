const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/modules/product-url-import.js','utf8');
const code=source.slice(source.indexOf('  function esComprasParaguay'),source.indexOf('  function prepararComprasParaguay'));
const url='https://www.comprasparaguai.com.br/producto__5140343/';
const base={url:'/producto__5140343/',nome:'Patinete',marca:'Interbras',loja:{nome:'Midi Pro'},ocultar_preco:false,disponivel:true,preco_dolar:420,preco_peso:999,produtos_relacionados:[{preco_dolar:1}]};
function setup(data=base,valor=1545){let calls=[];const c=vm.createContext({URL,obtenerDolarReferenciaProducto:()=>({valor,tipo:'oficial'}),fetch:async(u,o)=>{calls.push({u,o});return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>data};}});vm.runInContext(code,c);return {calls,run:(u=url,p={web:'https://www.comprasparaguai.com.br'})=>c.consultarComprasParaguayDirecto(u,p)};}
test('lectura directa sin credenciales, usa USD exacto y dólar SisVentas',async()=>{const c=setup(),r=await c.run();assert.equal(r.precioArs,648900);assert.equal(r.precioOriginal,420);assert.equal(c.calls[0].u,'https://api.comprasparaguai.com.br/producto__5140343/');assert.equal(c.calls[0].o.credentials,'omit');assert.equal(c.calls[0].o.headers.Authorization,undefined);assert.equal(c.calls[0].o.redirect,'error');});
test('rechaza identidad diferente y precio oculto o inválido',async()=>{for(const patch of [{url:'/otro__12/'},{ocultar_preco:true},{preco_dolar:0},{preco_dolar:'420'},{loja:null}])await assert.rejects(setup({...base,...patch}).run());});
test('no consulta hosts falsos, proveedores distintos ni enlaces de búsqueda',async()=>{for(const [u,p] of [[url,{web:'https://flytec.com.py'}],[url+'?buscar=1'],['https://comprasparaguai.com.br.evil.test/producto__5140343/']]){const c=setup();await assert.rejects(c.run(u,p));assert.equal(c.calls.length,0);}});
test('sin stock y dólar inválido',async()=>{assert.equal((await setup({...base,disponivel:false}).run()).disponibilidadProveedor,'sin_stock');await assert.rejects(setup(base,0).run());});
test('URL argentina de modelo consulta la oferta menor y verifica la ficha de la tienda',async()=>{
 const ar='https://comprasparaguay.com.ar/parlante-jbl_62935/',calls=[];
 const model={url:'/caixa-jbl_62935/',nome:'JBL Encore',marca:'JBL',ocultar_preco:false,imagem_principal_url:'https://example.test/jbl.webp',produtos:[{url:'/caro__10/',preco_dolar:200,ocultar_preco:false,loja:{nome:'Otra'}},{url:'/barato__11/',preco_dolar:172,ocultar_preco:false,loja:{nome:'Toku'}},{url:'/oculto__12/',preco_dolar:1,ocultar_preco:true,loja:{nome:'Oculta'}}]};
 const c=vm.createContext({URL,obtenerDolarReferenciaProducto:()=>({valor:1545,tipo:'oficial'}),fetch:async u=>{calls.push(u);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>calls.length===1?model:{...base,url:'/barato__11/',preco_dolar:172,loja:{nome:'Toku'}}};}});
 vm.runInContext(code,c);const r=await c.consultarComprasParaguayDirecto(ar,{web:'https://www.comprasparaguai.com.br'});
 assert.equal(calls.length,2);assert.equal(calls[1],'https://api.comprasparaguai.com.br/barato__11/');assert.equal(r.precioOriginal,172);assert.equal(r.precioArs,265740);assert.equal(r.ficha.imagenUrl,model.imagem_principal_url);assert.equal(r.url,ar);assert.equal(r.tiendaOrigen,'Toku');
});
test('un ID de modelo distinto o una oferta externa no se importan',async()=>{
 const ar='https://comprasparaguay.com.ar/jbl_62935/';
 for(const model of [{url:'/jbl_999/',produtos:[]},{url:'/jbl_62935/',ocultar_preco:false,produtos:[{url:'https://evil.test/a__1/',preco_dolar:10,ocultar_preco:false,loja:{nome:'X'}}]}])await assert.rejects(setup(model).run(ar));
});
