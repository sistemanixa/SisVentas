'use strict';
// Independent browser races with synthetic responses only. No budget/API or
// authentication request leaves the fixture origin; fetch is replaced in-page.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),ROOT=path.resolve(__dirname,'../..'),ORIGIN='http://127.0.0.1:8891';
(async()=>{
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html><body><div id="share"></div></body></html>');});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8891,'127.0.0.1',resolve);});
 let browser;const results=[];
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  async function setup({headers='ready',throws=false}={}){
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===ORIGIN?route.continue():route.abort());
   await page.goto(ORIGIN+'/fictitious-races');
   await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'js/vendor/qrcodegen.js'),'utf8')});
   await page.evaluate(({origin,headers,throws})=>{
    window.fixture={headersMode:headers,loadingThrows:throws,headers:[],fetches:[],loads:0,releases:0,clipboard:[],clock:Date.now(),ctx:{allowed:true,uid:'fictitious-admin',role:'admin',epoch:1}};
    Date.now=()=>fixture.clock;
    window.SISVENTAS_PROPOSAL_SHARE_API=origin;
    window.SVServiceAuth={headers:extra=>fixture.headersMode==='deferred'?new Promise(resolve=>fixture.headers.push(()=>resolve({...extra,Authorization:'Bearer FICTION.ONLY.TOKEN'}))):Promise.resolve({...extra,Authorization:'Bearer FICTION.ONLY.TOKEN'})};
    window.fetch=(url,options)=>new Promise((resolve,reject)=>{fixture.fetches.push({url,options,body:JSON.parse(options.body),resolve,reject});});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{fixture.clipboard.push(value);}}});
    fixture.token=n=>btoa(String.fromCharCode(...Array(32).fill(n))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    fixture.resolve=(index,n=index+1)=>{const request=fixture.fetches[index];request.resolve(new Response(JSON.stringify({ok:true,schema:1,token:fixture.token(n),expiresAt:fixture.clock+86400000,viewerBase:origin+'/propuestas-compartidas.html'}),{status:200,headers:{'Content-Type':'application/json'}}));};
    fixture.mount=key=>SVProposalShare.mount({budgetKeys:[key],context:()=>fixture.ctx,rate:()=>({exchangeRate:1500,exchangeLabel:'Blue'}),loading:()=>{fixture.loads++;if(fixture.loadingThrows)throw Error('Fictitious loader failure');return()=>fixture.releases++;}},document.getElementById('share'));
   },{origin:ORIGIN,headers,throws});
   await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'js/modules/proposal-share.js'),'utf8')});
   return {context,page,errors};
  }
  async function tick(page){await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,20)));}
  async function run(name,fn,options){const f=await setup(options);try{await fn(f);assert.deepEqual(f.errors,[],name+' must not cause uncaught errors');results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.stack||error.message});}finally{await f.context.close();}}
  await run('clear while headers pending with identical context retires request and host',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await page.waitForFunction(()=>fixture.headers.length===1);
   await page.evaluate(()=>{SVProposalShare.clear();fixture.headers.splice(0).forEach(resolve=>resolve());});await tick(page);
   assert.equal(await page.locator('#share > *').count(),0);assert.equal(await page.evaluate(()=>fixture.fetches.length),0);assert.equal(await page.evaluate(()=>fixture.releases),1);
  },{headers:'deferred'});
  await run('clear while response pending with identical context cannot repaint late QR',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await page.waitForFunction(()=>fixture.fetches.length===1);
   await page.evaluate(()=>{SVProposalShare.clear();fixture.resolve(0);});await tick(page);
   assert.equal(await page.locator('#share > *').count(),0);assert.equal(await page.locator('#share svg').count(),0);assert.equal(await page.evaluate(()=>fixture.releases),1);
  });
  await run('same host remount B then late A retains only selected B QR',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await page.waitForFunction(()=>fixture.fetches.length===1);
   await page.evaluate(()=>fixture.mount('proposal-B'));await page.waitForFunction(()=>fixture.fetches.length===2);
   await page.evaluate(()=>fixture.resolve(1,2));await page.locator('#share svg').waitFor();const selected=await page.locator('#share a').getAttribute('href');assert.ok(selected.endsWith('#'+await page.evaluate(()=>fixture.token(2))));
   await page.evaluate(()=>fixture.resolve(0,1));await tick(page);assert.equal(await page.locator('#share a').getAttribute('href'),selected);assert.equal(await page.locator('#share svg').count(),1);
  });
  await run('expired cache replacement obtains a fresh capability for the same selection',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await page.waitForFunction(()=>fixture.fetches.length===1);await page.evaluate(()=>fixture.resolve(0,1));await page.locator('#share svg').waitFor();
   await page.evaluate(()=>{fixture.clock+=86400001;fixture.mount('proposal-A');});await page.waitForFunction(()=>fixture.fetches.length===2);await page.evaluate(()=>fixture.resolve(1,2));await page.locator('#share svg').waitFor();assert.ok((await page.locator('#share a').getAttribute('href')).endsWith('#'+await page.evaluate(()=>fixture.token(2))));
  });
  await run('loader failure exits loading and leaves manual retry available',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await tick(page);const retry=page.getByRole('button',{name:'Reintentar QR',exact:true});await retry.waitFor({timeout:1500});assert.equal(await page.locator('#share').getAttribute('aria-busy'),'false');assert.equal(await page.evaluate(()=>fixture.fetches.length),0);
   await page.evaluate(()=>{fixture.loadingThrows=false;});await retry.click();await page.waitForFunction(()=>fixture.fetches.length===1);await page.evaluate(()=>fixture.resolve(0));await page.locator('#share svg').waitFor();assert.equal(await page.evaluate(()=>fixture.releases),1);
  },{throws:true});
  await run('QR has no copy action and expired open is prevented',async({page})=>{
   await page.evaluate(()=>fixture.mount('proposal-A'));await page.waitForFunction(()=>fixture.fetches.length===1);await page.evaluate(()=>fixture.resolve(0));await page.locator('#share svg').waitFor();
   assert.equal(await page.getByRole('button',{name:'Copiar',exact:true}).count(),0);assert.doesNotMatch(await page.locator('#share').innerText(),/Sólo esta PC|red local|Abrir en tablets/);await page.evaluate(()=>{fixture.clock+=86400001;});assert.equal(await page.getByRole('link',{name:'Abrir',exact:true}).evaluate(link=>{const event=new MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);return event.defaultPrevented;}),true);await tick(page);assert.deepEqual(await page.evaluate(()=>fixture.clipboard),[]);assert.match(await page.locator('#share').innerText(),/venci|renov|Generar|Reintentar/i);
  });
  await run('production-length HTTPS QR decodes from the actual 160 CSS pixel screenshot',async({page})=>{
   const productionOrigin='https://propuestas-qr-171899432710.southamerica-east1.run.app';
   for(const name of ['css/app.css','css/proposal-share.css'])await page.addStyleTag({content:fs.readFileSync(path.join(ROOT,name),'utf8')});
   await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'js/vendor/zxing/zxing-browser-0.1.5.min.js'),'utf8')});
   await page.evaluate(origin=>{SISVENTAS_PROPOSAL_SHARE_API=origin;fixture.mount('proposal-production-length');},productionOrigin);await page.waitForFunction(()=>fixture.fetches.length===1);
   const expected=await page.evaluate(origin=>{const token=fixture.token(13);fixture.fetches[0].resolve(new Response(JSON.stringify({ok:true,schema:1,token,expiresAt:fixture.clock+86400000,viewerBase:origin+'/propuestas-compartidas.html'}),{status:200,headers:{'Content-Type':'application/json'}}));return origin+'/propuestas-compartidas.html#'+token;},productionOrigin);
   const qr=page.locator('#share .sv-share-qr');await qr.locator('svg').waitFor();assert.equal(await page.locator('#share a').getAttribute('href'),expected);const box=await qr.boundingBox();assert.equal(Math.round(box.width),160,'fixture must test the actual 160 CSS px inline QR');
   const png=await qr.screenshot({type:'png',scale:'css'});const screenshot=path.join(require('node:os').tmpdir(),'sisventas-qr-160-'+process.pid+'.png');fs.writeFileSync(screenshot,png);
   const decoded=await page.evaluate(async dataURL=>{const image=new Image();image.src=dataURL;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);const result=await new ZXingBrowser.BrowserQRCodeReader().decodeFromCanvas(canvas);return {text:result.getText(),width:image.naturalWidth,height:image.naturalHeight};},'data:image/png;base64,'+png.toString('base64'));
   assert.equal(decoded.width,160);assert.equal(decoded.height,160);assert.equal(decoded.text,expected,'ZXing must decode the screenshot without upscaling the source SVG');
  });
  console.log(JSON.stringify({cases:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,realReads:0,realWrites:0,results},null,2));
  if(results.some(x=>!x.pass))process.exitCode=1;
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
