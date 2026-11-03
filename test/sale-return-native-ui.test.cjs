'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/sale-return-local.cjs');
for(const width of [390,1280])for(const blocked of [false,true])test('native return button '+width+' / '+(blocked?'linked payment blocks':'commits once'),async()=>{
 const local=await start({blocked});let browser;try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:850}}),external=[],errors=[];
  await page.route('**/*',route=>route.request().url().startsWith(local.url)?route.continue():(external.push(route.request().url()),route.abort()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(local.url);await page.getByRole('button',{name:'A presupuesto',exact:true}).click();await page.waitForFunction(()=>document.getElementById('result').textContent.length>0);
  if(blocked){assert.match(await page.locator('#result').innerText(),/tiene cobros/);assert.equal(local.backend.get('sisventas/ventas/s').total,100);assert.equal(local.backend.get('sisventas/presupuestos/desde_venta_s'),null);assert.equal(local.backend.commits.length,0);}
  else{assert.match(await page.locator('#result').innerText(),/creado/);assert.equal(await page.locator('#destination').innerText(),'presupuesto');assert.equal(local.backend.get('sisventas/ventas/s'),null);assert.equal(local.backend.get('sisventas/presupuestos/desde_venta_s/items')[0].costoUnitarioCompra,20);assert.equal(local.backend.commits.length,1);await page.getByRole('button',{name:'A presupuesto',exact:true}).click();await page.getByRole('alert').filter({hasText:'ya no está disponible'}).waitFor();assert.equal(local.backend.commits.length,1);}
  assert.equal(await page.locator('#activity').innerText(),'');assert.deepEqual(local.backend.get('sisventas/sentinel'),{stock:37,commission:50});assert(!local.calls.some(c=>c[1]==='sisventas/presupuestos/desde_venta_s'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>local.server.close(resolve));}
});
