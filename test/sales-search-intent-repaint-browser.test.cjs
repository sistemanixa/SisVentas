'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs');
test('real input plus synchronous sort does not restart the old historical filter before debounce',{timeout:60000},async()=>{
 const local=await start({count:340,historicalCount:20,paymentAmount:400}),before=structuredClone(local.backend.state);let browser,release,seenResolve;
 const gate=new Promise(r=>release=r),seen=new Promise(r=>seenResolve=r);let hold=true;const queries=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SV_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==new URL(local.url).origin)return route.abort();
   if(!['GET','OPTIONS'].includes(route.request().method())&&url.pathname!=='/laboral/capacidades')return route.abort();
   if(url.pathname==='/fixture-read'){const spec=JSON.parse(url.searchParams.get('spec'));queries.push(spec);if(hold&&spec.path.endsWith('/search/all/616e74')){seenResolve();await gate;}}
   return route.continue();
  });
  await page.goto(local.url);await page.waitForFunction(()=>SVDataReadiness.statusFor('detalle').ready&&document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50);
  const debt=await page.locator('#vm-pendiente').textContent(),totals=queries.filter(q=>q.path.includes('/totals/')).length;
  await page.locator('#ventas-search').fill('Antigua');await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('Old historical query not observed')),15000))]);
  const pending=await page.evaluate(async()=>{
   const before=__moduleAudit.reads.length,input=document.getElementById('ventas-search');input.value='V-FIXTURE-0';input.dispatchEvent(new Event('input',{bubbles:true}));
   sortTabla('ventas-tbl','cliente','texto');
   // Microtasks run before the native120ms timer, independent of machine speed.
   for(let i=0;i<8;i++)await Promise.resolve();
   return {extra:__moduleAudit.reads.slice(before).filter(r=>r.type==='get'&&r.path.startsWith('sv_commercial_pages')),rows:document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length,status:document.getElementById('ventas-search-status').textContent,focus:document.activeElement.id,filter:window._filtrosVentas.texto,debt:document.getElementById('vm-pendiente').textContent};
  });
  assert.equal(pending.filter,'Antigua');assert.deepEqual(pending.extra,[]);assert.equal(pending.rows,1);assert.match(pending.status,/provisori/i);assert.equal(pending.focus,'ventas-search');assert.equal(pending.debt,debt);
  hold=false;release();await page.waitForFunction(()=>window._filtrosVentas.texto==='V-FIXTURE-0'&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true'&&document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===1);
  assert.equal(queries.filter(q=>q.path.endsWith('/search/all/616e74')).length,1);assert.equal(queries.filter(q=>q.path.includes('/totals/')).length,totals);assert.equal(await page.locator('#vm-pendiente').textContent(),debt);assert.deepEqual(local.backend.state,before);
 }finally{hold=false;release();await browser?.close();await new Promise(r=>{local.server.close(r);local.server.closeAllConnections();});}
});
