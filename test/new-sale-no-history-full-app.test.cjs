'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs');
for(const width of [390,1280])test('complete app opens a new sale without sales history at '+width,{timeout:30000},async()=>{
 const local=await start({count:2,startPage:'venta'}),requests=[];let browser;
 try{
  const before=structuredClone(local.backend.state);browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});page.setDefaultTimeout(10000);
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(local.url).origin?route.continue():route.abort());
  page.on('request',request=>{const u=new URL(request.url());let reference='';try{reference=JSON.parse(u.searchParams.get('spec')||'null')?.path||'';}catch(_){}if(/^sisventas\/ventas(?:\/|$)/.test(reference)||/^\/comerciales\/ventas(?:\/|$)/.test(u.pathname))requests.push({method:request.method(),path:u.pathname,reference});});
  await page.goto(local.url);await page.locator('#page-venta.active').waitFor();await page.getByText('Abriendo nueva venta…',{exact:true}).waitFor();
  assert.equal(await page.locator('#vf-numero-preview').inputValue(),'Se asigna al guardar');
  await page.evaluate(()=>{__moduleAuditSourceControl.release('productos');__moduleAuditSourceControl.release('empleados');});
  await page.waitForFunction(()=>SVDataReadiness.statusFor('venta').ready);assert.equal(await page.getByText('Abriendo nueva venta…',{exact:true}).count(),0);
  const history=requests.filter(r=>r.reference||!/\/capacidades$/.test(r.path));assert.deepEqual(history,[]);assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state,before);
  await page.evaluate(()=>{document.documentElement.classList.add('dark-mode');document.body.classList.add('dark-mode');});await page.waitForFunction(()=>{const card=document.querySelector('#page-venta .card'),rgb=card&&getComputedStyle(card).backgroundColor.match(/[\d.]+/g);return rgb&&rgb.slice(0,3).every(n=>Number(n)<100);});await page.screenshot({path:'C:/SisVentas/tmp/new-sale-no-history-'+width+'.private.png'});
 }finally{await browser?.close();local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}
});
