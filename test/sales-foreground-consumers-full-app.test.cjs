'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs');
for(const width of [390,1280])test('complete app does not refresh inherited sales on catalog tools at '+width,{timeout:45000},async()=>{
 const local=await start({count:4});let browser;
 try{
  const before=structuredClone(local.backend.state);browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});page.setDefaultTimeout(10000);
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(local.url).origin?r.continue():r.abort());
  await page.goto(local.url);await page.locator('#ventas-tbody tr').nth(3).waitFor();
  await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');showPage('productos');});
  await page.waitForFunction(()=>SVCommercialOwnership.cachedRecords('ventas')!==null&&SVDataReadiness.statusFor('productos').ready);
  assert.equal(local.measures.filter(x=>x.path==='/comerciales/ventas').length,1,'product ranking legitimately loads the complete authorized history once');
  await page.evaluate(()=>showPage('actualizadorprecios'));await page.locator('#page-actualizadorprecios.active').waitFor();
  await page.evaluate(()=>{for(let i=0;i<3;i++)document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>SVDataReadiness.statusFor('actualizadorprecios').ready);
  await page.waitForTimeout(150);
  assert.equal(local.measures.filter(x=>x.path==='/comerciales/ventas').length,1,'price updater must not re-download sales on focus');
  await page.evaluate(()=>showPage('kits'));await page.locator('#page-kits.active').waitFor();
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(150);
  assert.equal(local.measures.filter(x=>x.path==='/comerciales/ventas').length,1,'kits must not re-download sales on focus');
  const returned=page.waitForResponse(r=>new URL(r.url()).pathname==='/comerciales/ventas'&&r.ok());await page.evaluate(()=>showPage('facturas'));await returned;
  await page.waitForFunction(()=>SVCommercialOwnership.cachedRecords('ventas')!==null);
  assert.equal(local.measures.filter(x=>x.path==='/comerciales/ventas').length,2,'returning to a real consumer must authorize and refresh its original history');
  assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state,before);
 }finally{await browser?.close();local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}
});
