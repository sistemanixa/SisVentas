'use strict';
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const current=fs.readFileSync('js/modules/surveys.js','utf8');
const previous=execFileSync('git',['show','bec95a21fba3164c5cb33fb0036c66baabd0db39:js/modules/surveys.js'],{encoding:'utf8'});
const sample={id:'REL-fixture',cliente:'Cliente ficticio',direccion:'Sitio de prueba',contacto:'',autor:'Usuario ficticio',owner:'fixture',services:['alarma','otro'],items:{
 'alarma.central':{value:'p1',label:'Central de prueba',note:'Nota conservada',photo:{data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD9sAAAAASUVORK5CYII=',name:'foto.png'}},
 'alarma.teclados':{value:'1',note:'Total 2 teclados'},'alarma.zonas':{value:0},'otro.necesidad':{value:'Servicio ficticio'}
}};
async function runtime(page){
 await page.evaluate(()=>{
  window.currentUser='fixture';window.currentUserEmail='';window.permisoModulo=()=>true;window.fbDB={};window.fbRef=(_,p)=>p;
  window.notices=[];window.records={};window.failOnce=false;window.notify=t=>{notices.push(t);document.getElementById('notice').textContent=t;};
  window.readDraft=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('sv-relevamientos',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('drafts');const get=tx.objectStore('drafts').get('fixture');get.onsuccess=()=>{resolve(get.result);db.close();};get.onerror=()=>reject(get.error);};});
  const validate=(v)=>{if(!v||typeof v!=='object')return;for(const [key,item]of Object.entries(v)){if(Array.from(key).some(c=>'.#$[]/'.includes(c)))throw Error('invalid key ('+key+')');validate(item);}};
  window.fbSet=async(path,data)=>{validate(data);if(failOnce){failOnce=false;throw Error('Fallo de red simulado');}records[data.id]=JSON.parse(JSON.stringify(data));};
  window.fbOnValue=(_,next)=>{queueMicrotask(()=>next({val:()=>records}));return ()=>{};};
 });
}
async function open(page,source){await page.addScriptTag({content:source});await page.evaluate(()=>document.dispatchEvent(new CustomEvent('sisventas:page-changed',{detail:{page:'relevamientos'}})));await page.locator('[data-step="3"]').waitFor();await page.locator('[data-step="3"]').click();}
async function run(){
 const styles=fs.readFileSync('css/app.css','utf8')+'\n'+fs.readFileSync('css/surveys.css','utf8');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><style>'+styles+'</style></head><body class="dark-mode" style="overflow:auto;height:auto"><p>Prueba aislada · datos ficticios</p><main id="page-relevamientos" class="page active"></main><div id="notice" role="status"></div></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});let checks=0;
 try{
  for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(data=>new Promise((resolve,reject)=>{const req=indexedDB.open('sv-relevamientos',1);req.onupgradeneeded=()=>req.result.createObjectStore('drafts');req.onsuccess=()=>{const db=req.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(data,'fixture');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),sample);
   await runtime(page);await open(page,previous);await page.locator('[data-save]').click();
   await page.waitForFunction(()=>notices.some(x=>x.includes('invalid key (alarma.central)')));
   assert.deepEqual(await page.evaluate(()=>readDraft()),sample);checks++;
   await page.reload();await runtime(page);await open(page,current);
   assert.ok((await page.locator('#rel-content').innerText()).includes('Total 2 teclados'));
   await page.evaluate(()=>{failOnce=true;});await page.locator('[data-save]').click();
   await page.waitForFunction(()=>notices.some(x=>x.includes('Fallo de red simulado')));
   assert.deepEqual(await page.evaluate(()=>readDraft()),sample);checks++;
   await page.locator('[data-save]').click();await page.waitForFunction(()=>notices.includes('Relevamiento guardado'));
   assert.equal(await page.evaluate(()=>readDraft()),undefined);
   const saved=await page.evaluate(()=>records['REL-fixture']);
   assert.deepEqual(saved.items.alarma.central,sample.items['alarma.central']);
   assert.deepEqual(saved.items.alarma.teclados,sample.items['alarma.teclados']);
   assert.equal(saved.items.alarma.zonas.value,0);checks++;
   await page.locator('.rel-saved summary').click();
   const summary=await page.locator('.rel-saved').innerText();
   for(const text of ['Central de prueba','Nota conservada','Total 2 teclados','Servicio ficticio'])assert.ok(summary.includes(text));
   assert.equal(await page.locator('.rel-saved img.rel-photo').count(),1);assert.deepEqual(errors,[]);checks++;
   await page.screenshot({path:'tmp/validacion-v3115-relevamiento-'+viewport.width+'.png',fullPage:true});
   await page.close();
  }
  console.log(JSON.stringify({checks,passed:true,scope:'Datos ficticios e IndexedDB aislado; sin Firebase ni registros reales'},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
