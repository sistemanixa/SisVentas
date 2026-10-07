const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});await page.setContent('<body class="dark-mode"></body>');await page.addStyleTag({path:'css/app.css'});
 await page.evaluate(()=>{
 const products={a:{codigo:'P-1',nombre:'Monopatín eléctrico de prueba con nombre largo',categoria:'COMPRAS PARAGUAY',compra:100,venta:200,compraUSD:420},b:{codigo:'P-2',nombre:'Otro producto',categoria:'COMPRAS PARAGUAY',compra:50,venta:80}};
 window.saved={};window.failSave=false;
 Object.assign(window,{currentRole:'compras_paraguay',currentUserUid:'test',fbDB:{},fbRef:(_,p)=>p,fbQuery:p=>p,fbOrderByChild:()=>{},fbEqualTo:()=>{},fbPush:()=>({key:'list1'}),fbServerTimestamp:()=>123,
 fbGet:async p=>({val:()=>p.startsWith('sv_chat_roles')?{rol:'compras_paraguay',activo:true}:saved[p]}),fbSet:async(p,v)=>{if(failSave)throw Error('Prueba sin conexión');saved[p]=v},fbOnValue:(p,fn)=>{fn({val:()=>p==='sisventas/productos'?products:p.startsWith('sv_chat_roles')?{rol:'compras_paraguay',activo:true}:{}});return()=>{}},imagenCatalogoHTML:()=>'',obtenerDolarReferenciaProducto:()=>({valor:1000}),SVGuardedWrites:{save:async(p,b,d)=>{saved[p]=d;return d}}});
 });
 await page.addScriptTag({path:'js/modules/paraguay-shopping-access.js'});await page.evaluate(()=>SVParaguayPortal.open('Prueba'));
 await page.locator('[data-add="a"]').click();await page.locator('[data-cart]').click();await page.locator('[data-name]').fill('Viaje');
 await page.evaluate(()=>failSave=true);await page.locator('[data-save]').click();assert.equal(await page.locator('[data-cart-count]').innerText(),'1');await page.evaluate(()=>failSave=false);
 await page.locator('[data-save]').click();assert.equal(await page.locator('[data-cart-count]').innerText(),'0');assert.equal(await page.locator('[data-cart-items] tbody tr').count(),1);
 await page.locator('[data-add-products]').click();await page.locator('[data-add="b"]').click();await page.locator('[data-cart]').click();assert.equal(await page.locator('[data-cart-items] tbody tr').count(),2);await page.locator('[data-add-products]').click();await page.locator('[data-confirm-products]').click();assert.deepEqual(await page.evaluate(()=>saved['sv_listas_paraguay/test/list1'].productos),{a:1,b:1});
 assert.equal(await page.locator('[data-purchase="cantidad"][data-key="a"]').inputValue(),'1');
 assert.equal(await page.getByRole('columnheader',{name:'Cantidad comprada',exact:true}).count(),1);
 await page.locator('[data-purchase="precioUnitario"][data-key="a"]').fill('400');
 assert.match(await page.locator('[data-purchase-saving]').first().innerText(),/20,00 por unidad/);
 assert.equal(await page.locator('[data-purchase="cantidad"][data-key="a"]').inputValue(),'1');
 assert.equal(await page.locator('[data-purchase="estado"][data-key="a"]').inputValue(),'comprado');
 assert.equal(await page.locator('[data-purchase="estado"][data-key="a"]').isVisible(),false);
 await page.locator('[data-save]').click();assert.equal(await page.evaluate(()=>saved['sv_listas_paraguay/test/list1'].comprasFinales.a.estado),'comprado');
 assert.equal(await page.locator('[data-purchase="precioUnitario"][data-key="a"]').isDisabled(),true);
 await page.locator('[data-edit-purchase="a"]').click();await page.locator('[data-purchase="precioUnitario"][data-key="a"]').fill('395');await page.locator('[data-save]').click();
 assert.equal(await page.evaluate(()=>saved['sv_listas_paraguay/test/list1'].comprasFinales.a.precioUnitario),395);
 for(const width of [1560,1024,768,390]){await page.setViewportSize({width,height:900});const size=await page.locator('#screen-paraguay .content').evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify({width,...size}));const boxes=await page.locator('[data-cart-items] input').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));assert.ok(boxes.every(h=>h>=44));}
 await page.setViewportSize({width:1024,height:900});await page.screenshot({path:'tmp/shopping-tablet.png',fullPage:true});
 await page.locator('[data-cart]').click();assert.equal(await page.locator('[data-cart-items] tbody tr').count(),0);await page.locator('[data-lists]').selectOption('list1');assert.equal(await page.locator('[data-cart-items] tbody tr').count(),2);
 console.log('OK: guardar con error conserva carrito; guardar vacía carrito y conserva lista; agregar a lista y volver; sin desborde en 1560/1024/768/390, campos táctiles.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
