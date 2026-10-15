'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const current=fs.readFileSync('js/core/data-readiness.js','utf8');
const previous=execFileSync('git',['show','c15e5663d928840f9823ddb3ee9c34b85d62d3e4:js/core/data-readiness.js'],{encoding:'utf8'});
const app=require('../helpers/active-app').readActiveApp().source;
const oldApp=execFileSync('git',['show','c15e5663d928840f9823ddb3ee9c34b85d62d3e4:js/app.v3.11.5.js'],{encoding:'utf8',maxBuffer:16*1024*1024});
function extract(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
async function run(){
 const browser=await chromium.launch({headless:true});let checks=0;
 try{
  for(const viewport of [{width:1366,height:900},{width:390,height:844}])for(const baseline of [true,false]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<style>:root{--bg2:#182333;--text:#edf3fa;--text3:#bac6d6;--border2:#394a61;--blue:#78b9ff}body{margin:0;background:#0b1423;color:#edf3fa;font:16px system-ui}header{padding:20px;background:#101d30}main{margin:20px;max-width:900px}.card{background:#182333;border:1px solid #394a61;padding:20px;border-radius:14px}button{padding:10px}h1{font-size:24px}</style><header>Dashboard · Técnico · sesión ficticia</header><aside id="loading-msg"></aside><main id="page-dashboard" class="page active"><h1>Mi inicio</h1><section id="personal" class="card">Mi cuenta y órdenes de trabajo</section></main><main id="page-gastos" hidden></main>');
   await page.addScriptTag({content:`
    var visibleWidgets=['dashboard.miCuenta','dashboard.misOT'];
    window.tienePermiso=k=>visibleWidgets.includes(k);
    window.svPuedeLeerDominio=()=>true; // Lectura autorizada por otra pantalla, no por una tarjeta del inicio.
    window.permisoModulo=k=>k==='dashboard';
    var _svPaginaDesdeRuta=()=> 'dashboard';
    var _svCargaInicial={clientes:{listo:true,etiqueta:'clientes'},productos:{listo:true,etiqueta:'productos'},ventas:{listo:false,etiqueta:'ventas'},pagos:{listo:false,etiqueta:'cobros'}};
   `});
   await page.addScriptTag({content:baseline?previous:current});
   const names=['svEstadoCargaInicial','svPintarCargaInicial'];if(!baseline)names.unshift('svClavesCargaInicial');
   await page.addScriptTag({content:names.map(n=>extract(baseline?oldApp:app,n)).join('\n')});
   await page.evaluate(()=>{document.dispatchEvent(new Event('DOMContentLoaded'));document.dispatchEvent(new Event('sisventas:session-ready'));svPintarCargaInicial();});
   await page.waitForFunction(pending=>document.querySelector('#page-dashboard').getAttribute('aria-busy')===String(pending),baseline);
   assert.equal(await page.locator('#personal').isVisible(),!baseline);
   assert.equal(await page.evaluate(()=>svEstadoCargaInicial().completo),!baseline);
   if(baseline)assert.match(await page.locator('#loading-msg').innerText(),/cobros/);
   else assert.doesNotMatch(await page.locator('#loading-msg').innerText(),/cobros|ventas/);
   checks++;
   await page.evaluate(()=>{SVDataReadiness.beginSource('pagos').error();for(const key of ['clientes','productos','ventas'])SVDataReadiness.beginSource(key).ready();});
   await page.waitForFunction(hasBox=>!!document.querySelector('#page-dashboard [data-sv-data-status]')===hasBox,baseline);
   if(baseline)assert.match(await page.locator('#page-dashboard [data-sv-data-status]').innerText(),/cobros/);
   else assert.equal(await page.locator('#personal').isVisible(),true);
   checks++;
   if(!baseline){
    assert.equal(await page.locator('#page-gastos [data-sv-data-status]').count(),0);
    await page.screenshot({path:'tmp/validacion-v3117-inicio-tecnico-'+viewport.width+'.png',fullPage:true});
    await page.evaluate(()=>{visibleWidgets=['dashboard.metricasGlobales'];document.dispatchEvent(new Event('sisventas:role-changed'));});
    await page.waitForSelector('#page-dashboard .sv-data-error');
    assert.match(await page.locator('#page-dashboard [data-sv-data-status]').innerText(),/cobros/);checks++;
    await page.evaluate(()=>{visibleWidgets=['dashboard.miCuenta'];document.dispatchEvent(new Event('sisventas:role-changed'));});
    await page.waitForFunction(()=>!document.querySelector('#page-dashboard [data-sv-data-status]'));
    assert.equal(await page.locator('#personal').isVisible(),true);checks++;
    await page.evaluate(()=>{document.dispatchEvent(new Event('sisventas:session-ended'));visibleWidgets=['dashboard.metricasGlobales'];SVDataReadiness.render();});
    await page.waitForFunction(()=>document.querySelector('#page-dashboard').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('#page-dashboard [data-sv-data-status]').count(),0);checks++;
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log(JSON.stringify({checks,passed:true,scope:'Espera inicial, tarjetas habilitadas, error real, cambio de permisos y cierre; datos ficticios sin Firebase'},null,2));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
