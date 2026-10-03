const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 try{
  const pages=[],errors=[];
  for(const uid of ['a','b']){
   const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>r.abort());
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<body></body>');
   await page.evaluate(uid=>{
    window.currentUserUid=uid;window.currentUser=uid;window.currentRole='compras_paraguay';window.fbDB={};
    window.callbacks=new Map();window.fbRef=(_,p)=>p;window.fbQuery=p=>p;window.fbOrderByChild=()=>{};window.fbEqualTo=()=>{};
    window.records={};window.commits=0;
    window.read=p=>records[p]??records[p.slice(0,p.lastIndexOf('/'))]?.[p.slice(p.lastIndexOf('/')+1)]??null;
    window.fbGet=async p=>({val:()=>p.startsWith('sv_chat_roles/')?{rol:'compras_paraguay',activo:true}:read(p)});
    window.fbServerTimestamp=()=>1234;
    window.fbRunTransaction=async(path,fn)=>{const next=fn(read(path));if(next===undefined)return {committed:false};commits++;records[path]=next;return {committed:true,snapshot:{val:()=>next}};};
    window.fbOnValue=(path,fn)=>{callbacks.set(path,fn);return()=>callbacks.delete(path);};
    window.emit=(path,value)=>{records[path]=value;callbacks.get(path)?.({val:()=>value});};
    window.imagenCatalogoHTML=()=>'<img alt="Producto">';window.doLogout=()=>{};
    window.obtenerDolarReferenciaProducto=()=>({valor:window.TIPO_CAMBIO_CONFIG?.oficial,tipo:'oficial'});
   },uid);
   await page.addScriptTag({content:fs.readFileSync('js/core/guarded-writes.js','utf8')});
   await page.addScriptTag({content:fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8')});
   await page.evaluate(()=>SVParaguayPortal.open('Usuario'));
  }
  await pages[0].exposeFunction('publish',async(path,value)=>{for(const p of pages)await p.evaluate(({path,value})=>emit(path,value),{path,value});});
  const product={codigo:'P-1',nombre:'Monopatín',categoria:'COMPRAS PARAGUAY',iva:0,ventaARS:200000,proveedores:[{url:'https://comprasparaguay.com.ar/item_1/',monedaOriginal:'USD',precioOriginal:100,precio:100000}]};
  await pages[0].evaluate(async p=>{await publish('sisventas/config/tipoCambio',{oficial:1000});await publish('sisventas/productos',{p});},product);
  const b=pages[1];await b.locator('[data-add="p"]').click();await b.locator('[data-detail="p"]').click();
  assert.match(await b.locator('[data-detail-price]').innerText(),/200,00/);
  await pages[0].evaluate(p=>publish('sisventas/productos',{p}),{...product,nombre:'Monopatín actualizado',ventaARS:250000});
  assert.match(await b.locator('[data-detail-price]').innerText(),/250,00/);
  assert.match(await b.locator('.catalogo-modal-info h2').innerText(),/actualizado/);
  assert.match(await b.locator('[data-cart-amount]').innerText(),/250,00/);
  await pages[0].evaluate(()=>publish('sisventas/config/tipoCambio',{oficial:1250}));
  assert.match(await b.locator('[data-detail-price]').innerText(),/200,00/);
  assert.match(await b.locator('[data-cart-amount]').innerText(),/200,00/);
  await b.locator('[data-close-detail]').click();await b.locator('[data-cart]').click();
  assert.match(await b.locator('[data-cart-items]').innerText(),/Monopatín actualizado/);
  await pages[0].evaluate(()=>publish('sv_listas_paraguay/b',{l:{nombre:'Lista inicial',productos:{p:1}}}));
  await b.locator('[data-lists]').selectOption('l');await b.locator('[data-name]').fill('Cambio local');
  await pages[0].evaluate(()=>publish('sv_listas_paraguay/b',{l:{nombre:'Cambio remoto',productos:{p:2}}}));
  await b.locator('[data-save]').click();await b.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('otro equipo'));
  assert.equal(await b.evaluate(()=>commits),0);assert.equal(await b.locator('[data-name]').inputValue(),'Cambio local');
  await b.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:session-ended')));
  assert.equal(await b.evaluate(()=>callbacks.size),0);assert.deepEqual(errors,[]);
  console.log('PASS: dos contextos aislados; precio y cambio publicados por A actualizan catálogo, detalle abierto y carrito de B; listas rechazan guardados obsoletos sin perder el formulario; cierre elimina listeners. Transporte simulado, sin Firebase real.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
