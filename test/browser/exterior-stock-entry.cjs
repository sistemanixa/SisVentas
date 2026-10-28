'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});
 const reports=[];
 try{
  for(const width of [390,768,1280])for(const stockOnly of [true,false]){
   const page=await browser.newPage({viewport:{width,height:900}});let requests=0;const errors=[];
   await page.route('**/*',r=>{requests++;return r.abort();});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html class="dark-mode"><body><button id="origin">Abrir</button></body>');
   await page.addStyleTag({path:path.join(root,'css/app.css')});
   await page.evaluate(()=>Object.assign(window,{permisoModulo:()=>true,currentUserUid:'fixture',currentUser:'Prueba ficticia',notify:()=>{},fbGet:async()=>{window.__reads++;return {val:()=>({})};},fbRef:()=>'',obtenerDolarReferenciaProducto:()=>({valor:1000}),__saved:[],__confirmed:0,__reads:0}));
   await page.addScriptTag({path:path.join(root,'js/modules/exterior-preparation.js')});
   await page.evaluate(stockOnly=>{
    const catalog=['A','B','C'].map((k,i)=>({key:k,code:'P-'+k,description:'Producto ficticio '+k,providers:[{proveedorKey:'E',nombre:'Exterior ficticio',exterior:true,usd:10*(i+1),activo:true,disponible:true},{proveedorKey:'L',nombre:'Local ficticio',exterior:false,costo:10000*(i+1),activo:true,disponible:true}]}));
    return SVExteriorPreparation.open({stockOnly,customer:stockOnly?'Stock general ficticio':'Venta ficticia',saleId:stockOnly?'ST-FICTICIO':'V-FICTICIA',rates:()=>({usdt:1100}),rows:stockOnly?[]:[{key:'A|0|E',productKey:'A',code:'P-A',description:'Producto de la venta',qty:1,needed:1,baselinePart:10000,providerKey:'E',include:true}],catalog,save:async s=>__saved.push(s),confirm:async()=>__confirmed++});
   },stockOnly);
   const initialReads=await page.evaluate(()=>__reads);const search=()=>page.locator('[data-search]');
   assert.equal(await search().isVisible(),stockOnly);
   if(!stockOnly)await page.locator('[data-add-panel] summary').click();
   if(stockOnly){assert.equal(await page.locator('[data-profit]').getByText(/Ganancia/).count(),0);assert.ok(!(await page.locator('#py-planner').innerText()).toLowerCase().includes('extras'));assert.equal(await search().evaluate(e=>e===document.activeElement),true);}
   for(const [index,k]of ['A','B','C'].entries()){
    await search().fill('Producto ficticio '+k);
    if(index===0)await page.locator('[data-extra-results] [data-add="'+k+'"]').click();
    else if(index===1)await search().press('Enter');
    else{await search().press('ArrowDown');await page.keyboard.press('Enter');}
    assert.equal(await page.locator('[data-card-id^="extra:"]').count(),index+1);
    assert.equal(await search().isVisible(),true);assert.equal(await search().inputValue(),'');assert.equal(await search().evaluate(e=>e===document.activeElement),true);
    await search().press('Enter');assert.equal(await page.locator('[data-card-id^="extra:"]').count(),index+1,'Enter sobre búsqueda vacía no repite alta');
   }
   assert.equal(await page.evaluate(()=>__reads),initialReads);assert.equal(await page.evaluate(()=>__saved.length),0);assert.equal(await page.evaluate(()=>__confirmed),0);
   await page.locator('[data-search-modal]').click();const picker=page.locator('.ep-extra-search'),large=picker.locator('[data-large-search]');
   await large.fill('Producto ficticio B');await large.press('Enter');assert.equal(await picker.count(),1);assert.equal(await large.inputValue(),'');assert.equal(await large.evaluate(e=>e===document.activeElement),true);
   await large.fill('Producto ficticio C');await picker.locator('[data-add="C"]').click();assert.equal(await large.evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('[data-card-id^="extra:"]').count(),5);
   const controls=picker.locator('input,button');await controls.last().focus();await page.keyboard.press('Tab');assert.equal(await controls.first().evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Shift+Tab');assert.equal(await controls.last().evaluate(e=>e===document.activeElement),true);
   await page.keyboard.press('Escape');assert.equal(await picker.count(),0);assert.equal(await search().evaluate(e=>e===document.activeElement),true);
   await page.locator('[data-card-id="extra:0"] [data-field="qty"]').fill('3');await page.locator('[data-card-id="extra:0"] [data-field="providerKey"]').selectOption('L');
   await page.locator('[data-tab="summary"]').click();if(stockOnly){assert.equal(await page.locator('.ep-body').getByText(/Ganancia|Venta sin IVA|Margen proyectado/).count(),0);}
   await page.locator('[data-save]').click();await page.waitForFunction(()=>__saved.length===1);const snapshot=await page.evaluate(()=>__saved[0]);assert.equal(snapshot.extras.length,5);assert.equal(new Set(snapshot.extras.map(r=>r.key)).size,5);assert.equal(Number(snapshot.extras[0].qty),3);assert.equal(snapshot.extras[0].providerKey,'L');assert.ok(snapshot.extras.every(r=>r.destination==='stock'));assert.equal(snapshot.rows.length,stockOnly?0:1);assert.equal(await page.evaluate(()=>__confirmed),0);
   await page.locator('[data-tab="products"]').click();const rect=await page.locator('.ep-modal').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(rect.scroll<=rect.width+1,JSON.stringify(rect));
   if(process.env.STOCK_ENTRY_OUTPUT){fs.mkdirSync(process.env.STOCK_ENTRY_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.STOCK_ENTRY_OUTPUT,(stockOnly?'stock':'sale')+'-'+width+'.png')});}
   await page.locator('[data-close]').click();await page.evaluate(snapshot=>{snapshot.result.orderTotal=123456.78;return SVExteriorPreparation.open({stockOnly:true,closed:true,saved:snapshot,customer:'Compra cerrada ficticia',rows:[],catalog:[],rates:()=>({usdt:1100})});},snapshot);assert.match(await page.locator('[data-profit]').innerText(),/123.456,78/);assert.equal(await page.locator('[data-search]').isDisabled(),true);assert.equal(await page.locator('[data-confirm]').count(),0);assert.deepEqual(errors,[]);assert.equal(requests,0);reports.push({width,mode:stockOnly?'stock':'sale',consecutiveAdds:5,automaticSaves:0,explicitFixtureSaves:1,confirmations:0,readsOnEntry:initialReads,readsOnSelection:0,externalRequests:requests});await page.close();
  }
  console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
