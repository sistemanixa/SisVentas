const {chromium}=require('playwright');const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main id="page-balancecompra"></main><main id="page-relevamientos"></main>');
  await page.evaluate(()=>{
   window.currentRole='admin';window.currentUserUid='u';window.currentUser='Admin';window.permisoModulo=()=>true;window.fbDB={};window.fbRef=(_,path)=>path;
   window.callbacks=new Map();window.stopped=[];window.fbOnValue=(path,fn)=>{callbacks.set(path,fn);return ()=>{stopped.push(path);callbacks.delete(path);};};
   window.emit=(path,value)=>callbacks.get(path)({val:()=>value});window.imagenCatalogoHTML=()=>'<img alt="Producto">';
  });
  await page.addScriptTag({content:fs.readFileSync('js/modules/exterior-user-lists.js','utf8')});
  await page.evaluate(()=>{SVExteriorLists.mount();emit('sisventas/productos',{p:{nombre:'Producto',proveedores:[{url:'https://comprasparaguay.com.ar/item_1/',monedaOriginal:'USD',precioOriginal:10}]}});emit('sv_usuarios',{u:{uid:'u',nombre:'Uno'}});emit('sv_listas_paraguay/u',{l:{nombre:'Lista',productos:{p:2}}});});
  await page.waitForFunction(()=>document.querySelector('[data-results]').textContent.includes('20,00'));
  await page.evaluate(()=>{document.querySelector('[data-group]').open=true;document.querySelector('[data-list]').open=true;emit('sisventas/productos',{p:{nombre:'Actualizado',proveedores:[{url:'https://comprasparaguay.com.ar/item_1/',monedaOriginal:'USD',precioOriginal:15}]}});});
  await page.waitForFunction(()=>document.querySelector('[data-results]').textContent.includes('30,00'));
  assert.equal(await page.locator('[data-list]').evaluate(n=>n.open),true);
  assert.ok((await page.locator('[data-results]').innerText()).includes('Actualizado'));
  await page.evaluate(()=>emit('sv_listas_paraguay/u',{l:{nombre:'Lista',productos:{p:3}}}));
  await page.waitForFunction(()=>document.querySelector('[data-results]').textContent.includes('45,00'));
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:session-ended')));
  assert.equal(await page.evaluate(()=>callbacks.size),0);
  await page.addScriptTag({content:fs.readFileSync('js/modules/surveys.js','utf8')});
  await page.locator('#page-relevamientos').evaluate(n=>n.innerHTML='<button data-list>Guardados</button>');
  await page.click('[data-list]');
  await page.evaluate(()=>emit('sisventas/relevamientos',{r:{id:'r',cliente:'Primero',direccion:'Sitio',services:[],items:{},savedAt:'2026-10-02'}}));
  assert.ok((await page.locator('#page-relevamientos').innerText()).includes('Primero'));
  await page.evaluate(()=>emit('sisventas/relevamientos',{r:{id:'r',cliente:'Cambio externo',direccion:'Sitio',services:[],items:{},savedAt:'2026-10-02'}}));
  assert.ok((await page.locator('#page-relevamientos').innerText()).includes('Cambio externo'));
  await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:page-changed',{detail:{page:'dashboard'}})));
  assert.equal(await page.evaluate(()=>callbacks.size),0);
  assert.deepEqual(errors,[]);console.log('PASS: listas y relevamientos en vivo, conservación de expansión, cierre de sesión y salida del módulo. Datos aislados, sin conexión a Firebase.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
