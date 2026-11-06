'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {functionSource}=require('./helpers/app-functions.cjs');
const chrome=process.env.SV_TEST_CHROME||process.env.SV_CHROME_PATH;
for(const width of [390,1280])for(const order of [['ventas','pagos','clientes'],['clientes','pagos','ventas']])test('legacy CC completes without touching filters '+width+' '+order.join('-'),{skip:!chrome},async t=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,executablePath:chrome});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width,height:900}});let network=0;await page.route('**/*',r=>{network++;return r.abort();});
 const ids=['cc-tbody','cc-buscador','cc-contador','cc-met-clientes','cc-met-clientes-sub','cc-met-deuda','cc-met-vencidos','cc-total','cc-cobrado','cc-saldo-lbl','cc-detail'];
 await page.setContent('<style>body{background:#101b2c;color:white;font:16px Arial}td{padding:10px}</style><h1>Cuenta corriente · prueba ficticia</h1>'+ids.map(id=>id==='cc-tbody'?'<table><tbody id="cc-tbody"></tbody></table>':id==='cc-buscador'?'<input id="cc-buscador" value="Cliente">':'<div id="'+id+'"></div>').join(''));
 await page.evaluate(()=>{
  window.currentUserUid='fiction';window.currentRole='admin';window.fbAuth={currentUser:{uid:'fiction'}};window.fbDB={};window.PERMISOS_ROLES={admin:{indiceRevision:1}};window.permisoModulo=()=>true;window.svPuedeLeerDominio=()=>true;window._svEsPaginaActiva=()=>true;
  window._historialPagosCompleto=[];window.ventasList=[];window.escapeHTML=String;window._mostrarFecha=String;window.buscarCC=()=>{};
  window._svCrearIndicePagosVentas=()=>({});window._svPagosIndiceVenta=()=>[];window._svPagosEmbebidosVenta=()=>[];window._svConstruirCuentaCorriente=()=>({fiction:{nombre:'Cliente ficticio',total:100,cobrado:20,ultimoPago:'—'}});
 });
 for(const name of ['_ccEsperarFuentesCompletas','renderTablaCuentaCorriente','actualizarConciliacionComercial'])await page.addScriptTag({content:functionSource(name)});
 await page.addScriptTag({content:fs.readFileSync(require.resolve('../js/core/data-readiness.js'),'utf8')});
 await page.evaluate(()=>{window.tokens=Object.fromEntries(['ventas','pagos','clientes'].map(k=>[k,SVDataReadiness.beginSource(k)]));actualizarConciliacionComercial();});
 await page.addScriptTag({content:fs.readFileSync(require.resolve('../js/modules/client-account-legacy-reconcile.v1.js'),'utf8')});
 for(const key of order)await page.evaluate(key=>{actualizarConciliacionComercial();tokens[key].ready();},key);
 await page.waitForFunction(()=>document.querySelector('#cc-tbody [data-saldo="80"]'));
 assert.equal(await page.locator('#cc-met-clientes').innerText(),'1');assert.equal(await page.locator('#cc-met-deuda').innerText(),'$80');assert.equal(await page.locator('#cc-buscador').inputValue(),'Cliente');assert.equal(network,0);
});
