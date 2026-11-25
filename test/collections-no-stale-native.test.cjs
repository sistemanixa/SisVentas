'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('../scripts/dev-collections-indexed.cjs');
test('Cobranzas no muestra los cobros de otro filtro durante debounce ni respuesta retrasada',{timeout:30000},async()=>{
 const local=await start();let browser,release;
 try{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width:390,height:900}});await page.goto(local.url);await page.locator('#pagos-tbody tr').nth(49).waitFor();const total=await page.locator('#cob-met-pendiente').textContent();
  let seen;const began=new Promise(r=>seen=r),held=new Promise(r=>release=r);
  await page.route('**/read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path.includes('/search/payments/')){seen();await held;}return route.continue();});
  await page.locator('#cob-buscador').fill('remoto');assert.equal(await page.locator('#pagos-tbody tr').first().isVisible(),false);
  await began;await page.evaluate(()=>SVCollectionsIndexedHost.render());assert.equal(await page.locator('#pagos-tbody tr').first().isVisible(),false);assert.equal(await page.locator('#cob-met-pendiente').textContent(),total);
  release();release=null;await page.locator('[data-payment-key="p0"]').first().waitFor();assert.equal(await page.locator('#pagos-tbody tr').count(),1);assert.equal(local.backend.commits.length,0);
 }finally{release?.();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});
