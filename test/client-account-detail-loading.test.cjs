'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),{start}=require('../scripts/dev-client-accounts.cjs');
const executablePath='C:/Program Files/Google/Chrome/Application/chrome.exe';
for(const width of [390,1280])test('account opening dims immediately, blocks old actions and releases after real ledger '+width,{timeout:30000},async()=>{
 const local=await start();let browser,release;
 try{browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage({viewport:{width,height:900}});await page.goto(local.url);await page.evaluate(()=>document.documentElement.classList.add('dark-mode'));await page.locator('#cc-tbody [data-account]').nth(1).waitFor();
  let began;const waiting=new Promise(r=>began=r),held=new Promise(r=>release=r);await page.route('**/read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path.includes('/ledgers/')){began();await held;}return route.continue();});
  await page.locator('#cc-tbody [data-account]').first().click();await waiting;
  const layer=page.locator('.sv-load-status-layer-dim');await layer.getByText('Cargando cuenta…',{exact:true}).waitFor();assert.equal(await page.locator('#page-cuentacorriente').getAttribute('inert'),'');assert.equal(await page.locator('#cc-movimientos tbody tr').first().isVisible(),false);assert.notEqual(await layer.evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.screenshot({path:'C:/SisVentas/tmp/account-detail-loading-'+width+'.private.png'});release();release=null;await page.locator('#cc-native-ledger-pages-status').getByText('Página 1',{exact:true}).waitFor();await layer.waitFor({state:'detached'});assert.equal(await page.locator('#page-cuentacorriente').getAttribute('inert'),null);assert.equal(local.backend.commits.length,0);
 }finally{release?.();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});
test('legacy account calculation yields a paint with the same overlay and cancels on session change',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true,executablePath});try{const page=await browser.newPage();await page.setContent('<main id="page-cuentacorriente" class="page active"><button>Cuenta</button></main>');
 await page.evaluate(()=>{window.location.hash='/cuentacorriente';window.currentUserUid='fixture';window.currentRole='admin';window.fbAuth={currentUser:{uid:'fixture'}};window.fbDB={};window.PERMISOS_ROLES={admin:{indiceRevision:1}};window.permisoModulo=()=>true;window.calls=[];window.verCuentaClienteReal=()=>calls.push({overlay:!!document.querySelector('.sv-load-status-layer-dim'),inert:document.querySelector('main').inert});});
 for(const file of ['js/core/data-readiness.js','js/core/client-account-mode.v1.js','js/core/client-account-writer-proof.v1.js','js/modules/client-account-host.v1.js'])await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
 await page.evaluate(async()=>{await SVClientAccountHost.start();window.task=verCuentaClienteReal('fixture');if(!document.querySelector('.sv-load-status-layer-dim'))throw Error('Missing immediate overlay');await task;});assert.deepEqual(await page.evaluate(()=>calls),[{overlay:true,inert:true}]);assert.equal(await page.locator('main').getAttribute('inert'),null);
 await page.evaluate(async()=>{window.task=verCuentaClienteReal('fixture');document.dispatchEvent(new Event('sisventas:session-ended'));await task;});assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(await page.locator('.sv-load-status-layer-dim').count(),0);
 }finally{await browser.close();}
});
