'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {start}=require('./fixtures/commercial-full-app.cjs');
async function fixture(width,work){const local=await start();let browser;try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(5000);
 await page.route('**/*',route=>route.request().url().startsWith(local.url)?route.continue():route.abort());await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);
 await page.locator('#ventas-tbody tr').first().click();await page.waitForFunction(()=>window._ventaDetalleActual?.fbKey==='fixture0'&&document.querySelectorAll('#venta-detalle-view tr[data-venta-item-index]').length===16);
 const original=structuredClone(local.backend.state.sisventas);await work(page,local);assert.equal(local.backend.commands.length,0);assert.equal(local.backend.commits.length,0);assert.deepEqual(local.backend.state.sisventas,original);
 }finally{await browser?.close();await new Promise(resolve=>local.server.close(resolve));}}
async function hold(page,id){let release,reached;const paused=new Promise(resolve=>{reached=resolve;}),barrier=new Promise(resolve=>{release=resolve;});let count=0;
 await page.route('**/fixture-read?*',async route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));if(spec.path!=='sisventas/ventas/'+id)return route.fallback();count++;reached();await barrier;await route.continue();});
 return {paused,release,count:()=>count};}
const opening=(page,id,slot)=>page.evaluate(({id,slot})=>{window[slot]=SVCommercialPagesHost.openSale(id);},{id,slot});
for(const width of [390,1280]){
 test('opening another sale retires previous financial actions during 300ms delay '+width,{timeout:20000},()=>fixture(width,async(page)=>{
  const gate=await hold(page,'fixture1');await opening(page,'fixture1','openingOne');await gate.paused;
  const panel=page.locator('#venta-detalle-view');assert.equal(await panel.getAttribute('aria-busy'),'true');assert.match(await panel.innerText(),/Abriendo venta/);
  assert.equal(await panel.locator('[role="status"] .ti-loader-2.ti-spin[aria-hidden="true"]').count(),1);
  assert.equal(await page.evaluate(()=>window._ventaDetalleActual),null);assert.equal(await panel.getByRole('button',{name:'A presupuesto',exact:true}).count(),0);
  await assert.rejects(panel.getByRole('button',{name:'A presupuesto',exact:true}).click({timeout:100}),/Timeout/);
  await new Promise(resolve=>setTimeout(resolve,300));gate.release();await page.evaluate(()=>openingOne);
  await page.waitForFunction(()=>window._ventaDetalleActual?.fbKey==='fixture1');assert.equal(await panel.getAttribute('aria-busy'),null);assert.equal(await panel.getByRole('button',{name:'A presupuesto',exact:true}).count(),1);
 }));
 test('inverted sale responses preserve the latest intention and exclude the stale original '+width,{timeout:20000},()=>fixture(width,async(page)=>{
  const first=await hold(page,'fixture1'),second=await hold(page,'fixture2');await opening(page,'fixture1','openingOne');await first.paused;await opening(page,'fixture2','openingTwo');await second.paused;
  second.release();await page.evaluate(()=>openingTwo);assert.equal(await page.evaluate(()=>_ventaDetalleActual.fbKey),'fixture2');
  first.release();await page.evaluate(()=>openingOne);
  assert.deepEqual(await page.evaluate(()=>({detail:_ventaDetalleActual?.fbKey,summary:_svPagedSaleDetail?.key,stale:ventasList.some(v=>v.fbKey==='fixture1'&&!v._svPagedSummary)})),{detail:'fixture2',summary:'fixture2',stale:false});
  assert.match(await page.locator('#venta-detalle-view').getByRole('button',{name:'A presupuesto',exact:true}).getAttribute('onclick'),/V-FIXTURE-2/);
 }));
}
test('failed opening never restores old sale actions',{timeout:20000},()=>fixture(390,async page=>{
 await page.route('**/fixture-read?*',route=>{const spec=JSON.parse(new URL(route.request().url()).searchParams.get('spec'));return spec.path==='sisventas/ventas/fixture1'?route.fulfill({status:403,body:'null'}):route.continue();});
 await page.evaluate(()=>SVCommercialPagesHost.openSale('fixture1'));assert.equal(await page.evaluate(()=>_ventaDetalleActual),null);assert.match(await page.locator('#venta-detalle-view').innerText(),/No se pudo abrir/);assert.equal(await page.locator('#venta-detalle-view').getByRole('button',{name:'A presupuesto',exact:true}).count(),0);
}));
for(const change of ['database','permissions','session','back'])test(change+' change discards pending original and leaves no previous actions',{timeout:20000},()=>fixture(390,async page=>{
 const gate=await hold(page,'fixture1');await opening(page,'fixture1','openingOne');await gate.paused;
 if(change==='back')await page.locator('#venta-detalle-view').getByRole('button',{name:'Volver',exact:true}).click();
 else await page.evaluate(change=>{if(change==='database')window.fbDB={fixture:'replacement'};if(change==='permissions')window.PERMISOS_ROLES={...window.PERMISOS_ROLES,admin:{...window.PERMISOS_ROLES?.admin,indiceRevision:(window.PERMISOS_ROLES?.admin?.indiceRevision||0)+1}};if(change==='session'){currentUserUid='';fbAuth.currentUser=null;document.dispatchEvent(new Event('sisventas:session-ended'));}},change);
 gate.release();await page.evaluate(()=>openingOne);
 assert.deepEqual(await page.evaluate(()=>({detail:_ventaDetalleActual,summary:_svPagedSaleDetail,stale:ventasList.some(v=>v.fbKey==='fixture1'&&!v._svPagedSummary)})),{detail:null,summary:null,stale:false});assert.equal(await page.locator('#venta-detalle-view').getByRole('button',{name:'A presupuesto',exact:true}).count(),0);
}));
