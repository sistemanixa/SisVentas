'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{start}=require('../scripts/dev-client-accounts.cjs');
const executablePath='C:/Program Files/Google/Chrome/Application/chrome.exe';
test('Cuenta corriente retira resultados del texto anterior antes del debounce y de la respuesta',{timeout:30000},async()=>{
 const local=await start();let browser,release;
 try{browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(local.url);await page.locator('#cc-tbody [data-account]').nth(49).waitFor();
  const metrics=await page.locator('#cc-met-deuda').textContent();let seen;const began=new Promise(r=>seen=r),held=new Promise(r=>release=r);
  await page.route('**/read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path.includes('/searchByStatus/')||spec.path.includes('/search/')){seen();await held;}return route.continue();});
  await page.locator('#cc-buscador').fill('remoto');
  assert.equal(await page.locator('#cc-tbody [data-account]').first().isVisible(),false,'El resultado anterior no debe verse durante los 180 ms de debounce.');
  await began;await page.evaluate(()=>renderTablaCuentaCorriente());assert.equal(await page.locator('#cc-tbody [data-account]').first().isVisible(),false);
  assert.equal(await page.locator('#cc-met-deuda').textContent(),metrics);release();release=null;
  await page.waitForFunction(()=>document.getElementById('cc-tbody').textContent.includes('Cliente remoto')&&document.getElementById('cc-tbody').style.visibility!=='hidden');
  assert.equal(await page.locator('#cc-tbody [data-account]').count(),1);assert.equal(local.backend.commits.length,0);
 }finally{release?.();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});
test('abrir otra cuenta no muestra nombre ni movimientos del cliente anterior mientras consulta',{timeout:30000},async()=>{
 const local=await start();let browser,release;
 try{browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage();await page.goto(local.url);await page.locator('#cc-tbody [data-account]').nth(1).waitFor();
  const accounts=await page.locator('#cc-tbody [data-account]').evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.dataset.account));
  await page.locator('[data-account="'+accounts[0]+'"]').click();await page.locator('#cc-native-ledger-pages-status').getByText('Página 1',{exact:true}).waitFor();const previous=await page.locator('#cc-nombre').textContent();
  await page.locator('#cc-detail button[onclick="volverListaCuentaCorriente()"]').click();let seen;const began=new Promise(r=>seen=r),held=new Promise(r=>release=r);
  await page.route('**/read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path.includes('/ledgers/')){seen();await held;}return route.continue();});
  await page.locator('[data-account="'+accounts[1]+'"]').click();await began;
  assert.notEqual(await page.locator('#cc-nombre').textContent(),previous);assert.equal(await page.locator('#cc-movimientos tbody tr').first().isVisible(),false);
  release();release=null;await page.locator('#cc-native-ledger-pages-status').getByText('Página 1',{exact:true}).waitFor();assert.notEqual(await page.locator('#cc-nombre').textContent(),previous);assert.equal(local.backend.commits.length,0);
 }finally{release?.();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});

test('una respuesta de período anterior no reemplaza el último filtro de cuenta corriente',{timeout:30000},async()=>{
 const local=await start({consolidate:true});let browser,release;
 try{browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage();await page.goto(local.url);await page.locator('#cc-tbody [data-account]').first().click();await page.locator('#cc-native-ledger-pages').getByText('Página 1',{exact:true}).waitFor();
 let seen;const began=new Promise(r=>seen=r),held=new Promise(r=>release=r);
 await page.route('**/read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path.endsWith('/rows')&&spec.from==='20261001_'){seen();await held;}return route.continue();});
 await page.evaluate(()=>{document.getElementById('cc-extracto-desde').value='2026-10-01';void aplicarFiltroExtractoCuentaCorriente();});await began;
 await page.evaluate(()=>{document.getElementById('cc-extracto-desde').value='2026-11-01';void aplicarFiltroExtractoCuentaCorriente();});
 await page.waitForFunction(()=>document.getElementById('cc-native-ledger-pages-status').textContent==='Página 1'&&document.getElementById('cc-movimientos').style.visibility!=='hidden');
 const latest=await page.locator('#cc-movimientos').textContent();release();release=null;await page.waitForTimeout(200);
 assert.equal(await page.locator('#cc-movimientos').textContent(),latest);assert.equal(await page.locator('#cc-extracto-desde').inputValue(),'2026-11-01');assert.equal(local.backend.commits.length,0);
 }finally{release?.();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});
