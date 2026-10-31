const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const source=fs.readFileSync('js/modules/exterior-preparation.js','utf8');
const sheetStyle=source.match(/host.innerHTML='<style>(.*?)<\/style>';/)[1];
for(const width of [390,1280])test('rueda atraviesa tarjetas internas sin mover el fondo '+width,async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const p=await browser.newPage({viewport:{width,height:800}});await p.route('**/*',r=>r.abort());
 const baseline='body{margin:0;height:3000px;overflow:hidden}.sheet{position:fixed;inset:0;overflow:auto;padding:20px}.card{overflow-x:auto;overflow-y:visible;height:350px;margin:20px 0;background:#123;color:white}[role=dialog],[role=dialog] *{overscroll-behavior:contain}';
 const markup='<section class="sheet" role="dialog" aria-label="Ficha del producto de la compra">'+Array.from({length:6},(_,i)=>'<article class="card"><div style="height:200px">Producto '+i+'</div></article>').join('')+'</section>';
 await p.setContent('<style>'+baseline+'</style>'+markup);await p.mouse.move(150,150);await p.mouse.wheel(0,400);await p.waitForTimeout(250);assert.equal(await p.locator('.sheet').evaluate(e=>e.scrollTop),0,'reproduce bloqueo anterior');
 await p.addStyleTag({content:sheetStyle});await p.mouse.wheel(0,400);await p.waitForTimeout(250);assert.ok(await p.locator('.sheet').evaluate(e=>e.scrollTop)>100);assert.equal(await p.evaluate(()=>scrollY),0);assert.equal(await p.locator('.sheet').evaluate(e=>getComputedStyle(e).overscrollBehavior),'contain');
 }finally{await browser.close()}
});
