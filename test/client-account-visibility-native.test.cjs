'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('../scripts/dev-client-accounts.cjs');
test('native warm visibility keeps exact DOM filters and scroll without business requery',{timeout:30000},async()=>{
 const local=await start();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();
  if(process.env.SV_ACCOUNT_VISIBILITY_RED==='1')await page.route('**/client-account-host.v1.js*',route=>route.fulfill({contentType:'application/javascript',body:require('node:child_process').execFileSync('git',['show','4dbedff3:js/modules/client-account-host.v1.js'],{encoding:'utf8'})}));
  await page.goto(local.url);await page.locator('#cc-tbody tr').nth(49).waitFor();
  const before=await page.evaluate(()=>{window.fixtureRetainedRow=document.querySelector('#cc-tbody tr');document.getElementById('cc-buscador').value='';window.scrollTo(0,180);window.fixtureScroll=document.scrollingElement.scrollTop;return document.getElementById('cc-tbody').innerHTML;});
  const count=local.measures.length;
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(100);
  a.equal(await page.evaluate(()=>document.querySelector('#cc-tbody tr')===fixtureRetainedRow),true,'same row node survives visibility');
  a.equal(await page.locator('#cc-tbody').innerHTML(),before);a.equal(await page.locator('#cc-tbody').evaluate(n=>n.style.visibility),'');
  a.equal(await page.evaluate(()=>SVClientAccountHost.canRetainView('cuentacorriente')),true);
  a.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),await page.evaluate(()=>fixtureScroll));
  a.equal(await page.locator('#cc-buscador').inputValue(),'');
  a.equal(local.measures.slice(count).filter(r=>/\/(?:records|ledgers|byName|pending|totals)\//.test(r.path)).length,0);
 }finally{await browser?.close();await new Promise(resolve=>local.server.close(resolve));}
});
