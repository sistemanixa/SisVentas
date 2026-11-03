'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const grid=fs.readFileSync('js/modules/resizable-tables.js','utf8');
const readiness=fs.readFileSync('js/core/data-readiness.js','utf8');
const style=fs.readFileSync('css/loading-status.css','utf8');
const html=`<style>${style}.sv-columns-pending{visibility:hidden!important}.page{display:none}.page.active{display:block}table{width:100%}</style>
<section class="page active" id="page-dashboard"></section>
<section class="page" id="page-presupuesto"><div id="ppto-list-view"><table id="ppto-tabla"><thead><tr><th>Código</th><th>Cliente</th></tr></thead><tbody id="ppto-tbody-main"></tbody></table></div></section>
<section class="page" id="page-oculta"><table id="otra-tabla"><thead><tr><th>Dato</th></tr></thead><tbody><tr><td>Oculto</td></tr></tbody></table></section>`;
for(const width of [390,768,1280])test('primera apertura revela columnas tras datos tardíos sin tocar filtros '+width,async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{const page=await browser.newPage({viewport:{width,height:850}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{requests.push(r.request().url());return r.abort();});
 await page.setContent(html);await page.addScriptTag({content:readiness});await page.addScriptTag({content:grid});
 await page.evaluate(()=>{
  window.permisoModulo=()=>true;document.dispatchEvent(new CustomEvent('sisventas:session-ready'));
  window.sources=['clientes','productos','presupuestos'].map(k=>SVDataReadiness.beginSource(k,'fixture/'+k));
  document.getElementById('page-dashboard').classList.remove('active');document.getElementById('page-presupuesto').classList.add('active');
  SisVentas.prepareResizablePage(document.getElementById('page-presupuesto'));
  document.dispatchEvent(new CustomEvent('sisventas:page-changed',{detail:{page:'presupuesto'}}));
 });
 await page.waitForFunction(()=>document.getElementById('page-presupuesto').classList.contains('sv-data-pending'));
 await page.evaluate(()=>{document.getElementById('ppto-tbody-main').innerHTML='<tr><td>PP-TEST</td><td>Cliente ficticio</td></tr>';SisVentas.prepareResizablePage(document.getElementById('page-oculta'));});
 // Reproduce una exploración ocurrida durante la carga, con filas ya recibidas.
 await page.evaluate(()=>SisVentas.prepareResizablePage(document.getElementById('page-presupuesto')));
 assert.equal(await page.locator('#ppto-tabla').evaluate(n=>getComputedStyle(n).visibility),'hidden');
 await page.evaluate(()=>sources.forEach(s=>s.ready()));
 await page.waitForFunction(()=>getComputedStyle(document.getElementById('ppto-tabla')).visibility==='visible');
 assert.equal(await page.locator('#ppto-tbody-main').innerText(),'PP-TEST\tCliente ficticio');
 assert.equal(await page.locator('#ppto-tabla.sv-columns-pending').count(),0);
 assert.equal(await page.locator('#otra-tabla.sv-columns-pending').count(),1,'no inicializa la pantalla oculta');
 const before=await page.locator('#ppto-tabla').evaluate(n=>n.outerHTML);
 await page.evaluate(()=>{for(let i=0;i<10;i++)document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));});
 assert.equal(await page.locator('#ppto-tabla').evaluate(n=>n.outerHTML),before,'eventos repetidos no reconstruyen la tabla');
 assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>/firebase|googleapis/.test(u)).length,0);
 }finally{await browser.close();}
});
