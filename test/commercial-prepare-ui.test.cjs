'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-prepare-demo.cjs');
for(const width of [390,768,1280])test('preparación local '+width+': lectura directa, denegación y legado sin red exterior',async()=>{
 const demo=await start();let browser;
 try{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900}}),external=[],errors=[];page.on('request',r=>{if(!r.url().startsWith(demo.url))external.push(r.url());});page.on('pageerror',e=>errors.push(e.message));await page.goto(demo.url);
 const button=page.getByRole('button',{name:'Preparar documento',exact:true});await button.click();await page.getByRole('status').filter({hasText:'Documento listo'}).waitFor();assert.equal(await page.locator('#reads').innerText(),'1');assert.equal(await page.locator('#api').innerText(),'0');
 await page.locator('#mode').selectOption('denied');await button.click();await page.getByRole('status').filter({hasText:'No tenés permiso'}).waitFor();assert.equal(await page.locator('#api').innerText(),'0');
 await page.locator('#mode').selectOption('legacy');await button.click();await page.getByRole('status').filter({hasText:'Documento listo'}).waitFor();assert.equal(await page.locator('#reads').innerText(),'0');assert.equal(await page.locator('#api').innerText(),'1');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>demo.server.close(r));}
});
