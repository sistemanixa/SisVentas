'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-reports-local.cjs');
// Existing report harness: real read model/projections/renderers, fictitious SDK
// transport. This is a report surface, not an assertion about full-index boot.
for(const width of [390,1280])test('report retains verified DOM and period across visibility '+width,{timeout:30000},async()=>{
 const local=await start();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:500}});
  await page.route('**/*',route=>route.request().url().startsWith(local.url)?route.continue():route.abort());
  await page.goto(local.url);await page.waitForFunction(()=>SVCommercialReportHost.current('reportes')?.sales.length===55);
  const before=await page.evaluate(()=>{
   window.fixtureHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>fixtureHidden});
   window.savedRow=document.querySelector('#emp-resumen-tbody tr');window.savedPeriod=document.getElementById('rent-periodo');savedPeriod.value='mes_anterior';
   window.savedFocus=document.querySelector('nav button');savedFocus.focus();window.scrollTo(0,100);window.savedScroll=window.scrollY;
   const reads=fixtureCalls.length;fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));
   return {reads,total:document.getElementById('rep-total').textContent,active:fixtureWatches.filter(x=>x.active).length};
  });
  assert.equal(before.active,0);assert.equal(await page.evaluate(()=>SVCommercialReportHost.canRetainView('reportes')),true);
  assert.equal(await page.evaluate(()=>savedRow===document.querySelector('#emp-resumen-tbody tr')),true);
  await page.evaluate(()=>{fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>fixtureWatches.filter(x=>x.active).length===4);
  assert.equal(await page.evaluate(()=>fixtureCalls.length),before.reads,'unchanged markers must not reload totals or sale originals');
  assert.equal(await page.evaluate(()=>savedRow===document.querySelector('#emp-resumen-tbody tr')&&savedFocus===document.activeElement&&savedScroll===window.scrollY),true);
  assert.equal(await page.locator('#rent-periodo').inputValue(),'mes_anterior');
  assert.equal(await page.locator('#rep-total').textContent(),before.total);
  // A changed authorized summary triggers a background read; old DOM survives
  // only while checking, then genuine read model/renderer receive the new value.
  await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));data['sisventas/listados_resumen/gastos'].g.monto=17.25;fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>SVCommercialReportHost.current('reportes')?.expenses[0].monto===17.25);
  assert.ok(await page.evaluate(()=>fixtureCalls.length)>before.reads);
  // Same revision with a revoked permission must not retain the previous view.
  await page.evaluate(()=>{fixtureHidden=true;document.dispatchEvent(new Event('visibilitychange'));window.permisoModulo=()=>false;fixtureHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>SVCommercialReportHost.canRetainView('reportes')),false);
  assert.equal(await page.locator('#emp-resumen-tbody tr').count(),0);
  assert.equal(await page.locator('#rent-periodo').inputValue(),'mes_anterior');
 }finally{await browser?.close();await new Promise(resolve=>local.server.close(resolve));}
});
