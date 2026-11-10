'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
for(const width of [390,768,1280])test('Stock controls retain sorted positive rows, pagination and linked navigation '+width,{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width,height:900}});let unexpected=0;
  await page.route('**/*',route=>route.request().url()==='http://127.0.0.1/stock-controls'?route.fulfill({contentType:'text/html',body:'<html><body style="margin:12px;background:#101b2d;color:white"><main id="host"></main></body></html>'}):(unexpected++,route.abort()));
  await page.goto('http://127.0.0.1/stock-controls');await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../css/office-stock.css'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/modules/office-stock.js'),'utf8')});
  await page.evaluate(()=>{window.calls={list:0,writes:0,opened:[]};const row=(key,n)=>({key,productKey:key,name:'Ficticio '+key,code:key,unitLabel:'unidades',inventory:{general:n}});SVOfficeStock.mount(document.getElementById('host'),{session:()=>({uid:'fake',revision:1,active:true,allowed:true,role:'admin'}),adapter:{list:async({cursor})=>{calls.list++;return cursor?{rows:[row('D',30)],cursor:null}:{rows:[row('A',2),row('B',12),row('C',0)],cursor:'next'};},provenance:async()=>({purchases:[{key:'fake-order',number:'OC-FICTICIA',receipts:[]}],adjustments:[]}),openPurchase:async key=>calls.opened.push(key),save:async()=>{calls.writes++;throw Error('No writes');}}});});
  await page.waitForFunction(()=>document.querySelectorAll('article').length===2);
  assert.match(await page.locator('article').first().innerText(),/Ficticio B/);
  const header=await page.locator('.office-stock header').boundingBox(),search=await page.locator('[data-search]').boundingBox();assert.ok(search.y-header.y-header.height>=10);
  assert.equal(await page.getByRole('button',{name:'Agregar stock',exact:true}).innerText(),'');
  await page.getByRole('button',{name:'Ver más',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length===3);assert.match(await page.locator('article').first().innerText(),/Ficticio D/);
  await page.getByRole('button',{name:'Filtros y orden',exact:true}).click();await page.getByLabel('Ordenar productos cargados',{exact:true}).selectOption('quantity-asc');assert.match(await page.locator('article').first().innerText(),/Ficticio A/);
  await page.getByLabel('Buscar producto',{exact:true}).fill('B');assert.equal(await page.locator('article').count(),1);assert.equal(await page.evaluate(()=>calls.list),2);
  await page.getByRole('button',{name:'Ver compras y ajustes de Ficticio B',exact:true}).click();await page.getByRole('link',{name:'OC-FICTICIA'}).click();assert.deepEqual(await page.evaluate(()=>calls.opened),['fake-order']);assert.equal(await page.locator('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.evaluate(()=>calls.writes),0);assert.equal(unexpected,0);
 }finally{await browser.close();}
});
