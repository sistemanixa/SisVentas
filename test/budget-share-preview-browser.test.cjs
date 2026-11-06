'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {render}=require('./helpers/budget-print-fixture.cjs');
const chrome=process.env.SV_TEST_CHROME||process.env.SV_CHROME_PATH;
for(const width of [390,1280])test('budget preview remains usable around pending/cancelled sharing '+width,{skip:!chrome},async t=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:chrome});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width,height:900}}),{html}=await render({image:true,many:7});
 let external=0;await page.route('**/*',r=>{external++;return r.abort();});
 await page.setContent(html.replace(/<script src="[^"]+"><\/script>/g,''));
 await page.evaluate(()=>{
  window.html2pdf=()=>{};window.SVPrintLayout={ready:async()=>{},pdf:async()=>new Blob(['fictitious PDF'],{type:'application/pdf'})};
  window.shareCount=0;Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:()=>{shareCount++;return new Promise((res,rej)=>{window.finishShare=res;window.cancelShare=()=>rej(new DOMException('Cancelled','AbortError'));});}});
 });
 await page.getByRole('button',{name:/Compartir PDF$/}).click();
 await page.waitForFunction(()=>window.shareCount===1);
 assert.equal(await page.locator('#presupuesto-pdf-captura-host').count(),0);
 assert.equal(await page.locator('#presupuesto-pdf').count(),1);
 assert.equal(await page.getByRole('button',{name:/Descargar PDF$/}).isEnabled(),true);
 await page.evaluate(()=>cancelShare());await page.waitForFunction(()=>!document.querySelector('[onclick*="compartir"]').disabled);
 await page.getByRole('button',{name:/Compartir PDF$/}).click();await page.waitForFunction(()=>shareCount===2);
 assert.equal(await page.locator('#presupuesto-pdf-captura-host').count(),0);
 await page.evaluate(()=>finishShare());await page.waitForFunction(()=>!document.querySelector('[onclick*="compartir"]').disabled);
 assert.equal(external,0);
});
