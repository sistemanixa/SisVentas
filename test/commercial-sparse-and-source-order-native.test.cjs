'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{start}=require('./fixtures/commercial-full-app.cjs');
const output=process.env.SV_SPARSE_ORDER_EVIDENCE_DIR;if(output&&!path.isAbsolute(output))throw Error('Evidence path must be absolute');
async function browserFor(local,{gated=false}={}){
 const browser=await chromium.launch({headless:true,executablePath:process.env.SV_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);
 const seenWaiters=[],errors=[],blocked=[],seen=[],gates={salesPage:{open:!gated,waiters:[]},paymentAwareTotals:{open:!gated,waiters:[]}},arrivals=[];
 function release(name){gates[name].open=true;for(const done of gates[name].waiters.splice(0))done();}
 await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());if(url.origin!==new URL(local.url).origin){blocked.push(url.origin+url.pathname);return route.abort();}if(request.method()!=='GET'&&request.method()!=='OPTIONS'&&url.pathname!=='/laboral/capacidades'){blocked.push(request.method()+' '+url.pathname);return route.abort();}
  if(gated&&url.pathname==='/fixture-bootstrap.js'){const response=await route.fetch();return route.fulfill({response,body:(await response.text())+"\n__moduleAuditSourceControl.hold(['clientes']);"});}
  if(url.pathname==='/fixture-read'){const spec=JSON.parse(url.searchParams.get('spec'));const name=spec.path==='sv_commercial_pages/v1/totals/all'?'paymentAwareTotals':spec.path.startsWith('sv_commercial_pages/v1/pages/')?'salesPage':null;if(name){seen.push(name);for(const waiter of seenWaiters)if(waiter.name===name)waiter.resolve();if(!gates[name].open)await new Promise(resolve=>gates[name].waiters.push(resolve));const response=await route.fetch();await route.fulfill({response});arrivals.push(name);return;}}
  return route.continue();});
 page.on('pageerror',e=>errors.push(e.message));
 return {browser,page,errors,blocked,seen,arrivals,release,whenSeen:name=>seen.includes(name)?Promise.resolve():new Promise(resolve=>seenWaiters.push({name,resolve})),async close(){release('salesPage');release('paymentAwareTotals');await browser.close();}};
}
function moneyCents(value){return Math.round(Number(value.replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))*100);} 
let screenSequence=0;
async function snapshot(page){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const result=await page.evaluate(()=>{
  const metric=document.getElementById('vm-pendiente'),active=document.querySelector('.page.active'),layer=document.getElementById('sv-data-status-layer');
  const style=metric?getComputedStyle(metric):null,box=metric?.getBoundingClientRect(),cover=layer?getComputedStyle(layer):null;
  return {rows:document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length,ready:SVDataReadiness.statusFor('detalle'),clientsReady:SVDataReadiness.status(['clientes']).ready,financialReady:SVDataReadiness.status(['ventas','pagos']).ready,debt:metric?.textContent,status:document.getElementById('ventas-search-status')?.textContent,busy:document.getElementById('ventas-list-view')?.getAttribute('aria-busy'),pager:document.getElementById('ventas-paginacion')?.textContent,filters:structuredClone(window._filtrosVentas||{}),pendingLayer:!!layer,presentation:{pageBusy:active?.getAttribute('aria-busy'),pageInert:active?.inert,pagePending:active?.classList.contains('sv-data-pending'),metricVisibility:style?.visibility,metricDisplay:style?.display,metricOpacity:style?.opacity,metricVisible:!!box&&box.width>0&&box.height>0&&style.visibility==='visible'&&style.display!=='none'&&Number(style.opacity)>0,layerVisibility:cover?.visibility,layerDisplay:cover?.display,statusText:layer?.innerText}};
 });
 if(output){fs.mkdirSync(output,{recursive:true});result.screenshot=path.join(output,'frame-'+(++screenSequence)+'.png');await page.screenshot({path:result.screenshot});}
 return result;
}
function save(name,result){
 if(result.pass){
  const bounded=result.queries.filter(row=>row.source?.startsWith('sv_commercial_pages/v1/pages/')||row.source?.startsWith('sv_commercial_pages/v1/search/'));
  assert(bounded.length>0);assert(bounded.every(row=>row.limit>=1&&row.limit<=50));assert(!result.queries.some(row=>['sisventas/ventas','sisventas/pagos'].includes(row.source)));
  for(const state of result.states||[])if(!state.financialReady){
   assert.equal(state.ready.ready,false);assert.equal(state.pendingLayer,true);assert.equal(state.presentation.pageBusy,'true');
   // A hidden metric under the pending screen is not a confirmed visible zero.
   if(state.presentation.metricVisible)assert.match(state.debt,/Cargando/);
   else assert.equal(state.presentation.metricVisibility,'hidden');
  }
 }
 if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify({...result,testSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')},null,2));}
}
async function shutdown(local,f){await f?.close();await new Promise(resolve=>{local.server.close(resolve);local.server.closeAllConnections();});}
test('real HTML sparse month plus text keeps continuation across two empty UI pages to historical match',{timeout:60000},async()=>{
 const local=await start({count:620,historicalCount:20,paymentAmount:400}),before=structuredClone(local.backend.state);let f;const pages=[];
  try{f=await browserFor(local);const {page}=f;
  const isSearch=response=>{try{const url=new URL(response.url());return url.pathname==='/fixture-read'&&JSON.parse(url.searchParams.get('spec')).path.startsWith('sv_commercial_pages/v1/search/all/');}catch{return false;}};
  const searchResponses=[];page.on('response',response=>{if(isSearch(response)){const spec=JSON.parse(new URL(response.url()).searchParams.get('spec'));searchResponses.push({path:spec.path,start:spec.start||null,limit:spec.limit});}});
  await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50&&SVDataReadiness.statusFor('detalle').ready);
  // Both old and searched grids contain50 rows. Wait for the actual debounced
  // search response and its settled filter before starting the month filter.
  const textResponse=page.waitForResponse(isSearch);await page.locator('#ventas-search').fill('V-FIXTURE');await(await textResponse).finished();
  await page.waitForFunction(()=>window._filtrosVentas?.texto==='V-FIXTURE'&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true'&&document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50);
  const monthResponse=page.waitForResponse(isSearch);await page.locator('#ventas-mes').fill('2020-01');await(await monthResponse).finished();
  for(let index=0;index<3;index++){
   await page.waitForFunction(index=>window._filtrosVentas?.texto==='V-FIXTURE'&&window._filtrosVentas?.mes==='2020-01'&&document.getElementById('ventas-paginacion').textContent.includes('Página '+(index+1))&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true'&&(index<2?document.getElementById('ventas-search-status').textContent.includes('Siguiente'):document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===20),index);
   const state=await snapshot(page),ids=await page.locator('#ventas-tbody tr[data-indexed-sale]').evaluateAll(nodes=>nodes.map(n=>n.dataset.indexedSale));pages.push({...state,ids,searchResponses:structuredClone(searchResponses)});
   if(index<2){assert.equal(ids.length,0,'first two UI pages are genuinely empty');assert.match(state.status,/Siguiente/);assert.equal(await page.locator('[data-index-next]').isEnabled(),true);const nextResponse=page.waitForResponse(isSearch);await page.locator('[data-index-next]').click();await(await nextResponse).finished();}
   else{assert.equal(ids.length,20);assert.equal(new Set(ids).size,20);assert(ids.every(id=>Number(id.replace('fixture',''))>=600));assert.equal(await page.locator('[data-index-next]').isEnabled(),false);}
  }
  await page.locator('#ventas-mes').fill('');await page.locator('#ventas-search').fill('');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true');const final=await snapshot(page);assert.equal(final.rows,50);assert.equal(moneyCents(final.debt),local.fixture.expectedDebtCents);assert.equal(local.backend.commits.length,0);assert.equal(local.backend.commands.length,0);assert.deepEqual(local.backend.state,before);assert.deepEqual(f.errors,[]);assert.deepEqual(f.blocked,[]);save('sparse',{pass:true,pages,final,expectedDebtCents:local.fixture.expectedDebtCents,queries:local.measures.filter(r=>r.source),commits:0});
 }catch(error){save('sparse',{pass:false,error:error.stack,pages,live:f?await snapshot(f.page).catch(()=>null):null});throw error;}finally{await shutdown(local,f);}
});
for(const first of ['salesPage','paymentAwareTotals'])test('real HTML late Clients and '+first+' first preserve complete debt and readiness',{timeout:45000},async()=>{
 const local=await start({count:122,historicalCount:20,paymentAmount:400}),before=structuredClone(local.backend.state);let f;const states=[];
 try{f=await browserFor(local,{gated:true});const {page}=f;await page.goto(local.url);await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='page-detalle');await page.waitForFunction(()=>document.getElementById('ventas-list-view')?.getAttribute('aria-busy')==='true');await page.waitForFunction(()=>__moduleAuditSourceControl.pending().includes('sisventas/clientes'));
   await Promise.all([f.whenSeen('salesPage'),f.whenSeen('paymentAwareTotals')]);
   // Requests can be observed before the active page's first paint. Sample a
   // presented frame, without waiting for any particular metric text/value.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   states.push(await snapshot(page));assert.equal(states.at(-1).ready.ready,false);
  const firstResponse=page.waitForResponse(response=>{try{const u=new URL(response.url());if(u.pathname!=='/fixture-read')return false;const spec=JSON.parse(u.searchParams.get('spec'));return first==='salesPage'?spec.path.startsWith('sv_commercial_pages/v1/pages/'):spec.path==='sv_commercial_pages/v1/totals/all';}catch{return false;}});f.release(first);await firstResponse;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));states.push(await snapshot(page));assert.equal(states.at(-1).ready.ready,false);assert.equal(states.at(-1).clientsReady,false);assert.equal(states.at(-1).busy,'true');
  f.release(first==='salesPage'?'paymentAwareTotals':'salesPage');await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr[data-indexed-sale]').length===50&&document.getElementById('ventas-list-view').getAttribute('aria-busy')!=='true');states.push(await snapshot(page));assert.equal(states.at(-1).ready.ready,false);assert.equal(states.at(-1).clientsReady,false);assert.equal(moneyCents(states.at(-1).debt),local.fixture.expectedDebtCents,'debt covers all122 sales, not the first50');
  await page.evaluate(()=>__moduleAuditSourceControl.release('clientes'));await page.waitForFunction(()=>SVDataReadiness.statusFor('detalle').ready);states.push(await snapshot(page));assert.equal(states.at(-1).rows,50);assert.equal(moneyCents(states.at(-1).debt),local.fixture.expectedDebtCents);assert.equal(states.at(-1).clientsReady,true);assert.equal(local.backend.commits.length,0);assert.equal(local.backend.commands.length,0);assert.deepEqual(local.backend.state,before);assert.deepEqual(f.errors,[]);assert.deepEqual(f.blocked,[]);
  save('order-'+first,{pass:true,first,states,arrivals:f.arrivals,expectedDebtCents:local.fixture.expectedDebtCents,commits:0,transport:'sales index page versus payment-aware complete totals; not legacy root snapshots',queries:local.measures.filter(r=>r.source)});
 }catch(error){save('order-'+first,{pass:false,error:error.stack,states,seen:f?.seen,live:f?await snapshot(f.page).catch(()=>null):null});throw error;}finally{await shutdown(local,f);}
});
