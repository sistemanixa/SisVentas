'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const current=fs.readFileSync('js/core/data-readiness.js','utf8');
const old=execFileSync('git',['show','b1d94bc91ba288aa410f3aecd016cdb8b3b5797c:js/core/data-readiness.js'],{encoding:'utf8'});
const app=require('../helpers/active-app').readActiveApp().source;
const previous=execFileSync('git',['show','b1d94bc91ba288aa410f3aecd016cdb8b3b5797c:js/app.v3.11.1.js'],{encoding:'utf8',maxBuffer:16*1024*1024});
function extract(source,name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}
async function fixture(browser,viewport,source,pageName){
 const page=await browser.newPage({viewport});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>:root{--bg2:#182333;--text:#edf3fa;--text3:#bac6d6;--border2:#394a61;--blue:#78b9ff}*{box-sizing:border-box}body{margin:0;padding:16px;background:#10151e;color:#edf3fa;font:16px system-ui}button{padding:10px}main{max-width:800px;margin:auto}h1{font-size:24px}</style><main id="page-'+pageName+'" class="page active"><h1>'+pageName+'</h1><section id="records">Información ficticia confirmada</section></main>');
 await page.evaluate(()=>{window.svPuedeLeerDominio=key=>['clientes','productos'].includes(key);});
 await page.addScriptTag({content:source});
 await page.evaluate(()=>{document.dispatchEvent(new Event('DOMContentLoaded'));document.dispatchEvent(new Event('sisventas:session-ready'));});
 // El render usa requestAnimationFrame: esperar el DOM, no un plazo fijo
 // que puede vencer antes del primer frame al iniciar Chromium en otra PC.
 await page.waitForFunction(()=>document.querySelector('.page.active').hasAttribute('aria-busy'));
 return {page,errors};
}
async function run(){
 const browser=await chromium.launch({headless:true});const results=[];
 try{
  for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
   for(const baseline of [true,false]){
    const {page,errors}=await fixture(browser,viewport,baseline?old:current,'dashboard');
    await page.evaluate(()=>{for(const key of ['clientes','productos'])SVDataReadiness.begin('https://fixture.invalid/sisventas/'+key).ready();});
    await page.waitForFunction(pending=>document.querySelector('.page.active').getAttribute('aria-busy')===String(pending),baseline);
    const visible=await page.locator('#records').isVisible();assert.equal(visible,!baseline);
    if(!baseline)assert.equal(await page.locator('[data-sv-data-status]').count(),0);
    assert.deepEqual(errors,[]);results.push({viewport:viewport.width,case:'dashboard-restringido',baseline,visible});await page.close();
   }
   for(const baseline of [true,false]){
    const {page,errors}=await fixture(browser,viewport,baseline?old:current,'gastos');
    await page.evaluate(()=>{
     window.currentUserUid='fixture';window.permisoModulo=()=>true;window.svPuedeLeerDominio=()=>false;
     window._svModuleListeners={};window.SISVENTAS_FUNCTIONS={cotizadorProveedor:'https://fixture.invalid'};
     window.SVServiceAuth={headers:async()=>({})};window.fetch=async()=>({ok:true,json:async()=>({ok:true,empleados:{}})});
     SVDataReadiness.begin('https://fixture.invalid/sisventas/gastos').ready();
    });
    await page.addScriptTag({content:extract(baseline?previous:app,'svEscucharDirectorioEmpleados')});
    await page.evaluate(()=>svEscucharDirectorioEmpleados(snap=>{window.directory=snap.val();}));
    await page.waitForFunction(pending=>document.querySelector('.page.active').getAttribute('aria-busy')===String(pending),baseline);
    assert.equal(await page.locator('#records').isVisible(),!baseline);assert.deepEqual(errors,[]);
    results.push({viewport:viewport.width,case:'directorio-reducido',baseline,visible:!baseline});await page.close();
   }
   const {page,errors}=await fixture(browser,viewport,current,'gastos');
   await page.evaluate(()=>{window.expenses=SVDataReadiness.begin('https://fixture.invalid/sisventas/gastos');expenses.ready();});
   await page.waitForFunction(()=>document.querySelector('#page-gastos').getAttribute('aria-busy')==='true');
   await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+16000;document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForSelector('.sv-data-error');
   assert.match(await page.locator('[data-sv-data-status]').innerText(),/No se pudieron cargar/);
   assert.equal(await page.locator('#records').isVisible(),false);
   assert.equal(await page.locator('#page-gastos').getAttribute('aria-busy'),'false');
   assert.equal(await page.getByRole('button',{name:'Reintentar carga'}).isVisible(),true);
   await page.screenshot({path:path.resolve('tmp/carga-recuperable-'+viewport.width+'.png'),fullPage:true});
   await page.evaluate(()=>{SVDataReadiness.beginSource('empleados').ready();});
   await page.waitForFunction(()=>!document.querySelector('[data-sv-data-status]'));
   assert.equal(await page.locator('#records').isVisible(),true);
   assert.deepEqual(errors,[]);
   results.push({viewport:viewport.width,case:'timeout-y-recuperacion',passed:true});await page.close();
  }
  console.log(JSON.stringify({checks:results.length,results},null,2));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
