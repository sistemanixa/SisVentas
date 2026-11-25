'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {readActiveApp}=require('./helpers/active-app');let chromium;try{chromium=require('playwright').chromium;}catch{}
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const remote='https://firebasestorage.googleapis.com/v0/b/nixa-sisventas.firebasestorage.app/o/productos%2Fsynthetic.png?alt=media&token=synthetic-test-capability';
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});
test('la impresión real integra imagen Firebase con CORS, evita el proxy y no escribe ni consulta RTDB',{skip:!chromium,timeout:30000},async()=>{
 let mediaCors=true,mediaReads=0,proxyReads=0,foreign=0;const source=readActiveApp().source,start=source.indexOf('  function urlImagenCapturablePresupuesto(src)'),end=source.indexOf('\n  var items = (await Promise.all(',start);assert(start>0&&end>start);
 const original=source.slice(start,end),anchor='if (parsed.origin === location.origin) return parsed.href;';assert(original.includes(anchor));
 const patched=original.includes('window.SVProductMediaSource?.direct')?original:original.replace(anchor,anchor+'\n      var imagenFirebase = window.SVProductMediaSource?.direct(parsed.href);\n      if (imagenFirebase) return imagenFirebase;');
 const app=http.createServer((req,res)=>{if(req.url.startsWith('/imagen-producto')){proxyReads++;return res.writeHead(400,{'Content-Type':'application/json'}).end('{"error":"Firebase is not an allowed provider proxy host"}');}res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta charset=utf-8><div id="result"></div>');});
 const origin=await listen(app),media=http.createServer((req,res)=>{mediaReads++;res.writeHead(200,{'Content-Type':'image/png',...(mediaCors?{'Access-Control-Allow-Origin':'*'}:{})});res.end(image);}),mediaOrigin=await listen(media);
 let browser;const diagnostics=[];try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage();page.on('console',m=>diagnostics.push(m.text()));page.on('requestfailed',r=>diagnostics.push(r.failure()?.errorText));
  await page.route('**/*',async route=>{const url=route.request().url();if(url.startsWith(origin)||url.startsWith(mediaOrigin))return route.continue();if(url===remote)return route.fulfill({status:302,headers:{location:mediaOrigin+'/image.png','Access-Control-Allow-Origin':origin}});foreign++;return route.abort();});
  await page.goto(origin);await page.addScriptTag({content:'window.SISVENTAS_FUNCTIONS={cotizadorProveedor:'+JSON.stringify(origin)+',frontendKey:"synthetic"};'+original+';window.embedOriginal=imagenEmbebidaPresupuesto;'});
  assert.equal(await page.evaluate(src=>window.embedOriginal(src),remote),'');assert.equal(proxyReads,1);assert.equal(mediaReads,0);
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/core/product-media-source.v1.js'),'utf8')});await page.addScriptTag({content:patched});
  const result=await page.evaluate(src=>imagenEmbebidaPresupuesto(src),remote);assert.match(result,/^data:image\/png;base64,/,JSON.stringify({diagnostics,mediaReads,proxyReads}));assert.equal(proxyReads,1);assert.equal(mediaReads,1);
  mediaCors=false;assert.equal(await page.evaluate(src=>imagenEmbebidaPresupuesto(src),remote),'');assert.equal(proxyReads,1);assert.equal(mediaReads,2);assert.equal(foreign,0);
 }finally{await browser?.close();await close(media);await close(app);}
});
